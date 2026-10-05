/**
 * BridgeEd feed live smoke test.
 *
 * Usage:
 *   1. Make sure PostgreSQL is running and `npm run dev --workspace=apps/api`
 *      (or `npx tsx src/server.ts`) is serving the API.
 *   2. Run `npm run smoke:feed --workspace=apps/api`
 *
 * Optional environment variables:
 *   API_BASE_URL (default http://localhost:4000)
 *
 * The fixture is deterministic: posts are seeded directly through Prisma with
 * explicit `createdAt` values so recency, tier and engagement signals can be
 * isolated, while every write the API can express (memberships, reactions,
 * comments, connections) goes through the HTTP layer. Every row created by this
 * script is prefixed with a unique RUN_ID and removed again in the cleanup
 * step, even when a check fails.
 */
import {
  COMMUNITY_MEMBER_ROLES,
  COMMUNITY_MEMBERSHIP_STATUSES,
  COMMUNITY_TYPES,
  CONNECTION_STATUSES,
  FEED_DEFAULT_LIMIT,
  FEED_MAX_LIMIT,
  FEED_REASON_CODES,
} from "@bridgeed/shared";
import { prisma } from "../src/config/prisma";
import { STUDENT_PROFILE_NOT_FOUND_MESSAGE } from "../src/services/community.service";
import {
  FEED_ACTOR_REQUIRED_MESSAGE,
  FEED_CURSOR_INVALID_MESSAGE,
  FEED_LIMIT_INVALID_MESSAGE,
  FEED_MAX_CANDIDATES,
} from "../src/services/feed.service";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const API_PREFIX = "/api/v1";
const RUN_ID = `fed${Date.now().toString(36)}${Math.random()
  .toString(36)
  .slice(2, 7)}`;

const HOURS_IN_MILLISECONDS = 60 * 60 * 1000;

/** Ages used by the fixture, in hours. */
const BASELINE_AGE_HOURS = 5;
const TIE_AGE_HOURS = 3;
const TIER_AGE_HOURS = 7;
const FILLER_AGE_HOURS = 2;
const OLD_AGE_HOURS = 24 * 20;

/** Enough fillers that the default limit and the clamp are both observable. */
const FILLER_POST_COUNT = 40;

interface ApiResult {
  status: number;
  body: unknown;
}

interface SmokeContext {
  userIds: string[];
  communityIds: string[];
  postIds: string[];
  commentIds: string[];
  skillIds: string[];
  interestIds: string[];
  connectionIds: string[];
}

interface BaselineCounts {
  users: number;
  profiles: number;
  communities: number;
  memberships: number;
  posts: number;
  comments: number;
  postReactions: number;
  connections: number;
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

function expectError(
  name: string,
  result: ApiResult,
  status: number,
  message: string,
): boolean {
  const error = asRecord(result.body)["error"];
  const ok = result.status === status && error === message;

  return record(
    name,
    ok,
    ok
      ? undefined
      : { expected: { status, message }, actual: { status: result.status, error } },
  );
}

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult> {
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();

  if (text.length === 0) {
    return { status: response.status, body: null };
  }

  try {
    return { status: response.status, body: JSON.parse(text) as unknown };
  } catch {
    return { status: response.status, body: text };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function readString(source: unknown, key: string): string | null {
  const value = asRecord(source)[key];

  return typeof value === "string" ? value : null;
}

function readNumber(source: unknown, key: string): number | null {
  const value = asRecord(source)[key];

  return typeof value === "number" ? value : null;
}

function readBoolean(source: unknown, key: string): boolean | null {
  const value = asRecord(source)[key];

  return typeof value === "boolean" ? value : null;
}

function readStringArray(source: unknown, key: string): string[] | null {
  const value = asRecord(source)[key];

  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function readItems(value: unknown): Record<string, unknown>[] {
  const items = asRecord(value)["items"];

  return Array.isArray(items) ? items.map(asRecord) : [];
}

function findItemWithId(
  items: Record<string, unknown>[],
  id: string,
  key = "id",
): Record<string, unknown> | undefined {
  return items.find((item) => item[key] === id);
}

function containsText(value: unknown, needle: string): boolean {
  return JSON.stringify(value ?? null).includes(needle);
}

async function requireCreatedId(
  label: string,
  result: ApiResult,
  expectedStatus: number,
): Promise<string> {
  expectStatus(label, result, expectedStatus);

  const id = readString(result.body, "id");

  if (!id) {
    throw new Error(`${label}: response did not contain an id`);
  }

  return id;
}

/** Builds a feed URL, keeping the actor, limit and cursor handling in one place. */
function feedPath(
  actorId: string,
  limit?: number,
  cursor?: string | null,
): string {
  const parts = [`actorId=${encodeURIComponent(actorId)}`];

  if (limit !== undefined) {
    parts.push(`limit=${limit}`);
  }

  if (cursor !== undefined && cursor !== null) {
    parts.push(`cursor=${encodeURIComponent(cursor)}`);
  }

  return `/feed?${parts.join("&")}`;
}

function feedItemIds(value: unknown): string[] {
  return readItems(value)
    .map((item) => readString(item, "id"))
    .filter((id): id is string => id !== null);
}

function feedItemScores(value: unknown): number[] {
  return readItems(value)
    .map((item) => readNumber(item, "score"))
    .filter((score): score is number => score !== null);
}

function feedItemReasons(item: unknown): string[] {
  return readStringArray(item, "reasons") ?? [];
}

interface WalkedFeed {
  order: string[];
  items: Record<string, unknown>[];
  pageSizes: number[];
  pageCount: number;
  reachedEnd: boolean;
  scores: number[];
  candidatesConsidered: number[];
  cursorValues: unknown[];
}

/**
 * Walks the whole feed through its cursors. The walk is bounded so a broken
 * cursor can never loop forever; reaching the guard limit is itself a failure.
 */
async function walkFeedPages(
  label: string,
  actorId: string,
  limit: number,
): Promise<WalkedFeed> {
  const order: string[] = [];
  const items: Record<string, unknown>[] = [];
  const pageSizes: number[] = [];
  const scores: number[] = [];
  const candidatesConsidered: number[] = [];
  const cursorValues: unknown[] = [];
  let cursor: string | null = null;
  let reachedEnd = false;
  let pageCount = 0;

  while (pageCount < 40) {
    pageCount += 1;

    const result = await api("GET", feedPath(actorId, limit, cursor));

    expectStatus(`${label}: page ${pageCount} responds 200`, result, 200);

    const ids = feedItemIds(result.body);
    const body = asRecord(result.body);

    order.push(...ids);
    items.push(...readItems(result.body));
    pageSizes.push(ids.length);
    scores.push(...feedItemScores(result.body));

    const considered = readNumber(result.body, "candidatesConsidered");
    candidatesConsidered.push(considered === null ? -1 : considered);

    if (ids.length !== readItems(result.body).length) {
      record(`${label}: every page item carries an id`, false, result.body);
    }

    const nextCursor = body["nextCursor"];

    cursorValues.push(nextCursor);

    if (nextCursor === null) {
      reachedEnd = true;
      break;
    }

    if (typeof nextCursor !== "string" || nextCursor.length === 0) {
      record(
        `${label}: nextCursor is a non empty string or null`,
        false,
        nextCursor,
      );
      break;
    }

    cursor = nextCursor;
  }

  return {
    order,
    items,
    pageSizes,
    pageCount,
    reachedEnd,
    scores,
    candidatesConsidered,
    cursorValues,
  };
}

function itemsById(
  items: Record<string, unknown>[],
): Map<string, Record<string, unknown>> {
  const byId = new Map<string, Record<string, unknown>>();

  for (const item of items) {
    const id = readString(item, "id");

    if (id !== null) {
      byId.set(id, item);
    }
  }

  return byId;
}

/** Encodes an arbitrary payload the way the feed encodes its own cursors. */
function encodeCursorPayload(payload: unknown): string {
  return encodeURIComponent(
    Buffer.from(JSON.stringify(payload), "utf8").toString("base64url"),
  );
}

/** Decodes a cursor issued by the API, for asserting on its opaque payload. */
function decodeCursorPayload(cursor: string): Record<string, unknown> {
  try {
    return asRecord(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );
  } catch {
    return {};
  }
}

function indexOfId(order: string[], id: string): number {
  return order.indexOf(id);
}

function expectRankedBefore(
  label: string,
  order: string[],
  earlierId: string,
  laterId: string,
): boolean {
  const earlier = indexOfId(order, earlierId);
  const later = indexOfId(order, laterId);

  return record(
    label,
    earlier !== -1 && later !== -1 && earlier < later,
    {
      earlier: { id: earlierId, index: earlier },
      later: { id: laterId, index: later },
    },
  );
}

async function createStudent(
  context: SmokeContext,
  label: string,
): Promise<string> {
  const userResult = await api("POST", "/users", {
    email: `${RUN_ID}-${label}@bridgeed-smoke.test`,
    role: "STUDENT",
  });

  const userId = await requireCreatedId(
    `setup: create user ${label}`,
    userResult,
    201,
  );

  context.userIds.push(userId);

  const profileResult = await api("POST", "/student-profiles", {
    userId,
    name: `Smoke ${label}`,
    username: `${RUN_ID}-${label}`,
  });

  expectStatus(`setup: create student profile ${label}`, profileResult, 201);

  return userId;
}

async function createCommunity(
  context: SmokeContext,
  label: string,
  ownerId: string,
  type: string,
): Promise<string> {
  const result = await api("POST", "/communities", {
    name: `Smoke ${label} ${RUN_ID}`,
    slug: `${RUN_ID}-${label}`,
    type,
    createdById: ownerId,
  });

  const id = await requireCreatedId(
    `setup: create community ${label}`,
    result,
    201,
  );

  context.communityIds.push(id);

  return id;
}

function toDatabaseRole(
  role: string,
): "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER" {
  switch (role) {
    case COMMUNITY_MEMBER_ROLES.ADMIN:
      return "ADMIN";
    case COMMUNITY_MEMBER_ROLES.MODERATOR:
      return "MODERATOR";
    case COMMUNITY_MEMBER_ROLES.OWNER:
      return "OWNER";
    default:
      return "MEMBER";
  }
}

function toDatabaseStatus(
  status: string,
): "PENDING" | "ACTIVE" | "REJECTED" | "BANNED" {
  switch (status) {
    case COMMUNITY_MEMBERSHIP_STATUSES.PENDING:
      return "PENDING";
    case COMMUNITY_MEMBERSHIP_STATUSES.REJECTED:
      return "REJECTED";
    case COMMUNITY_MEMBERSHIP_STATUSES.BANNED:
      return "BANNED";
    default:
      return "ACTIVE";
  }
}

/**
 * Direct database setup for membership states the API cannot produce on demand:
 * the feed only ever derives authorization from these rows.
 */
async function seedMembership(
  label: string,
  communityId: string,
  userId: string,
  role: string,
  status: string,
): Promise<string> {
  const created = await prisma.communityMembership.create({
    data: {
      communityId,
      userId,
      role: toDatabaseRole(role),
      status: toDatabaseStatus(status),
    },
    select: { id: true, role: true, status: true },
  });

  record(
    `setup: membership seeded (${label})`,
    created.role === toDatabaseRole(role) &&
      created.status === toDatabaseStatus(status),
    created,
  );

  return created.id;
}

/**
 * Posts are seeded through Prisma so their `createdAt` can be placed in the
 * past, which is what makes the recency checks deterministic.
 */
async function seedPost(
  context: SmokeContext,
  label: string,
  data: {
    authorId: string;
    communityId: string;
    ageHours: number;
    /** Explicit timestamp, used when two posts must share one instant. */
    createdAt?: Date;
    deleted?: boolean;
  },
): Promise<string> {
  const createdAt =
    data.createdAt ??
    new Date(Date.now() - data.ageHours * HOURS_IN_MILLISECONDS);

  const created = await prisma.post.create({
    data: {
      authorId: data.authorId,
      communityId: data.communityId,
      content: `Smoke ${label} ${RUN_ID}`,
      type: "TEXT",
      createdAt,
      deletedAt: data.deleted === true ? new Date() : null,
    },
    select: { id: true, createdAt: true, deletedAt: true },
  });

  record(
    `setup: post seeded (${label})`,
    created.createdAt.getTime() === createdAt.getTime() &&
      (data.deleted !== true || created.deletedAt !== null),
    { expected: createdAt, actual: created.createdAt },
  );

  context.postIds.push(created.id);

  return created.id;
}

async function seedSkill(
  context: SmokeContext,
  label: string,
): Promise<string> {
  const created = await prisma.skill.create({
    data: { name: `Smoke Skill ${label} ${RUN_ID}` },
    select: { id: true },
  });

  context.skillIds.push(created.id);

  return created.id;
}

async function seedInterest(
  context: SmokeContext,
  label: string,
): Promise<string> {
  const created = await prisma.interest.create({
    data: { name: `Smoke Interest ${label} ${RUN_ID}` },
    select: { id: true },
  });

  context.interestIds.push(created.id);

  return created.id;
}

async function linkSkill(
  label: string,
  userId: string,
  skillId: string,
): Promise<void> {
  expectStatus(
    `setup: link skill (${label})`,
    await api("POST", `/student-profiles/${userId}/skills/${skillId}`),
    201,
  );
}

async function linkInterest(
  label: string,
  userId: string,
  interestId: string,
): Promise<void> {
  expectStatus(
    `setup: link interest (${label})`,
    await api("POST", `/student-profiles/${userId}/interests/${interestId}`),
    201,
  );
}

async function createConnection(
  context: SmokeContext,
  label: string,
  requesterId: string,
  receiverId: string,
): Promise<string> {
  const result = await api("POST", "/connections", {
    requesterId,
    receiverId,
  });

  const id = await requireCreatedId(
    `setup: connection request (${label})`,
    result,
    201,
  );

  context.connectionIds.push(id);

  return id;
}

async function acceptConnection(
  label: string,
  connectionId: string,
  actorId: string,
): Promise<void> {
  expectStatus(
    `setup: accept connection (${label})`,
    await api("PATCH", `/connections/${connectionId}/accept`, { actorId }),
    200,
  );
}

async function blockConnection(
  label: string,
  connectionId: string,
  actorId: string,
): Promise<void> {
  expectStatus(
    `setup: block connection (${label})`,
    await api("POST", `/connections/${connectionId}/block`, { actorId }),
    200,
  );
}

async function likePost(
  label: string,
  postId: string,
  userId: string,
): Promise<void> {
  await requireCreatedId(
    `setup: like post (${label})`,
    await api("POST", `/posts/${postId}/reactions`, { userId }),
    201,
  );
}

async function commentOnPost(
  context: SmokeContext,
  label: string,
  postId: string,
  authorId: string,
  content: string,
): Promise<void> {
  const result = await api("POST", `/posts/${postId}/comments`, {
    authorId,
    content,
  });

  const id = await requireCreatedId(`setup: comment (${label})`, result, 201);

  context.commentIds.push(id);
}

interface FeedUsers {
  owner: string;
  reader: string;
  connection: string;
  pending: string;
  alike: string;
  stranger: string;
  blockedUser: string;
  banned: string;
  waiting: string;
  outsider: string;
}

interface FeedCommunities {
  /** Public community where the reader is an ACTIVE member. */
  publicA: string;
  /** Public community where the reader is an ACTIVE moderator. */
  publicB: string;
  /** Private community owned by the reader. */
  privateActive: string;
  /** Private community owned by another student. */
  privateOther: string;
  /** Private community where the reader only has a pending request. */
  privatePending: string;
}

interface FeedPosts {
  baseline: string;
  ownPost: string;
  connectionPost: string;
  pendingPost: string;
  alikePost: string;
  blockedPost: string;
  oldPost: string;
  popularPost: string;
  quietPost: string;
  engagedPost: string;
  plainPost: string;
  tieA: string;
  tieB: string;
  deletedPost: string;
  tierMember: string;
  tierModerator: string;
  tierOwner: string;
  privateOtherPost: string;
  privatePendingPost: string;
  fillers: string[];
}

interface FeedFixture {
  users: FeedUsers;
  communities: FeedCommunities;
  posts: FeedPosts;
  /** Posts the reader must never see. */
  excludedPostIds: string[];
  /** Every post the reader may see. */
  expectedPostIds: string[];
}

async function setup(context: SmokeContext): Promise<FeedFixture> {
  console.log("\n--- setup ---");

  const users: FeedUsers = {
    owner: await createStudent(context, "owner"),
    reader: await createStudent(context, "reader"),
    connection: await createStudent(context, "connection"),
    pending: await createStudent(context, "pending"),
    alike: await createStudent(context, "alike"),
    stranger: await createStudent(context, "stranger"),
    blockedUser: await createStudent(context, "blocked"),
    banned: await createStudent(context, "banned"),
    waiting: await createStudent(context, "waiting"),
    outsider: await createStudent(context, "outsider"),
  };

  const communities: FeedCommunities = {
    publicA: await createCommunity(
      context,
      "public-a",
      users.owner,
      COMMUNITY_TYPES.PUBLIC,
    ),
    publicB: await createCommunity(
      context,
      "public-b",
      users.owner,
      COMMUNITY_TYPES.PUBLIC,
    ),
    privateActive: await createCommunity(
      context,
      "private-active",
      users.reader,
      COMMUNITY_TYPES.PRIVATE,
    ),
    privateOther: await createCommunity(
      context,
      "private-other",
      users.outsider,
      COMMUNITY_TYPES.PRIVATE,
    ),
    privatePending: await createCommunity(
      context,
      "private-pending",
      users.owner,
      COMMUNITY_TYPES.PRIVATE,
    ),
  };

  await seedFixtureMemberships(users, communities);

  // the reader asks to join a private community, which leaves a pending request
  expectStatus(
    "setup: reader requests to join the private community",
    await api("POST", `/communities/${communities.privatePending}/join`, {
      userId: users.reader,
    }),
    201,
  );

  const pendingMembership = await prisma.communityMembership.findUnique({
    where: {
      communityId_userId: {
        communityId: communities.privatePending,
        userId: users.reader,
      },
    },
    select: { status: true },
  });

  expectEqual(
    "setup: the join request is pending",
    pendingMembership?.status,
    "PENDING",
  );

  const posts = await seedFixturePosts(context, users, communities);

  await seedFixtureRelationships(context, users);
  await seedFixtureTopics(context, users);
  await seedFixtureFillers(context, posts, users, communities);

  return { users, communities, posts, ...fixturePostSets(posts) };
}

/**
 * Membership states are seeded directly because the API deliberately cannot
 * create a BANNED or PENDING membership on demand, while the feed derives all
 * of its authorization from exactly these rows.
 */
async function seedFixtureMemberships(
  users: FeedUsers,
  communities: FeedCommunities,
): Promise<void> {
  // Membership of private-active is created by the API itself, because the
  // reader owns that community and becomes its OWNER.
  await seedMembership(
    "reader member of public-a",
    communities.publicA,
    users.reader,
    COMMUNITY_MEMBER_ROLES.MEMBER,
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );
  await seedMembership(
    "reader moderator of public-b",
    communities.publicB,
    users.reader,
    COMMUNITY_MEMBER_ROLES.MODERATOR,
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );
  await seedMembership(
    "stranger member of public-a",
    communities.publicA,
    users.stranger,
    COMMUNITY_MEMBER_ROLES.MEMBER,
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );
  await seedMembership(
    "stranger member of public-b",
    communities.publicB,
    users.stranger,
    COMMUNITY_MEMBER_ROLES.MEMBER,
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );
  await seedMembership(
    "stranger member of private-active",
    communities.privateActive,
    users.stranger,
    COMMUNITY_MEMBER_ROLES.MEMBER,
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );
  await seedMembership(
    "connection member of public-a",
    communities.publicA,
    users.connection,
    COMMUNITY_MEMBER_ROLES.MEMBER,
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );
  await seedMembership(
    "pending member of public-a",
    communities.publicA,
    users.pending,
    COMMUNITY_MEMBER_ROLES.MEMBER,
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );
  await seedMembership(
    "alike member of public-a",
    communities.publicA,
    users.alike,
    COMMUNITY_MEMBER_ROLES.MEMBER,
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );
  await seedMembership(
    "blocked member of public-a",
    communities.publicA,
    users.blockedUser,
    COMMUNITY_MEMBER_ROLES.MEMBER,
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );
  await seedMembership(
    "banned member of public-a",
    communities.publicA,
    users.banned,
    COMMUNITY_MEMBER_ROLES.MEMBER,
    COMMUNITY_MEMBERSHIP_STATUSES.BANNED,
  );
  await seedMembership(
    "waiting pending member of public-a",
    communities.publicA,
    users.waiting,
    COMMUNITY_MEMBER_ROLES.MEMBER,
    COMMUNITY_MEMBERSHIP_STATUSES.PENDING,
  );
  await seedMembership(
    "waiting member of public-b",
    communities.publicB,
    users.waiting,
    COMMUNITY_MEMBER_ROLES.MEMBER,
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );
}

/**
 * The posts are laid out so each ranking signal can be read in isolation:
 * every pair below differs in exactly one signal, and the whole baseline group
 * shares one author, one community and one age.
 */
async function seedFixturePosts(
  context: SmokeContext,
  users: FeedUsers,
  communities: FeedCommunities,
): Promise<FeedPosts> {
  const baselineAuthor = {
    authorId: users.stranger,
    communityId: communities.publicA,
  };

  // tie-a and tie-b share one timestamp so they can only be separated by the
  // id tie-break of the ranking
  const tieCreatedAt = new Date(
    Date.now() - TIE_AGE_HOURS * HOURS_IN_MILLISECONDS,
  );

  const posts: FeedPosts = {
    baseline: await seedPost(context, "baseline", {
      ...baselineAuthor,
      ageHours: BASELINE_AGE_HOURS,
    }),
    ownPost: await seedPost(context, "own-post", {
      authorId: users.reader,
      communityId: communities.publicA,
      ageHours: BASELINE_AGE_HOURS,
    }),
    connectionPost: await seedPost(context, "connection-post", {
      authorId: users.connection,
      communityId: communities.publicA,
      ageHours: BASELINE_AGE_HOURS,
    }),
    pendingPost: await seedPost(context, "pending-post", {
      authorId: users.pending,
      communityId: communities.publicA,
      ageHours: BASELINE_AGE_HOURS,
    }),
    alikePost: await seedPost(context, "alike-post", {
      authorId: users.alike,
      communityId: communities.publicA,
      ageHours: BASELINE_AGE_HOURS,
    }),
    blockedPost: await seedPost(context, "blocked-post", {
      authorId: users.blockedUser,
      communityId: communities.publicA,
      ageHours: BASELINE_AGE_HOURS,
    }),
    oldPost: await seedPost(context, "old-post", {
      ...baselineAuthor,
      ageHours: OLD_AGE_HOURS,
    }),
    popularPost: await seedPost(context, "popular-post", {
      ...baselineAuthor,
      ageHours: BASELINE_AGE_HOURS,
    }),
    quietPost: await seedPost(context, "quiet-post", {
      ...baselineAuthor,
      ageHours: BASELINE_AGE_HOURS,
    }),
    engagedPost: await seedPost(context, "engaged-post", {
      ...baselineAuthor,
      ageHours: BASELINE_AGE_HOURS,
    }),
    plainPost: await seedPost(context, "plain-post", {
      ...baselineAuthor,
      ageHours: BASELINE_AGE_HOURS,
    }),
    tieA: await seedPost(context, "tie-a", {
      ...baselineAuthor,
      ageHours: TIE_AGE_HOURS,
      createdAt: tieCreatedAt,
    }),
    tieB: await seedPost(context, "tie-b", {
      ...baselineAuthor,
      ageHours: TIE_AGE_HOURS,
      createdAt: tieCreatedAt,
    }),
    deletedPost: await seedPost(context, "deleted-post", {
      ...baselineAuthor,
      ageHours: BASELINE_AGE_HOURS,
      deleted: true,
    }),
    tierMember: await seedPost(context, "tier-member", {
      ...baselineAuthor,
      ageHours: TIER_AGE_HOURS,
    }),
    tierModerator: await seedPost(context, "tier-moderator", {
      authorId: users.stranger,
      communityId: communities.publicB,
      ageHours: TIER_AGE_HOURS,
    }),
    tierOwner: await seedPost(context, "tier-owner", {
      authorId: users.stranger,
      communityId: communities.privateActive,
      ageHours: TIER_AGE_HOURS,
    }),
    privateOtherPost: await seedPost(context, "private-other-post", {
      authorId: users.outsider,
      communityId: communities.privateOther,
      ageHours: BASELINE_AGE_HOURS,
    }),
    privatePendingPost: await seedPost(context, "private-pending-post", {
      authorId: users.owner,
      communityId: communities.privatePending,
      ageHours: BASELINE_AGE_HOURS,
    }),
    fillers: [],
  };

  // engagement is created through the API wherever the API allows it, so the
  // counts the feed reports are the same counts the post endpoints report
  for (let index = 0; index < 4; index += 1) {
    await commentOnPost(
      context,
      `popular-${index}`,
      posts.popularPost,
      users.owner,
      `Popular comment ${index} ${RUN_ID}`,
    );
  }

  await likePost("engaged-post", posts.engagedPost, users.reader);
  await commentOnPost(
    context,
    "engaged-post",
    posts.engagedPost,
    users.reader,
    `Engaged comment ${RUN_ID}`,
  );

  // a reaction that outlives the post it belongs to: the feed must still never
  // surface the deleted post
  await prisma.postReaction.create({
    data: {
      postId: posts.deletedPost,
      userId: users.owner,
      type: "LIKE",
    },
  });

  return posts;
}

/**
 * The reader ends up with one accepted connection, one pending request and one
 * block. The block is created through the API, so the exclusion the feed applies
 * is based on a real BLOCKED row.
 */
async function seedFixtureRelationships(
  context: SmokeContext,
  users: FeedUsers,
): Promise<void> {
  const acceptedRequestId = await createConnection(
    context,
    "reader-connection",
    users.reader,
    users.connection,
  );

  await acceptConnection("reader-connection", acceptedRequestId, users.connection);

  // left pending on purpose: a pending request is a weaker signal than an
  // accepted connection
  await createConnection(
    context,
    "reader-pending",
    users.reader,
    users.pending,
  );

  const blockedRequestId = await createConnection(
    context,
    "reader-blocked",
    users.reader,
    users.blockedUser,
  );

  await blockConnection("reader-blocked", blockedRequestId, users.reader);
}

/** Gives the reader one skill and one interest, shared with one author only. */
async function seedFixtureTopics(
  context: SmokeContext,
  users: FeedUsers,
): Promise<void> {
  const sharedSkillId = await seedSkill(context, "shared");
  const sharedInterestId = await seedInterest(context, "shared");
  const unrelatedSkillId = await seedSkill(context, "unrelated");

  await linkSkill("reader", users.reader, sharedSkillId);
  await linkInterest("reader", users.reader, sharedInterestId);
  await linkSkill("alike", users.alike, sharedSkillId);
  await linkInterest("alike", users.alike, sharedInterestId);

  // the unrelated author holds a skill the reader does not, so no topic signal
  // may ever be reported for them
  await linkSkill("stranger", users.stranger, unrelatedSkillId);
}

/**
 * Fills public-b with enough posts that the default page size and the maximum
 * page size are both observable.
 */
async function seedFixtureFillers(
  context: SmokeContext,
  posts: FeedPosts,
  users: FeedUsers,
  communities: FeedCommunities,
): Promise<void> {
  for (let index = 0; index < FILLER_POST_COUNT; index += 1) {
    posts.fillers.push(
      await seedPost(context, `filler-${index}`, {
        authorId: users.stranger,
        communityId: communities.publicB,
        ageHours: FILLER_AGE_HOURS,
      }),
    );
  }
}

/** Splits the seeded posts into what the reader may and may not see. */
function fixturePostSets(posts: FeedPosts): {
  excludedPostIds: string[];
  expectedPostIds: string[];
} {
  return {
    excludedPostIds: [
      posts.blockedPost,
      posts.deletedPost,
      posts.privateOtherPost,
      posts.privatePendingPost,
    ],
    expectedPostIds: [
      posts.baseline,
      posts.ownPost,
      posts.connectionPost,
      posts.pendingPost,
      posts.alikePost,
      posts.oldPost,
      posts.popularPost,
      posts.quietPost,
      posts.engagedPost,
      posts.plainPost,
      posts.tieA,
      posts.tieB,
      posts.tierMember,
      posts.tierModerator,
      posts.tierOwner,
      ...posts.fillers,
    ],
  };
}

/**
 * Candidacy and privacy: the feed must contain exactly the posts the reader is
 * allowed to read, and nothing that reveals a community it cannot read.
 */
async function runCandidacyChecks(fixture: FeedFixture): Promise<WalkedFeed> {
  console.log("\n--- candidacy and privacy ---");

  const reader = fixture.users.reader;
  const walk = await walkFeedPages("candidacy", reader, 8);

  expectEqual("candidacy: the cursor walk terminated", walk.reachedEnd, true);
  expectEqual(
    "candidacy: every eligible post is returned",
    walk.order.length,
    fixture.expectedPostIds.length,
  );
  expectEqual(
    "candidacy: the walk uses the expected number of pages",
    walk.pageCount,
    Math.ceil(fixture.expectedPostIds.length / 8),
  );
  expectEqual(
    "candidacy: no post is returned twice",
    new Set(walk.order).size,
    walk.order.length,
  );

  const returned = new Set(walk.order);
  const missing = fixture.expectedPostIds.filter((id) => !returned.has(id));
  const leaked = fixture.excludedPostIds.filter((id) => returned.has(id));

  expectEqual("candidacy: no eligible post is missing", missing.length, 0);
  expectEqual("candidacy: no ineligible post is returned", leaked.length, 0);

  expectTrue(
    "candidacy: a blocked author's post is never returned",
    !returned.has(fixture.posts.blockedPost),
  );
  expectTrue(
    "candidacy: a soft deleted post is never returned",
    !returned.has(fixture.posts.deletedPost),
  );
  expectTrue(
    "candidacy: a community the actor is not active in contributes nothing",
    !returned.has(fixture.posts.privateOtherPost),
  );
  expectTrue(
    "candidacy: a community with a pending request contributes nothing",
    !returned.has(fixture.posts.privatePendingPost),
  );
  expectTrue(
    "candidacy: a private community the actor is active in is returned",
    returned.has(fixture.posts.tierOwner),
  );

  const firstPage = await api("GET", feedPath(reader, 8));

  expectStatus("candidacy: the first page responds 200", firstPage, 200);

  const firstItems = readItems(firstPage.body);
  const ranks = firstItems.map((item) => readNumber(item, "rank"));

  expectTrue(
    "candidacy: ranks are the page positions 1..n",
    ranks.every((rank, index) => rank === index + 1),
    ranks,
  );
  expectTrue(
    "candidacy: every item carries an author and a community",
    firstItems.every(
      (item) =>
        typeof asRecord(item["author"])["userId"] === "string" &&
        typeof asRecord(item["community"])["id"] === "string",
    ),
  );
  expectTrue(
    "candidacy: no item exposes an account level field",
    !containsText(firstPage.body, "@bridgeed-smoke.test") &&
      !containsText(firstPage.body, '"email"'),
  );

  const considered = readNumber(firstPage.body, "candidatesConsidered");

  expectEqual(
    "candidacy: candidatesConsidered reports the deduplicated candidate set",
    considered,
    fixture.expectedPostIds.length,
  );
  expectTrue(
    "candidacy: candidatesConsidered is stable across pages",
    walk.candidatesConsidered.every(
      (value) => value === fixture.expectedPostIds.length,
    ),
    walk.candidatesConsidered,
  );
  expectTrue(
    `candidacy: candidates stay within the documented cap of ${FEED_MAX_CANDIDATES}`,
    (considered ?? 0) <= FEED_MAX_CANDIDATES,
  );

  expectTrue(
    "privacy: another private community never appears in the payload",
    !containsText(firstPage.body, fixture.communities.privateOther),
  );
  expectTrue(
    "privacy: a community with a pending request never appears in the payload",
    !containsText(firstPage.body, fixture.communities.privatePending),
  );
  expectTrue(
    "privacy: no excluded post id appears in the payload",
    fixture.excludedPostIds.every((id) => !containsText(firstPage.body, id)),
  );
  expectTrue(
    "privacy: a blocked student's id never appears in the payload",
    !containsText(firstPage.body, fixture.users.blockedUser),
  );

  return walk;
}

/** Ranking: signal by signal, then the deterministic tie-break. */
function runOrderingChecks(walk: WalkedFeed, fixture: FeedFixture): void {
  console.log("\n--- ordering ---");

  let nonIncreasing = true;

  for (let index = 1; index < walk.scores.length; index += 1) {
    const previous = walk.scores[index - 1];
    const current = walk.scores[index];

    if (previous === undefined || current === undefined || current > previous) {
      nonIncreasing = false;
      break;
    }
  }

  expectTrue(
    "ordering: scores never increase across the whole walk",
    nonIncreasing,
    walk.scores,
  );

  expectRankedBefore(
    "ordering: an accepted connection outranks an unrelated author",
    walk.order,
    fixture.posts.connectionPost,
    fixture.posts.baseline,
  );
  expectRankedBefore(
    "ordering: a pending request outranks an unrelated author",
    walk.order,
    fixture.posts.pendingPost,
    fixture.posts.baseline,
  );
  expectRankedBefore(
    "ordering: a shared topic outranks an unrelated author",
    walk.order,
    fixture.posts.alikePost,
    fixture.posts.baseline,
  );
  expectRankedBefore(
    "ordering: an accepted connection outranks a shared topic",
    walk.order,
    fixture.posts.connectionPost,
    fixture.posts.alikePost,
  );
  expectRankedBefore(
    "ordering: a pending request outranks a shared topic",
    walk.order,
    fixture.posts.pendingPost,
    fixture.posts.alikePost,
  );
  expectRankedBefore(
    "ordering: a newer post outranks an older one",
    walk.order,
    fixture.posts.baseline,
    fixture.posts.oldPost,
  );
  expectRankedBefore(
    "ordering: an engaged post outranks a quiet one",
    walk.order,
    fixture.posts.popularPost,
    fixture.posts.quietPost,
  );
  expectRankedBefore(
    "ordering: the actor's own post is downranked",
    walk.order,
    fixture.posts.plainPost,
    fixture.posts.ownPost,
  );
  expectRankedBefore(
    "ordering: an already engaged post is downranked",
    walk.order,
    fixture.posts.plainPost,
    fixture.posts.engagedPost,
  );
  expectRankedBefore(
    "ordering: owner tier outranks moderator tier",
    walk.order,
    fixture.posts.tierOwner,
    fixture.posts.tierModerator,
  );
  expectRankedBefore(
    "ordering: moderator tier outranks member tier",
    walk.order,
    fixture.posts.tierModerator,
    fixture.posts.tierMember,
  );

  const [tieFirst, tieSecond] =
    fixture.posts.tieA < fixture.posts.tieB
      ? [fixture.posts.tieA, fixture.posts.tieB]
      : [fixture.posts.tieB, fixture.posts.tieA];

  expectRankedBefore(
    "ordering: identical scores fall back to id ascending",
    walk.order,
    tieFirst,
    tieSecond,
  );
}

/** Explainability: the reason codes must describe the signals that were used. */
function runReasonChecks(walk: WalkedFeed, fixture: FeedFixture): void {
  console.log("\n--- reasons and flags ---");

  const byId = itemsById(walk.items);
  const knownReasons = new Set<string>(Object.values(FEED_REASON_CODES));

  function reasonsFor(postId: string): string[] {
    const item = byId.get(postId);

    return item === undefined ? [] : feedItemReasons(item);
  }

  expectTrue(
    "reasons: every item carries a reasons array",
    walk.items.every((item) => Array.isArray(asRecord(item)["reasons"])),
  );
  expectTrue(
    "reasons: only documented codes are emitted",
    walk.items.every((item) =>
      feedItemReasons(item).every((reason) => knownReasons.has(reason)),
    ),
  );
  expectTrue(
    "reasons: every item explains its community visibility",
    walk.items.every((item) =>
      feedItemReasons(item).includes(FEED_REASON_CODES.IN_MY_COMMUNITY),
    ),
  );

  expectTrue(
    "reasons: an accepted connection is labelled",
    reasonsFor(fixture.posts.connectionPost).includes(
      FEED_REASON_CODES.FROM_CONNECTION,
    ),
  );
  expectTrue(
    "reasons: a pending request is not labelled as a connection",
    !reasonsFor(fixture.posts.pendingPost).includes(
      FEED_REASON_CODES.FROM_CONNECTION,
    ),
  );
  expectTrue(
    "reasons: a shared skill is reported",
    reasonsFor(fixture.posts.alikePost).includes(FEED_REASON_CODES.SHARED_SKILL),
  );
  expectTrue(
    "reasons: a shared interest is reported",
    reasonsFor(fixture.posts.alikePost).includes(
      FEED_REASON_CODES.SHARED_INTEREST,
    ),
  );
  expectTrue(
    "reasons: an unrelated author reports no shared skill",
    !reasonsFor(fixture.posts.baseline).includes(FEED_REASON_CODES.SHARED_SKILL),
  );
  expectTrue(
    "reasons: an unrelated author reports no shared interest",
    !reasonsFor(fixture.posts.baseline).includes(
      FEED_REASON_CODES.SHARED_INTEREST,
    ),
  );
  expectTrue(
    "reasons: the actor's own post is labelled",
    reasonsFor(fixture.posts.ownPost).includes(FEED_REASON_CODES.AUTHORED_BY_ME),
  );
  expectTrue(
    "reasons: an engaged post is labelled",
    reasonsFor(fixture.posts.engagedPost).includes(
      FEED_REASON_CODES.ALREADY_ENGAGED,
    ),
  );
  expectTrue(
    "reasons: an untouched post is not labelled as engaged",
    !reasonsFor(fixture.posts.plainPost).includes(
      FEED_REASON_CODES.ALREADY_ENGAGED,
    ),
  );
  expectTrue(
    "reasons: a fresh post is labelled recent",
    reasonsFor(fixture.posts.baseline).includes(FEED_REASON_CODES.RECENT),
  );
  expectTrue(
    "reasons: a 20 day old post is not labelled recent",
    !reasonsFor(fixture.posts.oldPost).includes(FEED_REASON_CODES.RECENT),
  );
  expectTrue(
    "reasons: a popular post is labelled popular",
    reasonsFor(fixture.posts.popularPost).includes(FEED_REASON_CODES.POPULAR),
  );
  expectTrue(
    "reasons: a quiet post is not labelled popular",
    !reasonsFor(fixture.posts.quietPost).includes(FEED_REASON_CODES.POPULAR),
  );
  expectTrue(
    "reasons: a private community the actor is active in is explained",
    reasonsFor(fixture.posts.tierOwner).includes(
      FEED_REASON_CODES.IN_MY_COMMUNITY,
    ),
  );

  const engagedItem = byId.get(fixture.posts.engagedPost);
  const plainItem = byId.get(fixture.posts.plainPost);
  const connectionItem = byId.get(fixture.posts.connectionPost);
  const baselineItem = byId.get(fixture.posts.baseline);

  expectEqual(
    "flags: an engaged post reports hasReacted",
    readBoolean(engagedItem, "hasReacted"),
    true,
  );
  expectEqual(
    "flags: an engaged post reports hasCommented",
    readBoolean(engagedItem, "hasCommented"),
    true,
  );
  expectEqual(
    "flags: an untouched post reports hasReacted false",
    readBoolean(plainItem, "hasReacted"),
    false,
  );
  expectEqual(
    "flags: an untouched post reports hasCommented false",
    readBoolean(plainItem, "hasCommented"),
    false,
  );
  expectEqual(
    "flags: an accepted connection reports fromConnection",
    readBoolean(connectionItem, "fromConnection"),
    true,
  );
  expectEqual(
    "flags: an unrelated author reports fromConnection false",
    readBoolean(baselineItem, "fromConnection"),
    false,
  );
}

/** Stability: the same request must produce the same ranking, twice in a row. */
async function runStabilityChecks(
  walk: WalkedFeed,
  fixture: FeedFixture,
): Promise<void> {
  console.log("\n--- stability ---");

  const first = await api("GET", feedPath(fixture.users.reader, FEED_MAX_LIMIT));
  const second = await api("GET", feedPath(fixture.users.reader, FEED_MAX_LIMIT));

  expectStatus("stability: the first call responds 200", first, 200);
  expectStatus("stability: the repeated call responds 200", second, 200);

  const firstIds = feedItemIds(first.body);
  const secondIds = feedItemIds(second.body);
  const generatedAt = readString(first.body, "generatedAt");

  expectEqual(
    "stability: the clamped page holds the maximum limit",
    firstIds.length,
    FEED_MAX_LIMIT,
  );
  expectEqual(
    "stability: a repeated call returns the same page size",
    firstIds.length,
    secondIds.length,
  );
  expectTrue(
    "stability: a repeated call returns the identical order",
    firstIds.join(",") === secondIds.join(","),
    { firstIds, secondIds },
  );
  expectEqual(
    "stability: the clamped page is the head of the full ranking",
    firstIds.join(","),
    walk.order.slice(0, FEED_MAX_LIMIT).join(","),
  );
  expectTrue(
    "stability: an incomplete page offers a cursor",
    readString(first.body, "nextCursor") !== null,
  );
  expectEqual(
    "stability: candidatesConsidered matches the walk",
    readNumber(first.body, "candidatesConsidered"),
    fixture.expectedPostIds.length,
  );
  expectTrue(
    "stability: generatedAt is an ISO timestamp",
    typeof generatedAt === "string" && !Number.isNaN(Date.parse(generatedAt)),
    generatedAt,
  );
}

/** Defaults, clamping and rejection of invalid limits and actors. */
async function runLimitChecks(
  walk: WalkedFeed,
  fixture: FeedFixture,
): Promise<void> {
  console.log("\n--- limit and actor ---");

  const reader = fixture.users.reader;

  const defaultResult = await api("GET", feedPath(reader));

  expectStatus(
    "limit: a request without a limit responds 200",
    defaultResult,
    200,
  );

  const defaultIds = feedItemIds(defaultResult.body);

  expectEqual(
    "limit: the default page size is 20",
    defaultIds.length,
    FEED_DEFAULT_LIMIT,
  );
  expectEqual(
    "limit: the default page is the head of the ranking",
    defaultIds.join(","),
    walk.order.slice(0, FEED_DEFAULT_LIMIT).join(","),
  );
  expectTrue(
    "limit: the default page offers a cursor while more posts exist",
    readString(defaultResult.body, "nextCursor") !== null,
  );

  const single = await api("GET", feedPath(reader, 1));

  expectStatus("limit: limit=1 responds 200", single, 200);
  expectEqual("limit: limit=1 returns a single item", feedItemIds(single.body).length, 1);
  expectEqual(
    "limit: limit=1 returns the top ranked post",
    feedItemIds(single.body)[0],
    walk.order[0],
  );

  const three = await api("GET", feedPath(reader, 3));

  expectStatus("limit: limit=3 responds 200", three, 200);
  expectEqual("limit: limit=3 returns three items", feedItemIds(three.body).length, 3);
  expectEqual(
    "limit: limit=3 stays in ranking order",
    feedItemIds(three.body).join(","),
    walk.order.slice(0, 3).join(","),
  );

  const beyondMax = await api("GET", feedPath(reader, 1000));

  expectStatus("limit: an oversized limit responds 200", beyondMax, 200);
  expectEqual(
    "limit: an oversized limit is clamped to the maximum",
    feedItemIds(beyondMax.body).length,
    FEED_MAX_LIMIT,
  );

  expectError(
    "limit: a non numeric limit is rejected",
    await api("GET", `/feed?actorId=${reader}&limit=abc`),
    400,
    FEED_LIMIT_INVALID_MESSAGE,
  );
  expectError(
    "limit: a zero limit is rejected",
    await api("GET", `/feed?actorId=${reader}&limit=0`),
    400,
    FEED_LIMIT_INVALID_MESSAGE,
  );
  expectError(
    "limit: a negative limit is rejected",
    await api("GET", `/feed?actorId=${reader}&limit=-4`),
    400,
    FEED_LIMIT_INVALID_MESSAGE,
  );
  expectError(
    "limit: a fractional limit is rejected",
    await api("GET", `/feed?actorId=${reader}&limit=1.5`),
    400,
    FEED_LIMIT_INVALID_MESSAGE,
  );
  expectError(
    "limit: an empty limit is rejected",
    await api("GET", `/feed?actorId=${reader}&limit=`),
    400,
    FEED_LIMIT_INVALID_MESSAGE,
  );

  expectError(
    "actor: a missing actor is rejected",
    await api("GET", "/feed"),
    400,
    FEED_ACTOR_REQUIRED_MESSAGE,
  );
  expectError(
    "actor: an unknown actor is rejected as not found",
    await api("GET", `/feed?actorId=${crypto.randomUUID()}`),
    404,
    STUDENT_PROFILE_NOT_FOUND_MESSAGE,
  );
}

/** Keyset pagination: separation, coverage, tamper resistance, terminal page. */
async function runCursorChecks(
  walk: WalkedFeed,
  fixture: FeedFixture,
): Promise<void> {
  console.log("\n--- cursor ---");

  const reader = fixture.users.reader;
  const page1 = await api("GET", feedPath(reader, 8));
  const cursor1 = readString(page1.body, "nextCursor");
  const page2 = await api("GET", feedPath(reader, 8, cursor1));

  expectStatus("cursor: the second page responds 200", page2, 200);

  const page1Ids = feedItemIds(page1.body);
  const page2Ids = feedItemIds(page2.body);
  const overlap = page1Ids.filter((id) => page2Ids.includes(id));

  expectEqual("cursor: the second page has the requested size", page2Ids.length, 8);
  expectEqual("cursor: consecutive pages never repeat an item", overlap.length, 0);
  expectEqual(
    "cursor: the second page continues the ranking",
    page2Ids.join(","),
    walk.order.slice(8, 16).join(","),
  );
  expectEqual(
    "cursor: the second page reports the same candidate count",
    readNumber(page2.body, "candidatesConsidered"),
    readNumber(page1.body, "candidatesConsidered"),
  );
  expectEqual(
    "cursor: the second page numbers its items from 1",
    readNumber(readItems(page2.body)[0] ?? {}, "rank"),
    1,
  );
  expectTrue(
    "cursor: the issued cursor stays opaque",
    cursor1 !== null &&
      !cursor1.includes("createdAt") &&
      !cursor1.includes('"score"'),
    cursor1,
  );

  const decodedCursor = decodeCursorPayload(cursor1 ?? "");

  expectEqual(
    "cursor: the issued cursor carries the current version",
    readNumber(decodedCursor, "v"),
    2,
  );
  expectTrue(
    "cursor: the issued cursor carries a reference time",
    typeof readString(decodedCursor, "at") === "string",
    decodedCursor,
  );

  const nullCursors = walk.cursorValues.filter((value) => value === null).length;

  expectEqual("cursor: only the final page terminates the feed", nullCursors, 1);
  expectEqual(
    "cursor: the final page terminates the feed",
    walk.cursorValues[walk.cursorValues.length - 1],
    null,
  );
  expectTrue(
    "cursor: every other page offers a cursor",
    walk.cursorValues
      .slice(0, -1)
      .every((value) => typeof value === "string" && value.length > 0),
  );
  expectEqual(
    "cursor: the walk returns every eligible post",
    walk.order.length,
    fixture.expectedPostIds.length,
  );
  expectEqual(
    "cursor: the walk covers every candidate exactly once",
    new Set(walk.order).size,
    fixture.expectedPostIds.length,
  );

  // builds a structurally valid v2 cursor with individual fields overridden
  const cursorPayload = (overrides: Record<string, unknown>): string =>
    encodeCursorPayload({
      v: 2,
      score: 1,
      createdAt: new Date().toISOString(),
      id: "x",
      at: new Date().toISOString(),
      ...overrides,
    });

  expectError(
    "cursor: a plain text cursor is rejected",
    await api("GET", `/feed?actorId=${reader}&limit=8&cursor=not-a-cursor`),
    400,
    FEED_CURSOR_INVALID_MESSAGE,
  );
  expectError(
    "cursor: an empty cursor is rejected",
    await api("GET", `/feed?actorId=${reader}&limit=8&cursor=`),
    400,
    FEED_CURSOR_INVALID_MESSAGE,
  );
  expectError(
    "cursor: a payload that is not a cursor is rejected",
    await api(
      "GET",
      `/feed?actorId=${reader}&limit=8&cursor=${encodeCursorPayload([1, 2, 3])}`,
    ),
    400,
    FEED_CURSOR_INVALID_MESSAGE,
  );
  expectError(
    "cursor: an unknown cursor version is rejected",
    await api(
      "GET",
      `/feed?actorId=${reader}&limit=8&cursor=${cursorPayload({ v: 99 })}`,
    ),
    400,
    FEED_CURSOR_INVALID_MESSAGE,
  );
  expectError(
    "cursor: a tampered score is rejected",
    await api(
      "GET",
      `/feed?actorId=${reader}&limit=8&cursor=${cursorPayload({ score: "high" })}`,
    ),
    400,
    FEED_CURSOR_INVALID_MESSAGE,
  );
  expectError(
    "cursor: a tampered timestamp is rejected",
    await api(
      "GET",
      `/feed?actorId=${reader}&limit=8&cursor=${cursorPayload({
        createdAt: "not-a-date",
      })}`,
    ),
    400,
    FEED_CURSOR_INVALID_MESSAGE,
  );
  expectError(
    "cursor: a missing reference time is rejected",
    await api(
      "GET",
      `/feed?actorId=${reader}&limit=8&cursor=${encodeCursorPayload({
        v: 2,
        score: 1,
        createdAt: new Date().toISOString(),
        id: "x",
      })}`,
    ),
    400,
    FEED_CURSOR_INVALID_MESSAGE,
  );
  expectError(
    "cursor: a cursor without an id is rejected",
    await api(
      "GET",
      `/feed?actorId=${reader}&limit=8&cursor=${encodeCursorPayload({
        v: 2,
        score: 1,
        createdAt: new Date().toISOString(),
        at: new Date().toISOString(),
      })}`,
    ),
    400,
    FEED_CURSOR_INVALID_MESSAGE,
  );

  const exhausted = await api(
    "GET",
    `/feed?actorId=${reader}&limit=8&cursor=${encodeCursorPayload({
      v: 2,
      score: -1,
      createdAt: new Date(0).toISOString(),
      id: "00000000-0000-0000-0000-000000000000",
      at: new Date().toISOString(),
    })}`,
  );

  expectStatus("cursor: a cursor past the end responds 200", exhausted, 200);
  expectEqual(
    "cursor: a cursor past the end returns no items",
    feedItemIds(exhausted.body).length,
    0,
  );
  expectEqual(
    "cursor: a cursor past the end returns a null cursor",
    asRecord(exhausted.body)["nextCursor"],
    null,
  );
  expectEqual(
    "cursor: a cursor past the end still reports its candidate count",
    readNumber(exhausted.body, "candidatesConsidered"),
    fixture.expectedPostIds.length,
  );
}

/** The feed must report the same engagement the post endpoints report. */
async function runCountConsistencyChecks(
  walk: WalkedFeed,
  fixture: FeedFixture,
): Promise<void> {
  console.log("\n--- count consistency ---");

  const byId = itemsById(walk.items);
  const reader = fixture.users.reader;
  const subjects: [string, string][] = [
    ["a popular post", fixture.posts.popularPost],
    ["an engaged post", fixture.posts.engagedPost],
    ["a quiet post", fixture.posts.quietPost],
    ["a topic matched post", fixture.posts.alikePost],
  ];

  for (const [label, postId] of subjects) {
    const item = byId.get(postId);
    const detail = await api("GET", `/posts/${postId}?actorId=${reader}`);

    expectStatus(`counts: post details for ${label} respond 200`, detail, 200);
    expectEqual(
      `counts: ${label} reports the same comment count`,
      readNumber(item, "commentCount"),
      readNumber(detail.body, "commentCount"),
    );
    expectEqual(
      `counts: ${label} reports the same like count`,
      readNumber(item, "likeCount"),
      readNumber(detail.body, "likeCount"),
    );
    expectEqual(
      `counts: ${label} reports the same author`,
      asRecord(asRecord(item)["author"])["userId"],
      asRecord(asRecord(detail.body)["author"])["userId"],
    );
    expectEqual(
      `counts: ${label} reports the same community`,
      asRecord(asRecord(item)["community"])["id"],
      asRecord(asRecord(detail.body)["community"])["id"],
    );
    expectEqual(
      `counts: ${label} reports the same creation timestamp`,
      readString(item, "createdAt"),
      readString(detail.body, "createdAt"),
    );
  }

  expectEqual(
    "counts: the popular post carries the seeded comments",
    readNumber(byId.get(fixture.posts.popularPost), "commentCount"),
    4,
  );
  expectEqual(
    "counts: the engaged post carries the actor's like",
    readNumber(byId.get(fixture.posts.engagedPost), "likeCount"),
    1,
  );
  expectEqual(
    "counts: the engaged post carries the actor's comment",
    readNumber(byId.get(fixture.posts.engagedPost), "commentCount"),
    1,
  );
}

/** Empty feeds, non active actors and the privacy matrix in reverse. */
async function runEmptyFeedChecks(fixture: FeedFixture): Promise<void> {
  console.log("\n--- empty feed and reverse privacy ---");

  const banned = await api("GET", feedPath(fixture.users.banned));

  expectStatus(
    "empty: a banned student still receives a feed response",
    banned,
    200,
  );
  expectEqual(
    "empty: a banned student's feed is empty",
    feedItemIds(banned.body).length,
    0,
  );
  expectEqual(
    "empty: a banned student's feed has no cursor",
    asRecord(banned.body)["nextCursor"],
    null,
  );
  expectEqual(
    "empty: a banned student's feed considered no candidates",
    readNumber(banned.body, "candidatesConsidered"),
    0,
  );
  expectTrue(
    "empty: a banned student's feed never leaks a post",
    !containsText(banned.body, fixture.posts.baseline),
  );

  const waiting = await api("GET", feedPath(fixture.users.waiting));

  expectStatus(
    "empty: a pending member still receives a feed response",
    waiting,
    200,
  );

  const waitingItems = readItems(waiting.body);

  expectTrue(
    "empty: a pending membership contributes no candidate",
    !containsText(waiting.body, fixture.posts.baseline),
  );
  expectTrue(
    "empty: a pending membership never appears in the payload",
    !containsText(waiting.body, fixture.communities.publicA),
  );
  expectTrue(
    "empty: an active membership still contributes candidates",
    waitingItems.length > 0,
  );
  expectTrue(
    "empty: every item comes from the community the actor is active in",
    waitingItems.every(
      (item) =>
        asRecord(item["community"])["id"] === fixture.communities.publicB,
    ),
  );
  expectEqual(
    "empty: a pending member still receives a full default page",
    waitingItems.length,
    FEED_DEFAULT_LIMIT,
  );

  const outsider = await api("GET", feedPath(fixture.users.outsider));

  expectStatus(
    "privacy: the owner of another private community responds 200",
    outsider,
    200,
  );

  const outsiderIds = feedItemIds(outsider.body);

  expectEqual(
    "privacy: the other private community's owner sees a single post",
    outsiderIds.length,
    1,
  );
  expectEqual(
    "privacy: the other private community's owner sees their own post",
    outsiderIds[0],
    fixture.posts.privateOtherPost,
  );
  expectEqual(
    "privacy: the other private community's owner considered one candidate",
    readNumber(outsider.body, "candidatesConsidered"),
    1,
  );
  expectTrue(
    "privacy: no community the other owner cannot read appears",
    !containsText(outsider.body, fixture.communities.publicA) &&
      !containsText(outsider.body, fixture.communities.publicB) &&
      !containsText(outsider.body, fixture.communities.privateActive) &&
      !containsText(outsider.body, fixture.communities.privatePending),
  );
  expectTrue(
    "privacy: no post the other owner cannot read appears",
    !containsText(outsider.body, fixture.posts.baseline) &&
      !containsText(outsider.body, fixture.posts.tierOwner) &&
      !containsText(outsider.body, fixture.posts.privatePendingPost),
  );
}

/**
 * Removes every row created by this run. Deletion starts at the leaf tables so
 * foreign keys are never violated, even when a check failed early.
 */
async function cleanup(context: SmokeContext): Promise<void> {
  console.log("\n--- cleanup ---");

  try {
    const postReactions = await prisma.postReaction.deleteMany({
      where: {
        OR: [
          { postId: { in: context.postIds } },
          { userId: { in: context.userIds } },
        ],
      },
    });

    const commentReactions = await prisma.commentReaction.deleteMany({
      where: {
        OR: [
          { commentId: { in: context.commentIds } },
          { userId: { in: context.userIds } },
        ],
      },
    });

    const comments = await prisma.comment.deleteMany({
      where: {
        OR: [
          { id: { in: context.commentIds } },
          { postId: { in: context.postIds } },
          { authorId: { in: context.userIds } },
        ],
      },
    });

    const posts = await prisma.post.deleteMany({
      where: {
        OR: [
          { id: { in: context.postIds } },
          { communityId: { in: context.communityIds } },
          { authorId: { in: context.userIds } },
        ],
      },
    });

    const memberships = await prisma.communityMembership.deleteMany({
      where: {
        OR: [
          { communityId: { in: context.communityIds } },
          { userId: { in: context.userIds } },
        ],
      },
    });

    const connections = await prisma.connection.deleteMany({
      where: {
        OR: [
          { id: { in: context.connectionIds } },
          { requesterId: { in: context.userIds } },
          { receiverId: { in: context.userIds } },
        ],
      },
    });

    const studentSkills = await prisma.studentSkill.deleteMany({
      where: { studentId: { in: context.userIds } },
    });

    const studentInterests = await prisma.studentInterest.deleteMany({
      where: { studentId: { in: context.userIds } },
    });

    const communities = await prisma.community.deleteMany({
      where: { id: { in: context.communityIds } },
    });

    const profiles = await prisma.studentProfile.deleteMany({
      where: { userId: { in: context.userIds } },
    });

    const users = await prisma.user.deleteMany({
      where: { id: { in: context.userIds } },
    });

    const skills = await prisma.skill.deleteMany({
      where: { id: { in: context.skillIds } },
    });

    const interests = await prisma.interest.deleteMany({
      where: { id: { in: context.interestIds } },
    });

    console.log(
      `removed ${postReactions.count} post reactions, ` +
        `${commentReactions.count} comment reactions, ` +
        `${comments.count} comments, ${posts.count} posts, ` +
        `${memberships.count} memberships, ${connections.count} connections, ` +
        `${studentSkills.count} student skills, ` +
        `${studentInterests.count} student interests, ` +
        `${communities.count} communities, ${profiles.count} profiles, ` +
        `${users.count} users, ${skills.count} skills, ` +
        `${interests.count} interests`,
    );
  } catch (error) {
    console.error("cleanup failed", error);
    process.exitCode = 1;
  }
}

/** Confirms that nothing created by this run survived, and that nothing else was lost. */
async function auditCleanup(
  context: SmokeContext,
  baseline: BaselineCounts,
): Promise<void> {
  console.log("\n--- cleanup audit ---");

  const userIds = context.userIds;
  const communityIds = context.communityIds;
  const postIds = context.postIds;
  const commentIds = context.commentIds;

  const leftoverUsers = await prisma.user.count({
    where: { id: { in: userIds } },
  });
  const leftoverProfiles = await prisma.studentProfile.count({
    where: { userId: { in: userIds } },
  });
  const leftoverCommunities = await prisma.community.count({
    where: { id: { in: communityIds } },
  });
  const leftoverMemberships = await prisma.communityMembership.count({
    where: {
      OR: [
        { communityId: { in: communityIds } },
        { userId: { in: userIds } },
      ],
    },
  });
  const leftoverPosts = await prisma.post.count({
    where: {
      OR: [
        { id: { in: postIds } },
        { communityId: { in: communityIds } },
        { authorId: { in: userIds } },
      ],
    },
  });
  const leftoverComments = await prisma.comment.count({
    where: {
      OR: [
        { id: { in: commentIds } },
        { postId: { in: postIds } },
        { authorId: { in: userIds } },
      ],
    },
  });
  const leftoverPostReactions = await prisma.postReaction.count({
    where: {
      OR: [{ postId: { in: postIds } }, { userId: { in: userIds } }],
    },
  });
  const leftoverCommentReactions = await prisma.commentReaction.count({
    where: {
      OR: [{ commentId: { in: commentIds } }, { userId: { in: userIds } }],
    },
  });
  const leftoverConnections = await prisma.connection.count({
    where: {
      OR: [
        { id: { in: context.connectionIds } },
        { requesterId: { in: userIds } },
        { receiverId: { in: userIds } },
      ],
    },
  });
  const leftoverStudentSkills = await prisma.studentSkill.count({
    where: { studentId: { in: userIds } },
  });
  const leftoverStudentInterests = await prisma.studentInterest.count({
    where: { studentId: { in: userIds } },
  });
  const leftoverUsersByEmail = await prisma.user.count({
    where: { email: { startsWith: RUN_ID } },
  });
  const leftoverCommunitiesBySlug = await prisma.community.count({
    where: { slug: { startsWith: RUN_ID } },
  });
  const leftoverSkills = await prisma.skill.count({
    where: { id: { in: context.skillIds } },
  });
  const leftoverInterests = await prisma.interest.count({
    where: { id: { in: context.interestIds } },
  });

  expectEqual("audit: leftover test users", leftoverUsers, 0);
  expectEqual("audit: leftover test student profiles", leftoverProfiles, 0);
  expectEqual("audit: leftover test communities", leftoverCommunities, 0);
  expectEqual("audit: leftover test memberships", leftoverMemberships, 0);
  expectEqual("audit: leftover test posts", leftoverPosts, 0);
  expectEqual("audit: leftover test comments", leftoverComments, 0);
  expectEqual("audit: leftover test post reactions", leftoverPostReactions, 0);
  expectEqual(
    "audit: leftover test comment reactions",
    leftoverCommentReactions,
    0,
  );
  expectEqual("audit: leftover test connections", leftoverConnections, 0);
  expectEqual("audit: leftover test student skills", leftoverStudentSkills, 0);
  expectEqual(
    "audit: leftover test student interests",
    leftoverStudentInterests,
    0,
  );
  expectEqual(
    "audit: leftover test users by email prefix",
    leftoverUsersByEmail,
    0,
  );
  expectEqual(
    "audit: leftover test communities by slug prefix",
    leftoverCommunitiesBySlug,
    0,
  );
  expectEqual("audit: leftover test skills", leftoverSkills, 0);
  expectEqual("audit: leftover test interests", leftoverInterests, 0);

  const currentUsers = await prisma.user.count();
  const currentProfiles = await prisma.studentProfile.count();
  const currentCommunities = await prisma.community.count();
  const currentMemberships = await prisma.communityMembership.count();
  const currentPosts = await prisma.post.count();
  const currentComments = await prisma.comment.count();
  const currentPostReactions = await prisma.postReaction.count();
  const currentConnections = await prisma.connection.count();

  expectTrue(
    "audit: pre-existing users were not deleted",
    currentUsers >= baseline.users,
    { baseline: baseline.users, current: currentUsers },
  );
  expectTrue(
    "audit: pre-existing student profiles were not deleted",
    currentProfiles >= baseline.profiles,
    { baseline: baseline.profiles, current: currentProfiles },
  );
  expectTrue(
    "audit: pre-existing communities were not deleted",
    currentCommunities >= baseline.communities,
    { baseline: baseline.communities, current: currentCommunities },
  );
  expectTrue(
    "audit: pre-existing memberships were not deleted",
    currentMemberships >= baseline.memberships,
    { baseline: baseline.memberships, current: currentMemberships },
  );
  expectTrue(
    "audit: pre-existing posts were not deleted",
    currentPosts >= baseline.posts,
    { baseline: baseline.posts, current: currentPosts },
  );
  expectTrue(
    "audit: pre-existing comments were not deleted",
    currentComments >= baseline.comments,
    { baseline: baseline.comments, current: currentComments },
  );
  expectTrue(
    "audit: pre-existing post reactions were not deleted",
    currentPostReactions >= baseline.postReactions,
    { baseline: baseline.postReactions, current: currentPostReactions },
  );
  expectTrue(
    "audit: pre-existing connections were not deleted",
    currentConnections >= baseline.connections,
    { baseline: baseline.connections, current: currentConnections },
  );
}

async function main(): Promise<void> {
  console.log(`BridgeEd feed smoke test :: ${RUN_ID}`);
  console.log(`target ${API_BASE_URL}${API_PREFIX}`);

  const context: SmokeContext = {
    userIds: [],
    communityIds: [],
    postIds: [],
    commentIds: [],
    skillIds: [],
    interestIds: [],
    connectionIds: [],
  };

  const baseline: BaselineCounts = {
    users: await prisma.user.count(),
    profiles: await prisma.studentProfile.count(),
    communities: await prisma.community.count(),
    memberships: await prisma.communityMembership.count(),
    posts: await prisma.post.count(),
    comments: await prisma.comment.count(),
    postReactions: await prisma.postReaction.count(),
    connections: await prisma.connection.count(),
  };

  try {
    const fixture = await setup(context);
    const walk = await runCandidacyChecks(fixture);

    runOrderingChecks(walk, fixture);
    runReasonChecks(walk, fixture);
    await runStabilityChecks(walk, fixture);
    await runLimitChecks(walk, fixture);
    await runCursorChecks(walk, fixture);
    await runCountConsistencyChecks(walk, fixture);
    await runEmptyFeedChecks(fixture);
  } finally {
    await cleanup(context);
    await auditCleanup(context, baseline);
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
