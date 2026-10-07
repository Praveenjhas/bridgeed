/**
 * BridgeEd feed content loop live smoke test.
 *
 * Usage:
 *   1. Make sure PostgreSQL is running and the API is serving
 *      (`npm run dev --workspace=apps/api`).
 *   2. Run `npm run smoke:feed-loop --workspace=apps/api`
 *
 * Optional environment variables:
 *   API_BASE_URL (default http://localhost:4000)
 *
 * It proves the content loop the app now offers, on the authenticated endpoints
 * exactly as the mobile client calls them: a signed-in student creates a post,
 * the post appears in their ranked feed, they like it and comment on it, and
 * every write is attributed to the bearer token rather than to any id in the
 * body. It also proves the feed is per identity: a query-string actor is ignored
 * when a token is present, and a student outside the community never sees its
 * posts. Every account, community, post, reaction and comment it creates carries
 * this run's id and is removed again in cleanup, even when a check fails; the
 * audit then proves the row counts came back to where they started.
 */
import { COMMUNITY_TYPES, REACTION_TYPES } from "@bridgeed/shared";
import { prisma } from "../src/config/prisma";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const API_PREFIX = "/api/v1";

const RUN_ID = `flsmoke${Date.now().toString(36)}${Math.random()
  .toString(36)
  .slice(2, 6)}`;

/** A password that satisfies the policy and is not on the blocklist. */
const VALID_PASSWORD = "Smoke-Verifier-9f3a-Qz";

interface ApiResult {
  status: number;
  body: unknown;
}

interface ApiOptions {
  body?: unknown;
  /** Convenience for `Authorization: Bearer <token>`. */
  token?: string;
}

interface SessionTokens {
  userId: string;
  email: string;
  accessToken: string;
}

interface SmokeState {
  createdUserIds: string[];
  createdCommunityIds: string[];
}

interface BaselineCounts {
  users: number;
  profiles: number;
  sessions: number;
  communities: number;
  memberships: number;
  posts: number;
  comments: number;
  postReactions: number;
}

const failures: string[] = [];
let checkCount = 0;

function record(name: string, ok: boolean, detail?: unknown): boolean {
  checkCount += 1;

  if (ok) {
    console.log(`PASS  ${name}`);
    return true;
  }

  const suffix = detail === undefined ? "" : ` :: ${JSON.stringify(detail)}`;
  failures.push(`${name}${suffix}`);
  console.log(`FAIL  ${name}${suffix}`);

  return false;
}

function expectStatus(
  name: string,
  result: ApiResult,
  expected: number,
): boolean {
  return record(
    name,
    result.status === expected,
    result.status === expected
      ? undefined
      : { expected, actual: result.status, body: result.body },
  );
}

function expectEqual(name: string, actual: unknown, expected: unknown): boolean {
  return record(name, actual === expected, { expected, actual });
}

function expectTrue(name: string, value: boolean, detail?: unknown): boolean {
  return record(name, value, value ? undefined : detail);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(source: unknown, key: string): string | null {
  const value = asRecord(source)[key];

  return typeof value === "string" ? value : null;
}

function smokeEmail(label: string): string {
  return `${RUN_ID}-${label}@bridgeed-smoke.test`;
}

async function api(
  method: string,
  path: string,
  options: ApiOptions = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.token !== undefined) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  let body: unknown = null;

  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  return { status: response.status, body };
}

/** Pulls the session out of a register response. */
function readSession(body: unknown, label: string): SessionTokens {
  const user = asRecord(asRecord(body)["user"]);
  const accessToken = readString(body, "accessToken");
  const userId = readString(user, "id");

  if (!accessToken || !userId) {
    throw new Error(`${label}: response did not contain a usable session`);
  }

  return { userId, email: readString(user, "email") ?? "", accessToken };
}

function rememberUser(state: SmokeState, userId: string): void {
  if (!state.createdUserIds.includes(userId)) {
    state.createdUserIds.push(userId);
  }
}

/** Registers a fresh account and returns its session. */
async function registerAccount(
  state: SmokeState,
  label: string,
): Promise<SessionTokens> {
  const email = smokeEmail(label);
  const result = await api("POST", "/auth/register", {
    body: { email, password: VALID_PASSWORD },
  });

  expectStatus(`setup: register ${label}`, result, 201);

  const session = readSession(result.body, `setup: register ${label}`);
  rememberUser(state, session.userId);

  return session;
}

/** Creates a profile through the canonical authenticated endpoint. */
async function createProfile(
  session: SessionTokens,
  label: string,
): Promise<void> {
  const result = await api("POST", "/student-profiles/me", {
    token: session.accessToken,
    body: { name: `Smoke ${label}`, username: `${RUN_ID}${label}` },
  });

  expectStatus(`setup: create profile ${label}`, result, 201);
}

async function createCommunity(
  state: SmokeState,
  session: SessionTokens,
  suffix: string,
): Promise<string> {
  const result = await api("POST", "/communities", {
    token: session.accessToken,
    body: {
      name: `${RUN_ID} ${suffix}`,
      slug: `${RUN_ID}-${suffix}`,
      type: COMMUNITY_TYPES.PUBLIC,
    },
  });

  expectStatus(`setup: create community ${suffix}`, result, 201);

  const id = readString(result.body, "id");

  if (id) {
    state.createdCommunityIds.push(id);
  }

  return id ?? "";
}

async function joinCommunity(
  session: SessionTokens,
  communityId: string,
): Promise<void> {
  const result = await api(
    "POST",
    `/communities/${encodeURIComponent(communityId)}/join`,
    { token: session.accessToken },
  );

  expectStatus("setup: a peer joins the community", result, 201);
}

/** One page of the actor's ranked feed, read with the bearer token only. */
async function readFeedPage(
  session: SessionTokens,
  query = "",
): Promise<ApiResult> {
  return api("GET", `/feed${query}`, { token: session.accessToken });
}

function feedHasPost(feed: ApiResult, postId: string): boolean {
  return asArray(asRecord(feed.body)["items"]).some(
    (item) => asRecord(item)["id"] === postId,
  );
}

function feedItem(feed: ApiResult, postId: string): Record<string, unknown> {
  const match = asArray(asRecord(feed.body)["items"]).find(
    (item) => asRecord(item)["id"] === postId,
  );

  return asRecord(match);
}

/**
 * Row counts captured before the run, so the audit can prove nothing was lost.
 * The counts are awaited one at a time because the local Prisma Postgres dev
 * server resets a burst of simultaneous connections.
 */
async function readBaseline(): Promise<BaselineCounts> {
  return {
    users: await prisma.user.count(),
    profiles: await prisma.studentProfile.count(),
    sessions: await prisma.session.count(),
    communities: await prisma.community.count(),
    memberships: await prisma.communityMembership.count(),
    posts: await prisma.post.count(),
    comments: await prisma.comment.count(),
    postReactions: await prisma.postReaction.count(),
  };
}

/**
 * Deletes exactly what this run created. Every row this run makes hangs off one
 * of the accounts it registered — a profile, a session, a membership, a comment
 * and a reaction all cascade from an account, and the community its owner
 * created cascades its posts — so removing the accounts and the communities is
 * enough. The slug and email prefix are swept as well, in case a check failed
 * before an id was recorded.
 */
async function cleanup(state: SmokeState): Promise<void> {
  console.log("\n--- cleanup ---");

  const communities = await prisma.community.deleteMany({
    where: { id: { in: state.createdCommunityIds } },
  });

  console.log(`deleted ${communities.count} smoke communities`);

  const strayCommunities = await prisma.community.deleteMany({
    where: { slug: { startsWith: `${RUN_ID}-` } },
  });

  console.log(
    `deleted ${strayCommunities.count} further communities carrying the run prefix`,
  );

  const users = await prisma.user.deleteMany({
    where: { id: { in: state.createdUserIds } },
  });

  console.log(`deleted ${users.count} smoke accounts`);

  const strayUsers = await prisma.user.deleteMany({
    where: { email: { startsWith: `${RUN_ID}-` } },
  });

  console.log(
    `deleted ${strayUsers.count} further accounts carrying the run prefix`,
  );
}

/** Proves the cleanup put every count back exactly where it started. */
async function auditCleanup(baseline: BaselineCounts): Promise<void> {
  console.log("\n--- cleanup audit ---");

  const after = await readBaseline();
  const keys = Object.keys(baseline) as (keyof BaselineCounts)[];

  for (const key of keys) {
    expectEqual(
      `audit: ${key} is back to where it started`,
      after[key],
      baseline[key],
    );
  }
}

interface LoopFixture {
  communityId: string;
  author: SessionTokens;
  peer: SessionTokens;
  outsider: SessionTokens;
}

/**
 * The product loop, driven exactly as the app drives it: create a post, see it
 * in the feed, like it, comment on it, and read all of that back on a fresh
 * request so a relaunch is covered too.
 */
async function runContentLoop(fixture: LoopFixture): Promise<void> {
  console.log("\n--- create post -> feed ---");

  const { communityId, author, peer } = fixture;
  const postsPath = `/communities/${encodeURIComponent(communityId)}/posts`;

  const created = await api("POST", postsPath, {
    token: author.accessToken,
    body: {
      content:
        "Anyone preparing for placements and want to form a DSA study group?",
    },
  });

  expectStatus("create: an authenticated author can post", created, 201);

  const postId = readString(created.body, "id") ?? "";

  expectEqual(
    "create: the API names the token's account as the author",
    readString(created.body, "authorId"),
    author.userId,
  );

  const storedPost = await prisma.post.findUnique({ where: { id: postId } });

  expectEqual(
    "create: the database row is authored by the token's account",
    storedPost?.authorId,
    author.userId,
  );

  const feed = await readFeedPage(author);

  expectStatus("feed: GET /feed with the token succeeds", feed, 200);

  expectTrue(
    "feed: the new post appears in the author's feed",
    feedHasPost(feed, postId),
    { items: asArray(asRecord(feed.body)["items"]).length },
  );

  expectEqual(
    "feed: the author's own like state starts false",
    feedItem(feed, postId)["hasReacted"],
    false,
  );

  const peerFeed = await readFeedPage(peer);

  expectTrue(
    "feed: a fellow member sees the post too",
    feedHasPost(peerFeed, postId),
    { items: asArray(asRecord(peerFeed.body)["items"]).length },
  );

  console.log("\n--- like ---");

  const liked = await api(
    "POST",
    `/posts/${encodeURIComponent(postId)}/reactions`,
    {
      token: author.accessToken,
      body: { type: REACTION_TYPES.LIKE },
    },
  );

  expectStatus("like: an authenticated author can like the post", liked, 201);
  expectEqual(
    "like: the reaction is attributed to the token's account",
    readString(liked.body, "userId"),
    author.userId,
  );

  const likeRow = await prisma.postReaction.findFirst({
    where: { postId, userId: author.userId },
  });

  expectTrue(
    "like: the reaction row belongs to the token's account",
    likeRow !== null,
  );

  const likedFeed = await readFeedPage(author);

  expectEqual(
    "like: the author's feed now reports the like",
    feedItem(likedFeed, postId)["hasReacted"],
    true,
  );
  expectEqual(
    "like: the post reports one like",
    feedItem(likedFeed, postId)["likeCount"],
    1,
  );

  const peerAfterLike = await readFeedPage(peer);

  expectEqual(
    "like: the peer's own like state is untouched",
    feedItem(peerAfterLike, postId)["hasReacted"],
    false,
  );

  console.log("\n--- comment ---");

  const commented = await api(
    "POST",
    `/posts/${encodeURIComponent(postId)}/comments`,
    {
      token: author.accessToken,
      body: { content: "Count me in. I can share my notes from last semester." },
    },
  );

  expectStatus("comment: an authenticated author can comment", commented, 201);
  expectEqual(
    "comment: the API names the token's account as the author",
    readString(commented.body, "authorId"),
    author.userId,
  );

  const commentId = readString(commented.body, "id") ?? "";
  const storedComment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  expectEqual(
    "comment: the database row is authored by the token's account",
    storedComment?.authorId,
    author.userId,
  );

  const comments = await api(
    "GET",
    `/posts/${encodeURIComponent(postId)}/comments?page=1&limit=20`,
    { token: author.accessToken },
  );

  expectStatus("comments: the thread reads back", comments, 200);

  const commentItems = asArray(asRecord(comments.body)["items"]);

  expectTrue(
    "comments: the new comment is in the thread",
    commentItems.some((item) => asRecord(item)["id"] === commentId),
  );
  expectEqual(
    "comments: the comment is attributed to the token's account",
    asRecord(asRecord(commentItems[0])["author"])["userId"],
    author.userId,
  );

  const postDetails = await api("GET", `/posts/${encodeURIComponent(postId)}`, {
    token: author.accessToken,
  });

  expectStatus("post: the detail reads back", postDetails, 200);
  expectEqual(
    "post: the like count is one",
    asRecord(postDetails.body)["likeCount"],
    1,
  );
  expectEqual(
    "post: the comment count is one",
    asRecord(postDetails.body)["commentCount"],
    1,
  );

  console.log("\n--- persistence ---");

  const reloaded = await readFeedPage(author);

  expectTrue(
    "persist: the post is still there on a fresh request",
    feedHasPost(reloaded, postId),
  );
  expectEqual(
    "persist: the like is still there on a fresh request",
    feedItem(reloaded, postId)["hasReacted"],
    true,
  );
}

/**
 * Identity is never taken from the payload. A's token decides who A is, so an
 * id in the body names nobody else, and the feed is ranked for the token rather
 * than for any query-string actor.
 */
async function runIdentityChecks(fixture: LoopFixture): Promise<void> {
  console.log(
    "\n--- identity: writes cannot be attributed to somebody else ---",
  );

  const { communityId, author, peer, outsider } = fixture;
  const postsPath = `/communities/${encodeURIComponent(communityId)}/posts`;

  const spoofedPost = await api("POST", postsPath, {
    token: author.accessToken,
    body: {
      content: "Forged authorship attempt",
      authorId: peer.userId,
      actorId: peer.userId,
      userId: peer.userId,
    },
  });

  expectStatus("spoof: the forged post is still created", spoofedPost, 201);

  const spoofedPostId = readString(spoofedPost.body, "id") ?? "";
  const storedSpoof = await prisma.post.findUnique({
    where: { id: spoofedPostId },
  });

  expectEqual(
    "spoof: the post is authored by the token's account",
    storedSpoof?.authorId,
    author.userId,
  );

  const authoredByPeer = await prisma.post.count({
    where: { communityId, authorId: peer.userId },
  });

  expectEqual("spoof: the peer authored no post", authoredByPeer, 0);

  const spoofedLike = await api(
    "POST",
    `/posts/${encodeURIComponent(spoofedPostId)}/reactions`,
    {
      token: author.accessToken,
      body: {
        userId: peer.userId,
        authorId: peer.userId,
        actorId: peer.userId,
        type: REACTION_TYPES.LIKE,
      },
    },
  );

  expectStatus("spoof: the forged like is still accepted", spoofedLike, 201);

  const peerReactions = await prisma.postReaction.count({
    where: { postId: spoofedPostId, userId: peer.userId },
  });
  const authorReactions = await prisma.postReaction.count({
    where: { postId: spoofedPostId, userId: author.userId },
  });

  expectEqual(
    "spoof: the peer was not recorded as the reactor",
    peerReactions,
    0,
  );
  expectEqual(
    "spoof: the token's account owns the reaction",
    authorReactions,
    1,
  );

  const spoofedComment = await api(
    "POST",
    `/posts/${encodeURIComponent(spoofedPostId)}/comments`,
    {
      token: author.accessToken,
      body: {
        content: "Forged comment",
        authorId: peer.userId,
        userId: peer.userId,
        actorId: peer.userId,
      },
    },
  );

  expectStatus(
    "spoof: the forged comment is still accepted",
    spoofedComment,
    201,
  );
  expectEqual(
    "spoof: the comment is authored by the token's account",
    readString(spoofedComment.body, "authorId"),
    author.userId,
  );

  const peerComments = await prisma.comment.count({
    where: { postId: spoofedPostId, authorId: peer.userId },
  });

  expectEqual("spoof: the peer authored no comment", peerComments, 0);

  console.log("\n--- identity: the feed follows the token, not the query ---");

  const own = await readFeedPage(author);

  expectStatus("feed: GET /feed with no actorId succeeds", own, 200);

  const withQueryActor = await readFeedPage(
    author,
    `?actorId=${outsider.userId}`,
  );

  expectStatus(
    "feed: GET /feed?actorId=... still succeeds",
    withQueryActor,
    200,
  );
  expectTrue(
    "feed: the query-string actor is ignored for an authenticated caller",
    feedHasPost(withQueryActor, spoofedPostId),
    { items: asArray(asRecord(withQueryActor.body)["items"]).length },
  );

  const outsiderFeed = await readFeedPage(outsider);

  expectStatus("feed: an outsider's feed succeeds", outsiderFeed, 200);
  expectTrue(
    "feed: a non-member never sees the community's post",
    !feedHasPost(outsiderFeed, spoofedPostId),
    { items: asArray(asRecord(outsiderFeed.body)["items"]).length },
  );
}

async function main(): Promise<void> {
  console.log(`BridgeEd feed content loop smoke test :: ${RUN_ID}`);
  console.log(`target ${API_BASE_URL}${API_PREFIX}`);

  const state: SmokeState = { createdUserIds: [], createdCommunityIds: [] };
  const baseline = await readBaseline();

  try {
    const author = await registerAccount(state, "a");
    const peer = await registerAccount(state, "b");
    const outsider = await registerAccount(state, "c");

    await createProfile(author, "a");
    await createProfile(peer, "b");
    await createProfile(outsider, "c");

    const communityId = await createCommunity(state, author, "main");
    await joinCommunity(peer, communityId);

    const fixture: LoopFixture = { communityId, author, peer, outsider };

    await runContentLoop(fixture);
    await runIdentityChecks(fixture);
  } finally {
    await cleanup(state);
    await auditCleanup(baseline);
    await prisma.$disconnect();
  }

  if (failures.length > 0) {
    console.log(`\nFAILED ${failures.length} of ${checkCount} checks:`);

    for (const failure of failures) {
      console.log(`  - ${failure}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log(`\nPASSED all ${checkCount} checks.`);
}

void main().catch((error) => {
  console.error("smoke test aborted", error);
  process.exitCode = 1;
});
