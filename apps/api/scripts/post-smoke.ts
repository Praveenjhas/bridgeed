/**
 * BridgeEd posts + comments + reactions live smoke test.
 *
 * Usage:
 *   1. Make sure PostgreSQL is running and `npm run dev --workspace=apps/api`
 *      (or `npx tsx src/server.ts`) is serving the API.
 *   2. Run `npm run smoke:post --workspace=apps/api`
 *
 * Optional environment variables:
 *   API_BASE_URL (default http://localhost:4000)
 *
 * Every row created by this script is prefixed with a unique RUN_ID and removed
 * again in the cleanup step, even when a check fails.
 */
import {
  COMMUNITY_MEMBER_ROLES,
  COMMUNITY_MEMBERSHIP_STATUSES,
  COMMUNITY_TYPES,
  POST_TYPES,
  REACTION_TYPES,
} from "@bridgeed/shared";
import { prisma } from "../src/config/prisma";
import { REACTION_ALREADY_EXISTS_MESSAGE } from "../src/repositories/post-reaction.repository";
import {
  COMMENT_AUTHOR_REQUIRED_MESSAGE,
  COMMENT_CONTENT_INVALID_MESSAGE,
  COMMENT_CONTENT_REQUIRED_MESSAGE,
  COMMENT_CONTENT_TOO_LONG_MESSAGE,
  COMMENT_DELETED_MESSAGE,
  COMMENT_DELETE_FORBIDDEN_MESSAGE,
  COMMENT_EDIT_FORBIDDEN_MESSAGE,
  COMMENT_NOT_FOUND_MESSAGE,
} from "../src/services/comment.service";
import { NOT_ACTIVE_MEMBER_MESSAGE } from "../src/services/community-membership.service";
import {
  COMMUNITY_NOT_FOUND_MESSAGE,
  STUDENT_PROFILE_NOT_FOUND_MESSAGE,
} from "../src/services/community.service";
import {
  POST_AUTHOR_REQUIRED_MESSAGE,
  POST_CONTENT_INVALID_MESSAGE,
  POST_CONTENT_REQUIRED_MESSAGE,
  POST_CONTENT_TOO_LONG_MESSAGE,
  POST_DELETED_MESSAGE,
  POST_DELETE_FORBIDDEN_MESSAGE,
  POST_EDIT_FORBIDDEN_MESSAGE,
  POST_NOT_FOUND_MESSAGE,
  POST_TYPE_INVALID_MESSAGE,
} from "../src/services/post.service";
import {
  REACTION_NOT_FOUND_MESSAGE,
  REACTION_TYPE_INVALID_MESSAGE,
  REACTION_USER_REQUIRED_MESSAGE,
} from "../src/services/reaction.service";

/** Messages produced by the HTTP layer (validation handled in controllers). */
const HTTP_MESSAGES = {
  invalidCommunityId: "Invalid community ID",
  invalidPostId: "Invalid post ID",
  invalidCommentId: "Invalid comment ID",
  actorIdRequired: "actorId is required",
  invalidPagination: "page and limit must be positive integers",
};

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const API_PREFIX = "/api/v1";
const RUN_ID = `pst${Date.now().toString(36)}${Math.random()
  .toString(36)
  .slice(2, 7)}`;

const MAX_POST_CONTENT_LENGTH = 5000;
const MAX_COMMENT_CONTENT_LENGTH = 2000;

interface ApiResult {
  status: number;
  body: unknown;
}

interface SmokeContext {
  userIds: string[];
  communityIds: string[];
  postIds: string[];
  commentIds: string[];
  universityIds: string[];
  skillIds: string[];
  interestIds: string[];
  connectionIds: string[];
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
      body === undefined
        ? undefined
        : { "Content-Type": "application/json" },
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

function readItems(value: unknown): Record<string, unknown>[] {
  const items = asRecord(value)["items"];

  return Array.isArray(items) ? items.map(asRecord) : [];
}

function hasItemWithId(
  items: Record<string, unknown>[],
  id: string,
  key = "id",
): boolean {
  return items.some((item) => item[key] === id);
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

async function createStudent(
  context: SmokeContext,
  label: string,
): Promise<string> {
  const userResult = await api("POST", "/users", {
    email: `${RUN_ID}-${label}@bridgeed-smoke.test`,
    role: "USER",
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

  const id = await requireCreatedId(`setup: create community ${label}`, result, 201);

  context.communityIds.push(id);

  return id;
}

async function joinCommunity(
  label: string,
  communityId: string,
  userId: string,
  expectedStatus = 201,
): Promise<string> {
  const result = await api("POST", `/communities/${communityId}/join`, {
    userId,
  });

  return requireCreatedId(`setup: ${label}`, result, expectedStatus);
}

/** Direct database setup for states the API intentionally cannot produce. */
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

async function seedMembership(
  label: string,
  membershipId: string,
  data: {
    role?: string;
    status?: string;
  },
): Promise<void> {
  const expectedRole = data.role === undefined ? undefined : toDatabaseRole(data.role);
  const expectedStatus =
    data.status === undefined ? undefined : toDatabaseStatus(data.status);

  const updated = await prisma.communityMembership.update({
    where: { id: membershipId },
    data: {
      ...(expectedRole === undefined ? {} : { role: expectedRole }),
      ...(expectedStatus === undefined ? {} : { status: expectedStatus }),
    },
    select: { role: true, status: true },
  });

  record(
    `setup: membership state seeded (${label})`,
    (expectedRole === undefined || updated.role === expectedRole) &&
      (expectedStatus === undefined || updated.status === expectedStatus),
    { expected: data, actual: updated },
  );
}

interface SmokeUsers {
  owner: string;
  alice: string;
  bob: string;
  carol: string;
  dave: string;
  erin: string;
  frank: string;
  grace: string;
  hank: string;
  ivan: string;
  admin: string;
  moderator: string;
}

interface PublicMemberships {
  owner: string;
  alice: string;
  admin: string;
  moderator: string;
  bob: string;
  carol: string;
  dave: string;
  erin: string;
}

interface PrivateMemberships {
  owner: string;
  alice: string;
  grace: string;
  hank: string;
  ivan: string;
}

interface SmokeFixture {
  users: SmokeUsers;
  publicId: string;
  privateId: string;
  publicMemberships: PublicMemberships;
  privateMemberships: PrivateMemberships;
}

/** Reads the membership id of a student from the student communities endpoint. */
async function findMembershipId(
  label: string,
  userId: string,
  communityId: string,
): Promise<string> {
  const result = await api("GET", `/student-profiles/${userId}/communities`);

  expectStatus(label, result, 200);

  const membership = asArray(result.body).find(
    (item) => asRecord(item["community"])["id"] === communityId,
  );
  const id = membership ? readString(membership, "id") : null;

  if (!id) {
    throw new Error(`${label}: membership was not found`);
  }

  return id;
}

async function setup(context: SmokeContext): Promise<SmokeFixture> {
  console.log("\n--- setup ---");

  const users: SmokeUsers = {
    owner: await createStudent(context, "owner"),
    alice: await createStudent(context, "alice"),
    bob: await createStudent(context, "bob"),
    carol: await createStudent(context, "carol"),
    dave: await createStudent(context, "dave"),
    erin: await createStudent(context, "erin"),
    frank: await createStudent(context, "frank"),
    grace: await createStudent(context, "grace"),
    hank: await createStudent(context, "hank"),
    ivan: await createStudent(context, "ivan"),
    admin: await createStudent(context, "admin"),
    moderator: await createStudent(context, "moderator"),
  };

  const publicId = await createCommunity(
    context,
    "public",
    users.owner,
    COMMUNITY_TYPES.PUBLIC,
  );
  const privateId = await createCommunity(
    context,
    "private",
    users.owner,
    COMMUNITY_TYPES.PRIVATE,
  );

  const publicMemberships: PublicMemberships = {
    owner: await findMembershipId(
      "setup: owner membership in public",
      users.owner,
      publicId,
    ),
    alice: await joinCommunity("alice joins public", publicId, users.alice),
    admin: await joinCommunity("admin joins public", publicId, users.admin),
    moderator: await joinCommunity(
      "moderator joins public",
      publicId,
      users.moderator,
    ),
    bob: await joinCommunity("bob joins public", publicId, users.bob),
    carol: await joinCommunity("carol joins public", publicId, users.carol),
    dave: await joinCommunity("dave joins public", publicId, users.dave),
    erin: await joinCommunity("erin joins public", publicId, users.erin),
  };

  // Roles and membership states the API intentionally cannot produce are
  // seeded directly, so authorization can be verified against real rows.
  await seedMembership("admin role", publicMemberships.admin, {
    role: COMMUNITY_MEMBER_ROLES.ADMIN,
  });
  await seedMembership("moderator role", publicMemberships.moderator, {
    role: COMMUNITY_MEMBER_ROLES.MODERATOR,
  });
  await seedMembership("carol pending", publicMemberships.carol, {
    status: COMMUNITY_MEMBERSHIP_STATUSES.PENDING,
  });
  await seedMembership("dave rejected", publicMemberships.dave, {
    status: COMMUNITY_MEMBERSHIP_STATUSES.REJECTED,
  });
  await seedMembership("erin banned", publicMemberships.erin, {
    status: COMMUNITY_MEMBERSHIP_STATUSES.BANNED,
  });

  // A private community keeps everyone pending until the owner decides.
  const privateMemberships: PrivateMemberships = {
    owner: await findMembershipId(
      "setup: owner membership in private",
      users.owner,
      privateId,
    ),
    alice: await joinCommunity("alice requests private", privateId, users.alice),
    grace: await joinCommunity("grace requests private", privateId, users.grace),
    hank: await joinCommunity("hank requests private", privateId, users.hank),
    ivan: await joinCommunity("ivan requests private", privateId, users.ivan),
  };

  const privateAlice = asRecord(
    (
      await api("PATCH", `/community-memberships/${privateMemberships.alice}/approve`, {
        actorId: users.owner,
      })
    ).body,
  );

  expectEqual(
    "setup: private membership approved by the owner becomes active",
    privateAlice["status"],
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );

  const privateHank = asRecord(
    (
      await api("PATCH", `/community-memberships/${privateMemberships.hank}/reject`, {
        actorId: users.owner,
      })
    ).body,
  );

  expectEqual(
    "setup: private membership rejected by the owner",
    privateHank["status"],
    COMMUNITY_MEMBERSHIP_STATUSES.REJECTED,
  );

  await seedMembership("ivan banned", privateMemberships.ivan, {
    status: COMMUNITY_MEMBERSHIP_STATUSES.BANNED,
  });

  return {
    users,
    publicId,
    privateId,
    publicMemberships,
    privateMemberships,
  };
}

interface CreatedPosts {
  ownerPostId: string;
  alicePostId: string;
  adminPostId: string;
  moderatorPostId: string;
  bobPostId: string;
  detailedPostId: string;
  maxLengthPostId: string;
}

function isIsoTimestamp(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const parsed = new Date(value);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

async function runPostCreationChecks(
  context: SmokeContext,
  fixture: SmokeFixture,
): Promise<CreatedPosts> {
  console.log("\n--- post creation ---");

  const { users, publicId } = fixture;
  const postsPath = `/communities/${publicId}/posts`;

  const ownerPost = await api("POST", postsPath, {
    authorId: users.owner,
    content: "   Owner announcement for the smoke run   ",
  });
  const ownerPostId = await requireCreatedId(
    "post: owner creates a post",
    ownerPost,
    201,
  );
  context.postIds.push(ownerPostId);

  expectEqual(
    "post: content is trimmed",
    readString(ownerPost.body, "content"),
    "Owner announcement for the smoke run",
  );
  expectEqual(
    "post: type is always text",
    readString(ownerPost.body, "type"),
    POST_TYPES.TEXT,
  );
  expectEqual(
    "post: post belongs to the target community",
    readString(ownerPost.body, "communityId"),
    publicId,
  );
  expectEqual(
    "post: author is the acting student",
    readString(ownerPost.body, "authorId"),
    users.owner,
  );
  expectEqual(
    "post: deletedAt starts empty",
    asRecord(ownerPost.body)["deletedAt"],
    null,
  );
  expectTrue(
    "post: createdAt is an ISO timestamp",
    isIsoTimestamp(readString(ownerPost.body, "createdAt")),
  );
  expectTrue(
    "post: updatedAt is an ISO timestamp",
    isIsoTimestamp(readString(ownerPost.body, "updatedAt")),
  );
  expectTrue(
    "post: creation response never leaks an email",
    !containsText(ownerPost.body, "@bridgeed-smoke.test"),
  );

  const explicitTextType = await api("POST", postsPath, {
    authorId: users.owner,
    content: "Explicit text type is accepted",
    type: POST_TYPES.TEXT,
  });

  expectStatus("post: explicit text type is accepted", explicitTextType, 201);

  const explicitTextTypeId = readString(explicitTextType.body, "id");

  if (explicitTextTypeId) {
    context.postIds.push(explicitTextTypeId);
  }

  expectError(
    "post: unsupported post type is rejected",
    await api("POST", postsPath, {
      authorId: users.owner,
      content: "Image posts do not exist yet",
      type: "image",
    }),
    400,
    POST_TYPE_INVALID_MESSAGE,
  );

  const alicePost = await api("POST", postsPath, {
    authorId: users.alice,
    content: "Alice detailed post for counts",
  });
  const alicePostId = await requireCreatedId(
    "post: active member creates a post",
    alicePost,
    201,
  );
  context.postIds.push(alicePostId);

  const adminPost = await api("POST", postsPath, {
    authorId: users.admin,
    content: "Admin announcement",
  });
  const adminPostId = await requireCreatedId(
    "post: admin membership creates a post",
    adminPost,
    201,
  );
  context.postIds.push(adminPostId);

  const moderatorPost = await api("POST", postsPath, {
    authorId: users.moderator,
    content: "Moderator announcement",
  });
  const moderatorPostId = await requireCreatedId(
    "post: moderator membership creates a post",
    moderatorPost,
    201,
  );
  context.postIds.push(moderatorPostId);

  const bobPost = await api("POST", postsPath, {
    authorId: users.bob,
    content: "Bob post used for ownership checks",
  });
  const bobPostId = await requireCreatedId(
    "post: plain member creates a post",
    bobPost,
    201,
  );
  context.postIds.push(bobPostId);

  expectError(
    "post: pending membership cannot create a post",
    await api("POST", postsPath, {
      authorId: users.carol,
      content: "Pending members cannot post",
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );

  expectError(
    "post: rejected membership cannot create a post",
    await api("POST", postsPath, {
      authorId: users.dave,
      content: "Rejected members cannot post",
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );

  expectError(
    "post: banned membership cannot create a post",
    await api("POST", postsPath, {
      authorId: users.erin,
      content: "Banned members cannot post",
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );

  expectError(
    "post: non-member cannot create a post",
    await api("POST", postsPath, {
      authorId: users.frank,
      content: "Outsiders cannot post",
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );

  expectError(
    "post: a forged owner role in the payload is ignored",
    await api("POST", postsPath, {
      authorId: users.carol,
      content: "Forged owner role",
      role: COMMUNITY_MEMBER_ROLES.OWNER,
      status: COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
      membershipId: fixture.publicMemberships.owner,
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );

  expectError(
    "post: a forged admin role in the payload is ignored",
    await api("POST", postsPath, {
      authorId: users.dave,
      content: "Forged admin role",
      role: COMMUNITY_MEMBER_ROLES.ADMIN,
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );

  expectError(
    "post: unknown community returns 404",
    await api(
      "POST",
      "/communities/00000000-0000-4000-8000-000000000000/posts",
      {
        authorId: users.owner,
        content: "Unknown community",
      },
    ),
    404,
    COMMUNITY_NOT_FOUND_MESSAGE,
  );

  expectError(
    "post: unknown author returns 404",
    await api("POST", postsPath, {
      authorId: "00000000-0000-4000-8000-000000000000",
      content: "Unknown author",
    }),
    404,
    STUDENT_PROFILE_NOT_FOUND_MESSAGE,
  );

  expectError(
    "post: missing authorId returns 400",
    await api("POST", postsPath, { content: "No author" }),
    400,
    POST_AUTHOR_REQUIRED_MESSAGE,
  );

  expectError(
    "post: missing content returns 400",
    await api("POST", postsPath, { authorId: users.owner }),
    400,
    POST_CONTENT_INVALID_MESSAGE,
  );

  expectError(
    "post: empty content returns 400",
    await api("POST", postsPath, { authorId: users.owner, content: "" }),
    400,
    POST_CONTENT_REQUIRED_MESSAGE,
  );

  expectError(
    "post: whitespace-only content returns 400",
    await api("POST", postsPath, {
      authorId: users.owner,
      content: "   \n\t  ",
    }),
    400,
    POST_CONTENT_REQUIRED_MESSAGE,
  );

  expectError(
    "post: content longer than 5000 characters returns 400",
    await api("POST", postsPath, {
      authorId: users.owner,
      content: "x".repeat(MAX_POST_CONTENT_LENGTH + 1),
    }),
    400,
    POST_CONTENT_TOO_LONG_MESSAGE,
  );

  const maxLengthPost = await api("POST", postsPath, {
    authorId: users.owner,
    content: ` ${"y".repeat(MAX_POST_CONTENT_LENGTH)} `,
  });
  const maxLengthPostId = await requireCreatedId(
    "post: content of exactly 5000 characters is accepted",
    maxLengthPost,
    201,
  );
  context.postIds.push(maxLengthPostId);

  expectEqual(
    "post: maximum length content is kept intact after trimming",
    readString(maxLengthPost.body, "content")?.length,
    MAX_POST_CONTENT_LENGTH,
  );

  return {
    ownerPostId,
    alicePostId,
    adminPostId,
    moderatorPostId,
    bobPostId,
    detailedPostId: alicePostId,
    maxLengthPostId,
  };
}

async function runListingChecks(
  context: SmokeContext,
  fixture: SmokeFixture,
): Promise<void> {
  console.log("\n--- post listing ---");

  const { users, publicId } = fixture;
  const postsPath = `/communities/${publicId}/posts`;
  const listPath = `${postsPath}?actorId=${users.owner}`;

  const firstPage = await api("GET", listPath);

  expectStatus("listing: owner can list community posts", firstPage, 200);
  expectEqual(
    "listing: page defaults to 1",
    readNumber(firstPage.body, "page"),
    1,
  );
  expectEqual(
    "listing: limit defaults to 20",
    readNumber(firstPage.body, "limit"),
    20,
  );
  expectTrue(
    "listing: total is a number",
    typeof readNumber(firstPage.body, "total") === "number",
  );
  expectTrue(
    "listing: totalPages is a number",
    typeof readNumber(firstPage.body, "totalPages") === "number",
  );
  expectTrue(
    "listing: items are returned",
    readItems(firstPage.body).length > 0,
    { items: readItems(firstPage.body).length },
  );

  // Deterministic ordering: two fresh posts with distinct timestamps.
  const older = await api("POST", postsPath, {
    authorId: users.owner,
    content: "Ordering check older post",
  });
  const olderId = await requireCreatedId(
    "listing: ordering setup creates the older post",
    older,
    201,
  );
  context.postIds.push(olderId);

  await sleep(35);

  const newer = await api("POST", postsPath, {
    authorId: users.owner,
    content: "Ordering check newer post",
  });
  const newerId = await requireCreatedId(
    "listing: ordering setup creates the newer post",
    newer,
    201,
  );
  context.postIds.push(newerId);

  const ordered = await api("GET", listPath);
  const orderedItems = readItems(ordered.body);

  expectEqual(
    "listing: newest post is listed first",
    orderedItems[0]?.["id"],
    newerId,
  );
  expectEqual(
    "listing: the older post follows it",
    orderedItems[1]?.["id"],
    olderId,
  );
  expectTrue(
    "listing: order is newest first by createdAt",
    orderedItems.every((item, index) => {
      const current = item["createdAt"];
      const next = orderedItems[index + 1]?.["createdAt"];

      if (typeof current !== "string" || typeof next !== "string") {
        return true;
      }

      return current >= next;
    }),
  );

  const expectedTotal = context.postIds.length;

  expectEqual(
    "listing: total counts the posts created so far",
    readNumber(ordered.body, "total"),
    expectedTotal,
  );
  expectEqual(
    "listing: totalPages matches total and limit",
    readNumber(ordered.body, "totalPages"),
    Math.ceil(expectedTotal / 20),
  );

  const limited = await api(
    "GET",
    `${postsPath}?actorId=${users.owner}&limit=2`,
  );

  expectStatus("listing: limit is honoured", limited, 200);
  expectEqual("listing: limited page size", readItems(limited.body).length, 2);
  expectEqual(
    "listing: requested limit is echoed",
    readNumber(limited.body, "limit"),
    2,
  );
  expectEqual(
    "listing: total stays the full count",
    readNumber(limited.body, "total"),
    expectedTotal,
  );

  const secondPage = await api(
    "GET",
    `${postsPath}?actorId=${users.owner}&page=2&limit=2`,
  );
  const secondPageItems = readItems(secondPage.body);

  expectStatus("listing: second page can be read", secondPage, 200);
  expectEqual(
    "listing: second page reports its number",
    readNumber(secondPage.body, "page"),
    2,
  );
  expectEqual("listing: second page size", secondPageItems.length, 2);
  expectTrue(
    "listing: pages do not repeat the same post",
    secondPageItems[0]?.["id"] !== readItems(limited.body)[0]?.["id"],
  );

  const clamped = await api(
    "GET",
    `${postsPath}?actorId=${users.owner}&limit=500`,
  );

  expectStatus("listing: oversized limit is accepted", clamped, 200);
  expectEqual(
    "listing: oversized limit is clamped to the shared maximum",
    readNumber(clamped.body, "limit"),
    100,
  );

  expectError(
    "listing: page 0 is rejected",
    await api("GET", `${postsPath}?actorId=${users.owner}&page=0`),
    400,
    HTTP_MESSAGES.invalidPagination,
  );
  expectError(
    "listing: negative page is rejected",
    await api("GET", `${postsPath}?actorId=${users.owner}&page=-3`),
    400,
    HTTP_MESSAGES.invalidPagination,
  );
  expectError(
    "listing: non numeric limit is rejected",
    await api("GET", `${postsPath}?actorId=${users.owner}&limit=abc`),
    400,
    HTTP_MESSAGES.invalidPagination,
  );
  expectError(
    "listing: zero limit is rejected",
    await api("GET", `${postsPath}?actorId=${users.owner}&limit=0`),
    400,
    HTTP_MESSAGES.invalidPagination,
  );
  expectError(
    "listing: missing actor is rejected",
    await api("GET", postsPath),
    400,
    HTTP_MESSAGES.actorIdRequired,
  );
  expectError(
    "listing: unknown community returns 404",
    await api(
      "GET",
      `/communities/00000000-0000-4000-8000-000000000000/posts?actorId=${users.owner}`,
    ),
    404,
    COMMUNITY_NOT_FOUND_MESSAGE,
  );
  expectError(
    "listing: pending membership cannot read posts",
    await api("GET", `${postsPath}?actorId=${users.carol}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "listing: rejected membership cannot read posts",
    await api("GET", `${postsPath}?actorId=${users.dave}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "listing: banned membership cannot read posts",
    await api("GET", `${postsPath}?actorId=${users.erin}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "listing: non-member cannot read posts",
    await api("GET", `${postsPath}?actorId=${users.frank}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );

  const listedItem = findItemWithId(orderedItems, newerId) ?? {};
  const listedAuthor = asRecord(listedItem["author"]);

  expectEqual(
    "listing: item exposes the community id",
    listedItem["communityId"],
    publicId,
  );
  expectEqual(
    "listing: item exposes the post type",
    listedItem["type"],
    POST_TYPES.TEXT,
  );
  expectEqual("listing: item exposes deletedAt", listedItem["deletedAt"], null);
  expectTrue(
    "listing: item exposes commentCount",
    typeof listedItem["commentCount"] === "number",
  );
  expectTrue(
    "listing: item exposes likeCount",
    typeof listedItem["likeCount"] === "number",
  );
  expectEqual(
    "listing: commentCount starts at zero",
    listedItem["commentCount"],
    0,
  );
  expectEqual("listing: likeCount starts at zero", listedItem["likeCount"], 0);
  expectEqual(
    "listing: author summary exposes the userId",
    listedAuthor["userId"],
    users.owner,
  );
  expectEqual(
    "listing: author summary exposes the name",
    readString(listedAuthor, "name"),
    "Smoke owner",
  );
  expectTrue(
    "listing: author summary exposes the username",
    typeof readString(listedAuthor, "username") === "string",
  );
  expectTrue(
    "listing: author summary never leaks an email",
    !containsText(listedItem, "@bridgeed-smoke.test"),
  );
}

async function runDetailsChecks(
  context: SmokeContext,
  fixture: SmokeFixture,
  posts: CreatedPosts,
): Promise<void> {
  console.log("\n--- post detail ---");

  const { users, publicId } = fixture;
  const postPath = `/posts/${posts.detailedPostId}`;

  const detail = await api("GET", `${postPath}?actorId=${users.bob}`);

  expectStatus("detail: active member can read a post", detail, 200);
  expectEqual(
    "detail: post id is stable",
    readString(detail.body, "id"),
    posts.detailedPostId,
  );
  expectEqual(
    "detail: content is returned",
    readString(detail.body, "content"),
    "Alice detailed post for counts",
  );
  expectEqual(
    "detail: type is text",
    readString(detail.body, "type"),
    POST_TYPES.TEXT,
  );
  expectEqual(
    "detail: author id",
    readString(detail.body, "authorId"),
    users.alice,
  );
  expectEqual(
    "detail: community id",
    readString(detail.body, "communityId"),
    publicId,
  );
  expectEqual(
    "detail: deletedAt is empty",
    asRecord(detail.body)["deletedAt"],
    null,
  );
  expectTrue(
    "detail: createdAt is an ISO timestamp",
    isIsoTimestamp(readString(detail.body, "createdAt")),
  );
  expectTrue(
    "detail: updatedAt is an ISO timestamp",
    isIsoTimestamp(readString(detail.body, "updatedAt")),
  );

  const author = asRecord(asRecord(detail.body)["author"]);

  expectEqual("detail: author userId", author["userId"], users.alice);
  expectEqual(
    "detail: author name",
    readString(author, "name"),
    "Smoke alice",
  );
  expectTrue(
    "detail: author username is returned",
    typeof readString(author, "username") === "string",
  );
  expectTrue(
    "detail: author exposes profileImageUrl",
    "profileImageUrl" in author,
  );
  expectTrue(
    "detail: author data never leaks an email",
    !containsText(detail.body, "@bridgeed-smoke.test"),
  );

  const community = asRecord(asRecord(detail.body)["community"]);

  expectEqual("detail: community id", community["id"], publicId);
  expectEqual(
    "detail: community name",
    readString(community, "name"),
    `Smoke public ${RUN_ID}`,
  );
  expectEqual(
    "detail: community slug",
    readString(community, "slug"),
    `${RUN_ID}-public`,
  );
  expectEqual(
    "detail: community type",
    readString(community, "type"),
    COMMUNITY_TYPES.PUBLIC,
  );
  expectEqual(
    "detail: commentCount starts at zero",
    readNumber(detail.body, "commentCount"),
    0,
  );
  expectEqual(
    "detail: likeCount starts at zero",
    readNumber(detail.body, "likeCount"),
    0,
  );

  expectError(
    "detail: pending membership cannot read the post",
    await api("GET", `${postPath}?actorId=${users.carol}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "detail: rejected membership cannot read the post",
    await api("GET", `${postPath}?actorId=${users.dave}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "detail: banned membership cannot read the post",
    await api("GET", `${postPath}?actorId=${users.erin}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "detail: non-member cannot read the post",
    await api("GET", `${postPath}?actorId=${users.frank}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "detail: unknown post returns 404",
    await api(
      "GET",
      `/posts/00000000-0000-4000-8000-000000000000?actorId=${users.bob}`,
    ),
    404,
    POST_NOT_FOUND_MESSAGE,
  );
  expectError(
    "detail: missing actor is rejected",
    await api("GET", postPath),
    400,
    HTTP_MESSAGES.actorIdRequired,
  );

  const detailByAuthor = await api("GET", `${postPath}?actorId=${users.alice}`);

  expectEqual(
    "detail: the author can read their own post",
    readString(detailByAuthor.body, "id"),
    posts.detailedPostId,
  );
}

async function runEditChecks(
  fixture: SmokeFixture,
  posts: CreatedPosts,
): Promise<void> {
  console.log("\n--- post edit ---");

  const { users } = fixture;
  const postPath = `/posts/${posts.bobPostId}`;

  const edited = await api("PATCH", postPath, {
    authorId: users.bob,
    content: "   Bob edited his own post   ",
  });

  expectStatus("edit: author can edit the post", edited, 200);
  expectEqual(
    "edit: content is trimmed",
    readString(edited.body, "content"),
    "Bob edited his own post",
  );
  expectTrue(
    "edit: updatedAt is an ISO timestamp",
    isIsoTimestamp(readString(edited.body, "updatedAt")),
  );
  expectTrue(
    "edit: updatedAt is not older than createdAt",
    String(readString(edited.body, "updatedAt")) >=
      String(readString(edited.body, "createdAt")),
  );
  expectEqual(
    "edit: author cannot be changed",
    readString(edited.body, "authorId"),
    users.bob,
  );
  expectEqual(
    "edit: community cannot be changed",
    readString(edited.body, "communityId"),
    fixture.publicId,
  );
  expectEqual(
    "edit: type is not changed by an edit",
    readString(edited.body, "type"),
    POST_TYPES.TEXT,
  );

  const typeChangeAttempt = await api("PATCH", postPath, {
    authorId: users.bob,
    content: "Bob tries to change the type",
    type: "image",
  });

  expectStatus("edit: content edit with a type field is accepted", typeChangeAttempt, 200);
  expectEqual(
    "edit: post type stays text even when the client sends a type",
    readString(typeChangeAttempt.body, "type"),
    POST_TYPES.TEXT,
  );

  const reread = await api("GET", `${postPath}?actorId=${users.bob}`);

  expectEqual(
    "edit: the new content is persisted",
    readString(reread.body, "content"),
    "Bob tries to change the type",
  );

  expectError(
    "edit: another active member cannot edit the post",
    await api("PATCH", postPath, {
      authorId: users.alice,
      content: "Alice edits Bob's post",
    }),
    403,
    POST_EDIT_FORBIDDEN_MESSAGE,
  );
  expectError(
    "edit: an admin cannot edit somebody else's post",
    await api("PATCH", postPath, {
      authorId: users.admin,
      content: "Admin edits Bob's post",
    }),
    403,
    POST_EDIT_FORBIDDEN_MESSAGE,
  );
  expectError(
    "edit: a moderator cannot edit somebody else's post",
    await api("PATCH", postPath, {
      authorId: users.moderator,
      content: "Moderator edits Bob's post",
    }),
    403,
    POST_EDIT_FORBIDDEN_MESSAGE,
  );
  expectError(
    "edit: a pending member cannot edit the post",
    await api("PATCH", postPath, {
      authorId: users.carol,
      content: "Pending edit",
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "edit: a non-member cannot edit the post",
    await api("PATCH", postPath, {
      authorId: users.frank,
      content: "Outsider edit",
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "edit: empty content is rejected",
    await api("PATCH", postPath, {
      authorId: users.bob,
      content: "   ",
    }),
    400,
    POST_CONTENT_REQUIRED_MESSAGE,
  );
  expectError(
    "edit: non string content is rejected",
    await api("PATCH", postPath, { authorId: users.bob, content: 42 }),
    400,
    POST_CONTENT_INVALID_MESSAGE,
  );
  expectError(
    "edit: missing content is rejected",
    await api("PATCH", postPath, { authorId: users.bob }),
    400,
    POST_CONTENT_INVALID_MESSAGE,
  );
  expectError(
    "edit: oversized content is rejected",
    await api("PATCH", postPath, {
      authorId: users.bob,
      content: "z".repeat(MAX_POST_CONTENT_LENGTH + 1),
    }),
    400,
    POST_CONTENT_TOO_LONG_MESSAGE,
  );
  expectError(
    "edit: unknown post returns 404",
    await api("PATCH", "/posts/00000000-0000-4000-8000-000000000000", {
      authorId: users.bob,
      content: "Unknown post",
    }),
    404,
    POST_NOT_FOUND_MESSAGE,
  );
  expectError(
    "edit: missing actor is rejected",
    await api("PATCH", postPath, { content: "No actor" }),
    400,
    HTTP_MESSAGES.actorIdRequired,
  );

  const stillOriginal = await api("GET", `${postPath}?actorId=${users.alice}`);

  expectEqual(
    "edit: rejected edits never modified the content",
    readString(stillOriginal.body, "content"),
    "Bob tries to change the type",
  );

  expectEqual(
    "edit: the stored type is still text",
    readString(stillOriginal.body, "type"),
    POST_TYPES.TEXT,
  );
}

async function runDeleteChecks(
  fixture: SmokeFixture,
  posts: CreatedPosts,
): Promise<void> {
  console.log("\n--- post delete ---");

  const { users, publicId } = fixture;
  const postPath = `/posts/${posts.bobPostId}`;
  const postsPath = `/communities/${publicId}/posts`;

  expectStatus(
    "delete: setup like on the post to be deleted",
    await api("POST", `${postPath}/reactions`, { userId: users.alice }),
    201,
  );

  expectError(
    "delete: another active member cannot delete the post",
    await api("DELETE", postPath, { actorId: users.alice }),
    403,
    POST_DELETE_FORBIDDEN_MESSAGE,
  );
  expectError(
    "delete: an admin cannot delete somebody else's post",
    await api("DELETE", postPath, { actorId: users.admin }),
    403,
    POST_DELETE_FORBIDDEN_MESSAGE,
  );
  expectError(
    "delete: a moderator cannot delete somebody else's post",
    await api("DELETE", postPath, { actorId: users.moderator }),
    403,
    POST_DELETE_FORBIDDEN_MESSAGE,
  );
  expectError(
    "delete: a non-member cannot delete the post",
    await api("DELETE", postPath, { actorId: users.frank }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "delete: unknown post returns 404",
    await api("DELETE", "/posts/00000000-0000-4000-8000-000000000000", {
      actorId: users.bob,
    }),
    404,
    POST_NOT_FOUND_MESSAGE,
  );
  expectError(
    "delete: missing actor is rejected",
    await api("DELETE", postPath, {}),
    400,
    HTTP_MESSAGES.actorIdRequired,
  );

  const before = await api("GET", `${postsPath}?actorId=${users.owner}`);
  const totalBefore = readNumber(before.body, "total") ?? 0;

  expectStatus(
    "delete: the author soft deletes the post",
    await api("DELETE", postPath, { actorId: users.bob }),
    204,
  );

  const after = await api(
    "GET",
    `${postsPath}?actorId=${users.owner}&limit=100`,
  );

  expectEqual(
    "delete: the deleted post disappears from the listing",
    hasItemWithId(readItems(after.body), posts.bobPostId),
    false,
  );
  expectEqual(
    "delete: the listing total decreases",
    readNumber(after.body, "total"),
    totalBefore - 1,
  );

  const deletedDetail = await api("GET", `${postPath}?actorId=${users.bob}`);

  expectError(
    "delete: the deleted post returns a conflict",
    deletedDetail,
    409,
    POST_DELETED_MESSAGE,
  );
  expectTrue(
    "delete: the deleted post detail never exposes the original content",
    !containsText(deletedDetail.body, "Bob tries to change the type"),
  );
  expectError(
    "delete: deleting twice returns a conflict",
    await api("DELETE", postPath, { actorId: users.bob }),
    409,
    POST_DELETED_MESSAGE,
  );
  expectError(
    "delete: a deleted post cannot be edited",
    await api("PATCH", postPath, {
      authorId: users.bob,
      content: "Edit after delete",
    }),
    409,
    POST_DELETED_MESSAGE,
  );
  expectError(
    "delete: a deleted post cannot be commented on",
    await api("POST", `${postPath}/comments`, {
      authorId: users.bob,
      content: "Comment after delete",
    }),
    409,
    POST_DELETED_MESSAGE,
  );
  expectError(
    "delete: comments of a deleted post cannot be listed",
    await api("GET", `${postPath}/comments?actorId=${users.bob}`),
    409,
    POST_DELETED_MESSAGE,
  );
  expectError(
    "delete: a deleted post cannot be liked",
    await api("POST", `${postPath}/reactions`, { userId: users.owner }),
    409,
    POST_DELETED_MESSAGE,
  );
  expectError(
    "delete: a deleted post cannot be unliked",
    await api("DELETE", `${postPath}/reactions`, { userId: users.alice }),
    409,
    POST_DELETED_MESSAGE,
  );

  const storedPost = await prisma.post.findUnique({
    where: { id: posts.bobPostId },
    select: { content: true, deletedAt: true },
  });

  expectTrue(
    "delete: the post row is only soft deleted",
    storedPost !== null && storedPost.deletedAt !== null,
    storedPost,
  );
  expectEqual(
    "delete: the content is not physically removed",
    storedPost?.content,
    "Bob tries to change the type",
  );

  const storedReactions = await prisma.postReaction.count({
    where: { postId: posts.bobPostId },
  });

  expectEqual(
    "delete: reactions of a deleted post remain valid rows",
    storedReactions,
    1,
  );
}

interface CreatedComments {
  aliceCommentId: string;
  ownerCommentId: string;
  bobCommentId: string;
  maxLengthCommentId: string;
}

async function runCommentChecks(
  context: SmokeContext,
  fixture: SmokeFixture,
  posts: CreatedPosts,
): Promise<CreatedComments> {
  console.log("\n--- comments ---");

  const { users } = fixture;
  const postPath = `/posts/${posts.detailedPostId}`;
  const commentsPath = `${postPath}/comments`;

  const aliceComment = await api("POST", commentsPath, {
    authorId: users.alice,
    content: "   Alice first comment   ",
  });
  const aliceCommentId = await requireCreatedId(
    "comment: active member comments on a post",
    aliceComment,
    201,
  );
  context.commentIds.push(aliceCommentId);

  expectEqual(
    "comment: content is trimmed",
    readString(aliceComment.body, "content"),
    "Alice first comment",
  );
  expectEqual(
    "comment: comment belongs to the post",
    readString(aliceComment.body, "postId"),
    posts.detailedPostId,
  );
  expectEqual(
    "comment: author is the acting student",
    readString(aliceComment.body, "authorId"),
    users.alice,
  );
  expectEqual(
    "comment: deletedAt starts empty",
    asRecord(aliceComment.body)["deletedAt"],
    null,
  );
  expectTrue(
    "comment: createdAt is an ISO timestamp",
    isIsoTimestamp(readString(aliceComment.body, "createdAt")),
  );
  expectTrue(
    "comment: creation response never leaks an email",
    !containsText(aliceComment.body, "@bridgeed-smoke.test"),
  );

  await sleep(35);

  const ownerComment = await api("POST", commentsPath, {
    authorId: users.owner,
    content: "Owner comment",
  });
  const ownerCommentId = await requireCreatedId(
    "comment: owner comments on a post",
    ownerComment,
    201,
  );
  context.commentIds.push(ownerCommentId);

  await sleep(35);

  const adminComment = await api("POST", commentsPath, {
    authorId: users.admin,
    content: "Admin comment",
  });
  context.commentIds.push(
    await requireCreatedId(
      "comment: admin comments on a post",
      adminComment,
      201,
    ),
  );

  await sleep(35);

  const moderatorComment = await api("POST", commentsPath, {
    authorId: users.moderator,
    content: "Moderator comment",
  });
  context.commentIds.push(
    await requireCreatedId(
      "comment: moderator comments on a post",
      moderatorComment,
      201,
    ),
  );

  await sleep(35);

  const bobComment = await api("POST", commentsPath, {
    authorId: users.bob,
    content: "Bob comment used for ownership checks",
  });
  const bobCommentId = await requireCreatedId(
    "comment: plain member comments on a post",
    bobComment,
    201,
  );
  context.commentIds.push(bobCommentId);

  expectError(
    "comment: pending membership cannot comment",
    await api("POST", commentsPath, {
      authorId: users.carol,
      content: "Pending comment",
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment: rejected membership cannot comment",
    await api("POST", commentsPath, {
      authorId: users.dave,
      content: "Rejected comment",
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment: banned membership cannot comment",
    await api("POST", commentsPath, {
      authorId: users.erin,
      content: "Banned comment",
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment: non-member cannot comment",
    await api("POST", commentsPath, {
      authorId: users.frank,
      content: "Outsider comment",
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment: a forged role in the payload is ignored",
    await api("POST", commentsPath, {
      authorId: users.carol,
      content: "Forged comment",
      role: COMMUNITY_MEMBER_ROLES.OWNER,
      status: COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );

  expectError(
    "comment: unknown post returns 404",
    await api("POST", "/posts/00000000-0000-4000-8000-000000000000/comments", {
      authorId: users.alice,
      content: "Unknown post comment",
    }),
    404,
    POST_NOT_FOUND_MESSAGE,
  );
  expectError(
    "comment: missing authorId returns 400",
    await api("POST", commentsPath, { content: "No author" }),
    400,
    COMMENT_AUTHOR_REQUIRED_MESSAGE,
  );
  expectError(
    "comment: missing content returns 400",
    await api("POST", commentsPath, { authorId: users.alice }),
    400,
    COMMENT_CONTENT_INVALID_MESSAGE,
  );
  expectError(
    "comment: empty content returns 400",
    await api("POST", commentsPath, { authorId: users.alice, content: "" }),
    400,
    COMMENT_CONTENT_REQUIRED_MESSAGE,
  );
  expectError(
    "comment: whitespace-only content returns 400",
    await api("POST", commentsPath, {
      authorId: users.alice,
      content: "  \t ",
    }),
    400,
    COMMENT_CONTENT_REQUIRED_MESSAGE,
  );
  expectError(
    "comment: content longer than 2000 characters returns 400",
    await api("POST", commentsPath, {
      authorId: users.alice,
      content: "c".repeat(MAX_COMMENT_CONTENT_LENGTH + 1),
    }),
    400,
    COMMENT_CONTENT_TOO_LONG_MESSAGE,
  );

  const maxLengthComment = await api("POST", commentsPath, {
    authorId: users.alice,
    content: `${"d".repeat(MAX_COMMENT_CONTENT_LENGTH)}`,
  });
  const maxLengthCommentId = await requireCreatedId(
    "comment: content of exactly 2000 characters is accepted",
    maxLengthComment,
    201,
  );
  context.commentIds.push(maxLengthCommentId);

  expectEqual(
    "comment: maximum length content is stored",
    readString(maxLengthComment.body, "content")?.length,
    MAX_COMMENT_CONTENT_LENGTH,
  );

  const listed = await api("GET", `${commentsPath}?actorId=${users.bob}`);
  const listedItems = readItems(listed.body);

  expectStatus("comment: active member can list comments", listed, 200);
  expectEqual(
    "comment: comments are ordered oldest first",
    listedItems[0]?.["id"],
    aliceCommentId,
  );
  expectEqual(
    "comment: the second comment follows in creation order",
    listedItems[1]?.["id"],
    ownerCommentId,
  );
  expectTrue(
    "comment: createdAt ascends across the page",
    listedItems.every((item, index) => {
      const current = item["createdAt"];
      const next = listedItems[index + 1]?.["createdAt"];

      if (typeof current !== "string" || typeof next !== "string") {
        return true;
      }

      return current <= next;
    }),
  );
  expectEqual(
    "comment: listing total counts the created comments",
    readNumber(listed.body, "total"),
    6,
  );
  expectEqual(
    "comment: listing totalPages is derived from total",
    readNumber(listed.body, "totalPages"),
    1,
  );

  const commentPageOne = await api(
    "GET",
    `${commentsPath}?actorId=${users.bob}&limit=2`,
  );
  const commentPageTwo = await api(
    "GET",
    `${commentsPath}?actorId=${users.bob}&page=2&limit=2`,
  );

  expectEqual(
    "comment: first page is limited to the requested size",
    readItems(commentPageOne.body).length,
    2,
  );
  expectEqual(
    "comment: second page reports its number",
    readNumber(commentPageTwo.body, "page"),
    2,
  );
  expectEqual(
    "comment: second page is limited too",
    readItems(commentPageTwo.body).length,
    2,
  );
  expectEqual(
    "comment: comment totalPages accounts for the page size",
    readNumber(commentPageOne.body, "totalPages"),
    3,
  );
  expectError(
    "comment: invalid pagination is rejected",
    await api("GET", `${commentsPath}?actorId=${users.bob}&page=0`),
    400,
    HTTP_MESSAGES.invalidPagination,
  );
  expectError(
    "comment: missing actor is rejected",
    await api("GET", commentsPath),
    400,
    HTTP_MESSAGES.actorIdRequired,
  );
  expectError(
    "comment: unknown post listing returns 404",
    await api(
      "GET",
      `/posts/00000000-0000-4000-8000-000000000000/comments?actorId=${users.bob}`,
    ),
    404,
    POST_NOT_FOUND_MESSAGE,
  );
  expectError(
    "comment: pending membership cannot list comments",
    await api("GET", `${commentsPath}?actorId=${users.carol}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment: rejected membership cannot list comments",
    await api("GET", `${commentsPath}?actorId=${users.dave}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment: banned membership cannot list comments",
    await api("GET", `${commentsPath}?actorId=${users.erin}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment: non-member cannot list comments",
    await api("GET", `${commentsPath}?actorId=${users.frank}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );

  const commentDetail = await api(
    "GET",
    `/comments/${aliceCommentId}?actorId=${users.bob}`,
  );

  expectStatus("comment detail: active member can read a comment", commentDetail, 200);
  expectEqual(
    "comment detail: id",
    readString(commentDetail.body, "id"),
    aliceCommentId,
  );
  expectEqual(
    "comment detail: content",
    readString(commentDetail.body, "content"),
    "Alice first comment",
  );
  expectEqual(
    "comment detail: postId",
    readString(commentDetail.body, "postId"),
    posts.detailedPostId,
  );
  expectEqual(
    "comment detail: authorId",
    readString(commentDetail.body, "authorId"),
    users.alice,
  );
  expectEqual(
    "comment detail: deletedAt is empty",
    asRecord(commentDetail.body)["deletedAt"],
    null,
  );
  expectTrue(
    "comment detail: createdAt is an ISO timestamp",
    isIsoTimestamp(readString(commentDetail.body, "createdAt")),
  );
  expectEqual(
    "comment detail: likeCount starts at zero",
    readNumber(commentDetail.body, "likeCount"),
    0,
  );

  const detailAuthor = asRecord(asRecord(commentDetail.body)["author"]);

  expectEqual(
    "comment detail: author userId",
    detailAuthor["userId"],
    users.alice,
  );
  expectEqual(
    "comment detail: author name",
    readString(detailAuthor, "name"),
    "Smoke alice",
  );
  expectTrue(
    "comment detail: author username is returned",
    typeof readString(detailAuthor, "username") === "string",
  );
  expectTrue(
    "comment detail: author data never leaks an email",
    !containsText(commentDetail.body, "@bridgeed-smoke.test"),
  );

  const detailPost = asRecord(asRecord(commentDetail.body)["post"]);

  expectEqual(
    "comment detail: post summary exposes the post id",
    detailPost["id"],
    posts.detailedPostId,
  );
  expectEqual(
    "comment detail: post summary exposes the community id",
    detailPost["communityId"],
    fixture.publicId,
  );
  expectEqual(
    "comment detail: post summary exposes the post author",
    detailPost["authorId"],
    users.alice,
  );
  expectTrue(
    "comment detail: post summary never exposes the post content",
    !containsText(detailPost, "Alice detailed post for counts"),
  );

  expectError(
    "comment detail: pending membership cannot read a comment",
    await api("GET", `/comments/${aliceCommentId}?actorId=${users.carol}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment detail: rejected membership cannot read a comment",
    await api("GET", `/comments/${aliceCommentId}?actorId=${users.dave}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment detail: banned membership cannot read a comment",
    await api("GET", `/comments/${aliceCommentId}?actorId=${users.erin}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment detail: non-member cannot read a comment",
    await api("GET", `/comments/${aliceCommentId}?actorId=${users.frank}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment detail: unknown comment returns 404",
    await api(
      "GET",
      `/comments/00000000-0000-4000-8000-000000000000?actorId=${users.bob}`,
    ),
    404,
    COMMENT_NOT_FOUND_MESSAGE,
  );
  expectError(
    "comment detail: missing actor is rejected",
    await api("GET", `/comments/${aliceCommentId}`),
    400,
    HTTP_MESSAGES.actorIdRequired,
  );

  const postDetail = await api(
    "GET",
    `${postPath}?actorId=${users.bob}`,
  );

  expectEqual(
    "comments: post detail commentCount reflects the created comments",
    readNumber(postDetail.body, "commentCount"),
    6,
  );
  expectEqual(
    "comments: post detail likeCount is still zero",
    readNumber(postDetail.body, "likeCount"),
    0,
  );

  const postListing = await api(
    "GET",
    `/communities/${fixture.publicId}/posts?actorId=${users.bob}&limit=100`,
  );
  const postListingItem =
    findItemWithId(readItems(postListing.body), posts.detailedPostId) ?? {};

  expectEqual(
    "comments: post listing commentCount matches the detail count",
    postListingItem["commentCount"],
    6,
  );

  return {
    aliceCommentId,
    ownerCommentId,
    bobCommentId,
    maxLengthCommentId,
  };
}

async function runCommentEditDeleteChecks(
  fixture: SmokeFixture,
  posts: CreatedPosts,
  comments: CreatedComments,
): Promise<void> {
  console.log("\n--- comment edit and delete ---");

  const { users } = fixture;
  const commentPath = `/comments/${comments.bobCommentId}`;
  const commentsPath = `/posts/${posts.detailedPostId}/comments`;

  const edited = await api("PATCH", commentPath, {
    authorId: users.bob,
    content: "   Bob edited his own comment   ",
  });

  expectStatus("comment edit: author can edit the comment", edited, 200);
  expectEqual(
    "comment edit: content is trimmed",
    readString(edited.body, "content"),
    "Bob edited his own comment",
  );
  expectTrue(
    "comment edit: updatedAt is not older than createdAt",
    String(readString(edited.body, "updatedAt")) >=
      String(readString(edited.body, "createdAt")),
  );
  expectEqual(
    "comment edit: author cannot be changed",
    readString(edited.body, "authorId"),
    users.bob,
  );
  expectEqual(
    "comment edit: the comment stays on the same post",
    readString(edited.body, "postId"),
    posts.detailedPostId,
  );

  expectError(
    "comment edit: another active member cannot edit the comment",
    await api("PATCH", commentPath, {
      authorId: users.alice,
      content: "Alice edits Bob's comment",
    }),
    403,
    COMMENT_EDIT_FORBIDDEN_MESSAGE,
  );
  expectError(
    "comment edit: an admin cannot edit somebody else's comment",
    await api("PATCH", commentPath, {
      authorId: users.admin,
      content: "Admin edits Bob's comment",
    }),
    403,
    COMMENT_EDIT_FORBIDDEN_MESSAGE,
  );
  expectError(
    "comment edit: a moderator cannot edit somebody else's comment",
    await api("PATCH", commentPath, {
      authorId: users.moderator,
      content: "Moderator edits Bob's comment",
    }),
    403,
    COMMENT_EDIT_FORBIDDEN_MESSAGE,
  );
  expectError(
    "comment edit: a pending member cannot edit the comment",
    await api("PATCH", commentPath, {
      authorId: users.carol,
      content: "Pending comment edit",
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment edit: a non-member cannot edit the comment",
    await api("PATCH", commentPath, {
      authorId: users.frank,
      content: "Outsider comment edit",
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment edit: empty content is rejected",
    await api("PATCH", commentPath, {
      authorId: users.bob,
      content: "   ",
    }),
    400,
    COMMENT_CONTENT_REQUIRED_MESSAGE,
  );
  expectError(
    "comment edit: non string content is rejected",
    await api("PATCH", commentPath, { authorId: users.bob, content: 7 }),
    400,
    COMMENT_CONTENT_INVALID_MESSAGE,
  );
  expectError(
    "comment edit: oversized content is rejected",
    await api("PATCH", commentPath, {
      authorId: users.bob,
      content: "e".repeat(MAX_COMMENT_CONTENT_LENGTH + 1),
    }),
    400,
    COMMENT_CONTENT_TOO_LONG_MESSAGE,
  );
  expectError(
    "comment edit: unknown comment returns 404",
    await api("PATCH", "/comments/00000000-0000-4000-8000-000000000000", {
      authorId: users.bob,
      content: "Unknown comment",
    }),
    404,
    COMMENT_NOT_FOUND_MESSAGE,
  );
  expectError(
    "comment edit: missing actor is rejected",
    await api("PATCH", commentPath, { content: "No actor" }),
    400,
    HTTP_MESSAGES.actorIdRequired,
  );

  const reread = await api("GET", `${commentPath}?actorId=${users.bob}`);

  expectEqual(
    "comment edit: the new content is persisted",
    readString(reread.body, "content"),
    "Bob edited his own comment",
  );

  expectError(
    "comment delete: another active member cannot delete the comment",
    await api("DELETE", commentPath, { actorId: users.alice }),
    403,
    COMMENT_DELETE_FORBIDDEN_MESSAGE,
  );
  expectError(
    "comment delete: an admin cannot delete somebody else's comment",
    await api("DELETE", commentPath, { actorId: users.admin }),
    403,
    COMMENT_DELETE_FORBIDDEN_MESSAGE,
  );
  expectError(
    "comment delete: a moderator cannot delete somebody else's comment",
    await api("DELETE", commentPath, { actorId: users.moderator }),
    403,
    COMMENT_DELETE_FORBIDDEN_MESSAGE,
  );
  expectError(
    "comment delete: missing actor is rejected",
    await api("DELETE", commentPath, {}),
    400,
    HTTP_MESSAGES.actorIdRequired,
  );
  expectError(
    "comment delete: unknown comment returns 404",
    await api("DELETE", "/comments/00000000-0000-4000-8000-000000000000", {
      actorId: users.bob,
    }),
    404,
    COMMENT_NOT_FOUND_MESSAGE,
  );

  expectStatus(
    "comment delete: the author soft deletes the comment",
    await api("DELETE", commentPath, { actorId: users.bob }),
    204,
  );

  const listedAfterDelete = await api(
    "GET",
    `${commentsPath}?actorId=${users.alice}&limit=100`,
  );

  expectEqual(
    "comment delete: the deleted comment disappears from the listing",
    hasItemWithId(readItems(listedAfterDelete.body), comments.bobCommentId),
    false,
  );
  expectEqual(
    "comment delete: the listing total decreases",
    readNumber(listedAfterDelete.body, "total"),
    5,
  );

  const deletedCommentDetail = await api(
    "GET",
    `${commentPath}?actorId=${users.bob}`,
  );

  expectError(
    "comment delete: the deleted comment returns a conflict",
    deletedCommentDetail,
    409,
    COMMENT_DELETED_MESSAGE,
  );
  expectTrue(
    "comment delete: the deleted comment never exposes its content",
    !containsText(deletedCommentDetail.body, "Bob edited his own comment"),
  );
  expectError(
    "comment delete: deleting twice returns a conflict",
    await api("DELETE", commentPath, { actorId: users.bob }),
    409,
    COMMENT_DELETED_MESSAGE,
  );
  expectError(
    "comment delete: a deleted comment cannot be edited",
    await api("PATCH", commentPath, {
      authorId: users.bob,
      content: "Edit after delete",
    }),
    409,
    COMMENT_DELETED_MESSAGE,
  );

  const storedComment = await prisma.comment.findUnique({
    where: { id: comments.bobCommentId },
    select: { content: true, deletedAt: true },
  });

  expectTrue(
    "comment delete: the comment row is only soft deleted",
    storedComment !== null && storedComment.deletedAt !== null,
    storedComment,
  );
  expectEqual(
    "comment delete: the content is not physically removed",
    storedComment?.content,
    "Bob edited his own comment",
  );

  const postDetail = await api(
    "GET",
    `/posts/${posts.detailedPostId}?actorId=${users.alice}`,
  );

  expectEqual(
    "comment delete: the post commentCount no longer counts it",
    readNumber(postDetail.body, "commentCount"),
    5,
  );
}

async function runPostReactionChecks(
  context: SmokeContext,
  fixture: SmokeFixture,
  posts: CreatedPosts,
): Promise<void> {
  console.log("\n--- post reactions ---");

  const { users } = fixture;
  const postPath = `/posts/${posts.detailedPostId}`;
  const reactionsPath = `${postPath}/reactions`;

  const aliceLike = await api("POST", reactionsPath, { userId: users.alice });
  const aliceLikeId = await requireCreatedId(
    "reaction: active member likes a post",
    aliceLike,
    201,
  );

  expectEqual(
    "reaction: reaction belongs to the post",
    readString(aliceLike.body, "postId"),
    posts.detailedPostId,
  );
  expectEqual(
    "reaction: reaction belongs to the acting student",
    readString(aliceLike.body, "userId"),
    users.alice,
  );
  expectEqual(
    "reaction: the only reaction type is like",
    readString(aliceLike.body, "type"),
    REACTION_TYPES.LIKE,
  );
  expectTrue(
    "reaction: createdAt is an ISO timestamp",
    isIsoTimestamp(readString(aliceLike.body, "createdAt")),
  );
  expectTrue(
    "reaction: response never leaks an email",
    !containsText(aliceLike.body, "@bridgeed-smoke.test"),
  );

  expectError(
    "reaction: duplicate like is rejected deterministically",
    await api("POST", reactionsPath, { userId: users.alice }),
    409,
    REACTION_ALREADY_EXISTS_MESSAGE,
  );

  expectStatus(
    "reaction: the owner can like the post",
    await api("POST", reactionsPath, { userId: users.owner }),
    201,
  );

  const afterTwoLikes = await api("GET", `${postPath}?actorId=${users.alice}`);

  expectEqual(
    "reaction: likeCount counts both likes",
    readNumber(afterTwoLikes.body, "likeCount"),
    2,
  );

  const listingAfterLikes = await api(
    "GET",
    `/communities/${fixture.publicId}/posts?actorId=${users.alice}&limit=100`,
  );
  const likedItem =
    findItemWithId(readItems(listingAfterLikes.body), posts.detailedPostId) ??
    {};

  expectEqual(
    "reaction: the listing likeCount matches the detail",
    likedItem["likeCount"],
    2,
  );

  expectStatus(
    "reaction: the acting student can remove the like",
    await api("DELETE", reactionsPath, { userId: users.alice }),
    204,
  );

  const afterUnlike = await api("GET", `${postPath}?actorId=${users.owner}`);

  expectEqual(
    "reaction: likeCount decreases after an unlike",
    readNumber(afterUnlike.body, "likeCount"),
    1,
  );
  expectError(
    "reaction: removing a missing like returns 404",
    await api("DELETE", reactionsPath, { userId: users.alice }),
    404,
    REACTION_NOT_FOUND_MESSAGE,
  );

  const reLiked = await api("POST", reactionsPath, { userId: users.alice });

  expectStatus(
    "reaction: a removed like can be created again",
    reLiked,
    201,
  );

  const reLikedId = readString(reLiked.body, "id");

  expectTrue(
    "reaction: the new like has a different row id",
    reLikedId !== null && reLikedId !== aliceLikeId,
  );

  expectError(
    "reaction: pending membership cannot like a post",
    await api("POST", reactionsPath, { userId: users.carol }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "reaction: rejected membership cannot like a post",
    await api("POST", reactionsPath, { userId: users.dave }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "reaction: banned membership cannot like a post",
    await api("POST", reactionsPath, { userId: users.erin }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "reaction: non-member cannot like a post",
    await api("POST", reactionsPath, { userId: users.frank }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "reaction: a forged role in the payload is ignored",
    await api("POST", reactionsPath, {
      userId: users.carol,
      role: COMMUNITY_MEMBER_ROLES.OWNER,
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "reaction: pending membership cannot remove a like",
    await api("DELETE", reactionsPath, { userId: users.carol }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "reaction: unknown student cannot like a post",
    await api("POST", reactionsPath, {
      userId: "00000000-0000-4000-8000-000000000000",
    }),
    404,
    STUDENT_PROFILE_NOT_FOUND_MESSAGE,
  );
  expectError(
    "reaction: missing userId is rejected",
    await api("POST", reactionsPath, {}),
    400,
    REACTION_USER_REQUIRED_MESSAGE,
  );
  expectError(
    "reaction: missing userId on unlike is rejected",
    await api("DELETE", reactionsPath, {}),
    400,
    REACTION_USER_REQUIRED_MESSAGE,
  );
  expectError(
    "reaction: an unsupported reaction type is rejected",
    await api("POST", reactionsPath, {
      userId: users.moderator,
      type: "love",
    }),
    400,
    REACTION_TYPE_INVALID_MESSAGE,
  );

  const explicitType = await api("POST", reactionsPath, {
    userId: users.bob,
    type: REACTION_TYPES.LIKE,
  });

  expectStatus("reaction: an explicit like type is accepted", explicitType, 201);

  expectError(
    "reaction: unknown post cannot be liked",
    await api(
      "POST",
      "/posts/00000000-0000-4000-8000-000000000000/reactions",
      { userId: users.alice },
    ),
    404,
    POST_NOT_FOUND_MESSAGE,
  );
  expectError(
    "reaction: unknown post cannot be unliked",
    await api(
      "DELETE",
      "/posts/00000000-0000-4000-8000-000000000000/reactions",
      { userId: users.alice },
    ),
    404,
    POST_NOT_FOUND_MESSAGE,
  );
  expectError(
    "reaction: removing a like that never existed returns 404",
    await api("DELETE", reactionsPath, { userId: users.moderator }),
    404,
    REACTION_NOT_FOUND_MESSAGE,
  );

  const storedLikes = await prisma.postReaction.count({
    where: {
      postId: posts.detailedPostId,
      type: "LIKE",
    },
  });

  expectEqual(
    "reaction: likes are stored as one row per student",
    storedLikes,
    3,
  );

  const finalDetail = await api("GET", `${postPath}?actorId=${users.bob}`);

  expectEqual(
    "reaction: likeCount matches the stored rows",
    readNumber(finalDetail.body, "likeCount"),
    3,
  );
  expectEqual(
    "reaction: commentCount is unaffected by reactions",
    readNumber(finalDetail.body, "commentCount"),
    5,
  );
}

async function runCommentReactionChecks(
  fixture: SmokeFixture,
  posts: CreatedPosts,
  comments: CreatedComments,
): Promise<void> {
  console.log("\n--- comment reactions ---");

  const { users } = fixture;
  const commentPath = `/comments/${comments.aliceCommentId}`;
  const reactionsPath = `${commentPath}/reactions`;
  const commentsPath = `/posts/${posts.detailedPostId}/comments`;

  const bobLike = await api("POST", reactionsPath, { userId: users.bob });

  expectStatus("comment reaction: active member likes a comment", bobLike, 201);
  expectEqual(
    "comment reaction: reaction belongs to the comment",
    readString(bobLike.body, "commentId"),
    comments.aliceCommentId,
  );
  expectEqual(
    "comment reaction: reaction belongs to the acting student",
    readString(bobLike.body, "userId"),
    users.bob,
  );
  expectEqual(
    "comment reaction: the only reaction type is like",
    readString(bobLike.body, "type"),
    REACTION_TYPES.LIKE,
  );
  expectTrue(
    "comment reaction: createdAt is an ISO timestamp",
    isIsoTimestamp(readString(bobLike.body, "createdAt")),
  );

  expectError(
    "comment reaction: duplicate like is rejected deterministically",
    await api("POST", reactionsPath, { userId: users.bob }),
    409,
    REACTION_ALREADY_EXISTS_MESSAGE,
  );
  expectStatus(
    "comment reaction: the owner can like the comment",
    await api("POST", reactionsPath, { userId: users.owner }),
    201,
  );

  const commentDetail = await api(
    "GET",
    `${commentPath}?actorId=${users.alice}`,
  );

  expectEqual(
    "comment reaction: comment detail likeCount counts both likes",
    readNumber(commentDetail.body, "likeCount"),
    2,
  );

  const listedComments = await api(
    "GET",
    `${commentsPath}?actorId=${users.alice}&limit=100`,
  );
  const listedComment =
    findItemWithId(readItems(listedComments.body), comments.aliceCommentId) ??
    {};

  expectEqual(
    "comment reaction: the listing likeCount matches the detail",
    listedComment["likeCount"],
    2,
  );
  expectTrue(
    "comment reaction: the listing never leaks an email",
    !containsText(listedComment, "@bridgeed-smoke.test"),
  );

  expectStatus(
    "comment reaction: the acting student can remove the like",
    await api("DELETE", reactionsPath, { userId: users.bob }),
    204,
  );

  const afterUnlike = await api(
    "GET",
    `${commentPath}?actorId=${users.owner}`,
  );

  expectEqual(
    "comment reaction: likeCount decreases after an unlike",
    readNumber(afterUnlike.body, "likeCount"),
    1,
  );
  expectError(
    "comment reaction: removing a missing like returns 404",
    await api("DELETE", reactionsPath, { userId: users.bob }),
    404,
    REACTION_NOT_FOUND_MESSAGE,
  );
  expectError(
    "comment reaction: removing a like that never existed returns 404",
    await api("DELETE", reactionsPath, { userId: users.moderator }),
    404,
    REACTION_NOT_FOUND_MESSAGE,
  );

  expectError(
    "comment reaction: pending membership cannot like a comment",
    await api("POST", reactionsPath, { userId: users.carol }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment reaction: rejected membership cannot like a comment",
    await api("POST", reactionsPath, { userId: users.dave }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment reaction: banned membership cannot like a comment",
    await api("POST", reactionsPath, { userId: users.erin }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment reaction: non-member cannot like a comment",
    await api("POST", reactionsPath, { userId: users.frank }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment reaction: a forged role in the payload is ignored",
    await api("POST", reactionsPath, {
      userId: users.dave,
      role: COMMUNITY_MEMBER_ROLES.ADMIN,
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment reaction: pending membership cannot remove a like",
    await api("DELETE", reactionsPath, { userId: users.carol }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "comment reaction: unknown student cannot like a comment",
    await api("POST", reactionsPath, {
      userId: "00000000-0000-4000-8000-000000000000",
    }),
    404,
    STUDENT_PROFILE_NOT_FOUND_MESSAGE,
  );
  expectError(
    "comment reaction: missing userId is rejected",
    await api("POST", reactionsPath, {}),
    400,
    REACTION_USER_REQUIRED_MESSAGE,
  );
  expectError(
    "comment reaction: missing userId on unlike is rejected",
    await api("DELETE", reactionsPath, {}),
    400,
    REACTION_USER_REQUIRED_MESSAGE,
  );
  expectError(
    "comment reaction: an unsupported reaction type is rejected",
    await api("POST", reactionsPath, {
      userId: users.moderator,
      type: "haha",
    }),
    400,
    REACTION_TYPE_INVALID_MESSAGE,
  );
  expectError(
    "comment reaction: unknown comment cannot be liked",
    await api(
      "POST",
      "/comments/00000000-0000-4000-8000-000000000000/reactions",
      { userId: users.alice },
    ),
    404,
    COMMENT_NOT_FOUND_MESSAGE,
  );
  expectError(
    "comment reaction: unknown comment cannot be unliked",
    await api(
      "DELETE",
      "/comments/00000000-0000-4000-8000-000000000000/reactions",
      { userId: users.alice },
    ),
    404,
    COMMENT_NOT_FOUND_MESSAGE,
  );
  expectError(
    "comment reaction: a deleted comment cannot be liked",
    await api("POST", `/comments/${comments.bobCommentId}/reactions`, {
      userId: users.alice,
    }),
    409,
    COMMENT_DELETED_MESSAGE,
  );
  expectError(
    "comment reaction: a deleted comment cannot be unliked",
    await api("DELETE", `/comments/${comments.bobCommentId}/reactions`, {
      userId: users.alice,
    }),
    409,
    COMMENT_DELETED_MESSAGE,
  );

  const storedCommentLikes = await prisma.commentReaction.count({
    where: {
      commentId: comments.aliceCommentId,
      type: "LIKE",
    },
  });

  expectEqual(
    "comment reaction: likes are stored as one row per student",
    storedCommentLikes,
    1,
  );

  const unrelatedComment = await api(
    "GET",
    `/comments/${comments.ownerCommentId}?actorId=${users.alice}`,
  );

  expectEqual(
    "comment reaction: other comments keep their own like count",
    readNumber(unrelatedComment.body, "likeCount"),
    0,
  );
}

async function runPrivateCommunityChecks(
  context: SmokeContext,
  fixture: SmokeFixture,
  posts: CreatedPosts,
): Promise<void> {
  console.log("\n--- private community ---");

  const { users, privateId, publicId } = fixture;
  const privatePostsPath = `/communities/${privateId}/posts`;

  const ownerPrivatePost = await api("POST", privatePostsPath, {
    authorId: users.owner,
    content: "Private community announcement",
  });
  const privatePostId = await requireCreatedId(
    "private: the owner creates a post",
    ownerPrivatePost,
    201,
  );
  context.postIds.push(privatePostId);

  expectEqual(
    "private: the post belongs to the private community",
    readString(ownerPrivatePost.body, "communityId"),
    privateId,
  );

  expectStatus(
    "private: the owner can read their private post",
    await api("GET", `/posts/${privatePostId}?actorId=${users.owner}`),
    200,
  );
  expectStatus(
    "private: an approved member can read private posts",
    await api("GET", `/posts/${privatePostId}?actorId=${users.alice}`),
    200,
  );
  expectStatus(
    "private: an approved member can list private posts",
    await api("GET", `${privatePostsPath}?actorId=${users.alice}`),
    200,
  );

  const alicePrivatePost = await api("POST", privatePostsPath, {
    authorId: users.alice,
    content: "Alice private post",
  });
  context.postIds.push(
    await requireCreatedId(
      "private: an approved member can create private posts",
      alicePrivatePost,
      201,
    ),
  );

  const privateListing = await api(
    "GET",
    `${privatePostsPath}?actorId=${users.alice}&limit=100`,
  );
  const privateItems = readItems(privateListing.body);
  const publicListing = await api(
    "GET",
    `/communities/${publicId}/posts?actorId=${users.owner}&limit=100`,
  );

  expectEqual(
    "private: the private listing never contains public posts",
    hasItemWithId(privateItems, posts.detailedPostId),
    false,
  );
  expectEqual(
    "private: the public listing never contains private posts",
    hasItemWithId(readItems(publicListing.body), privatePostId),
    false,
  );
  expectTrue(
    "private: the private listing exposes the private post",
    findItemWithId(privateItems, privatePostId) !== undefined,
  );

  const privateComments = await api(
    "POST",
    `/posts/${privatePostId}/comments`,
    { authorId: users.alice, content: "Alice private comment" },
  );
  const privateCommentId = await requireCreatedId(
    "private: an approved member can comment on private posts",
    privateComments,
    201,
  );
  context.commentIds.push(privateCommentId);

  expectStatus(
    "private: an approved member can like private posts",
    await api("POST", `/posts/${privatePostId}/reactions`, {
      userId: users.alice,
    }),
    201,
  );

  const privateDetail = await api(
    "GET",
    `/posts/${privatePostId}?actorId=${users.owner}`,
  );

  expectEqual(
    "private: the private post detail counts its comments",
    readNumber(privateDetail.body, "commentCount"),
    1,
  );
  expectEqual(
    "private: the private post detail counts its like",
    readNumber(privateDetail.body, "likeCount"),
    1,
  );

  expectError(
    "private: a pending member cannot read private posts",
    await api("GET", `/posts/${privatePostId}?actorId=${users.grace}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "private: a pending member cannot list private posts",
    await api("GET", `${privatePostsPath}?actorId=${users.grace}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "private: a pending member cannot create private posts",
    await api("POST", privatePostsPath, {
      authorId: users.grace,
      content: "Grace private post",
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "private: a pending member cannot comment on private posts",
    await api("POST", `/posts/${privatePostId}/comments`, {
      authorId: users.grace,
      content: "Grace private comment",
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "private: a pending member cannot like private posts",
    await api("POST", `/posts/${privatePostId}/reactions`, {
      userId: users.grace,
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "private: a rejected member cannot read private posts",
    await api("GET", `/posts/${privatePostId}?actorId=${users.hank}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "private: a rejected member cannot create private posts",
    await api("POST", privatePostsPath, {
      authorId: users.hank,
      content: "Hank private post",
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "private: a banned member cannot read private posts",
    await api("GET", `/posts/${privatePostId}?actorId=${users.ivan}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "private: a banned member cannot create private posts",
    await api("POST", privatePostsPath, {
      authorId: users.ivan,
      content: "Ivan private post",
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "private: a non-member cannot read private posts",
    await api("GET", `/posts/${privatePostId}?actorId=${users.frank}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "private: a non-member cannot create private posts",
    await api("POST", privatePostsPath, {
      authorId: users.frank,
      content: "Frank private post",
    }),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "private: a member of another community cannot read private posts",
    await api("GET", `/posts/${privatePostId}?actorId=${users.admin}`),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "private: a member of another community cannot read private comments",
    await api(
      "GET",
      `/comments/${privateCommentId}?actorId=${users.moderator}`,
    ),
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );
  expectError(
    "private: an unknown community id returns 404",
    await api(
      "GET",
      `/communities/00000000-0000-4000-8000-000000000000/posts?actorId=${users.owner}`,
    ),
    404,
    COMMUNITY_NOT_FOUND_MESSAGE,
  );

  const storedPrivatePost = await prisma.post.findUnique({
    where: { id: privatePostId },
    select: { communityId: true, deletedAt: true },
  });

  expectEqual(
    "private: the stored post is attached to the private community",
    storedPrivatePost?.communityId,
    privateId,
  );
  expectEqual(
    "private: the stored post is not deleted",
    storedPrivatePost?.deletedAt,
    null,
  );
}

async function runRegressionChecks(
  context: SmokeContext,
  fixture: SmokeFixture,
): Promise<void> {
  console.log("\n--- regression ---");

  const health = await api("GET", "/health");

  expectStatus("regression: health endpoint responds", health, 200);
  expectEqual("regression: health reports ok", readString(health.body, "status"), "ok");

  const user = await api("GET", `/users/${fixture.users.owner}`);

  expectStatus("regression: get user by id", user, 200);
  expectEqual(
    "regression: user id round trips",
    readString(user.body, "id"),
    fixture.users.owner,
  );
  expectStatus(
    "regression: unknown user returns 404",
    await api("GET", "/users/00000000-0000-4000-8000-000000000000"),
    404,
  );

  const profile = await api(
    "GET",
    `/student-profiles/${fixture.users.alice}`,
  );

  expectStatus("regression: get student profile", profile, 200);
  expectEqual(
    "regression: profile username round trips",
    readString(profile.body, "username"),
    `${RUN_ID}-alice`,
  );

  const university = await api("POST", "/universities", {
    name: `Smoke University ${RUN_ID}`,
    country: "India",
  });
  const universityId = await requireCreatedId(
    "regression: create university",
    university,
    201,
  );
  context.universityIds.push(universityId);
  expectStatus(
    "regression: list universities",
    await api("GET", "/universities"),
    200,
  );

  const universityById = await api("GET", `/universities/${universityId}`);

  expectStatus("regression: get university by id", universityById, 200);
  expectEqual(
    "regression: university name round trips",
    readString(universityById.body, "name"),
    `Smoke University ${RUN_ID}`,
  );

  const skill = await api("POST", "/skills", {
    name: `Smoke Skill ${RUN_ID}`,
  });
  const skillId = await requireCreatedId("regression: create skill", skill, 201);
  context.skillIds.push(skillId);
  expectStatus("regression: list skills", await api("GET", "/skills"), 200);
  expectStatus(
    "regression: get skill by id",
    await api("GET", `/skills/${skillId}`),
    200,
  );
  expectStatus(
    "regression: add skill to student",
    await api("POST", `/student-profiles/${fixture.users.alice}/skills/${skillId}`),
    201,
  );

  const studentSkills = await api(
    "GET",
    `/student-profiles/${fixture.users.alice}/skills`,
  );

  expectStatus("regression: list student skills", studentSkills, 200);
  expectTrue(
    "regression: the added skill is listed",
    containsText(studentSkills.body, skillId),
  );
  expectStatus(
    "regression: remove skill from student",
    await api("DELETE", `/student-profiles/${fixture.users.alice}/skills/${skillId}`),
    204,
  );

  const interest = await api("POST", "/interests", {
    name: `Smoke Interest ${RUN_ID}`,
  });
  const interestId = await requireCreatedId(
    "regression: create interest",
    interest,
    201,
  );
  context.interestIds.push(interestId);
  expectStatus(
    "regression: list interests",
    await api("GET", "/interests"),
    200,
  );
  expectStatus(
    "regression: get interest by id",
    await api("GET", `/interests/${interestId}`),
    200,
  );
  expectStatus(
    "regression: add interest to student",
    await api(
      "POST",
      `/student-profiles/${fixture.users.alice}/interests/${interestId}`,
    ),
    201,
  );

  const studentInterests = await api(
    "GET",
    `/student-profiles/${fixture.users.alice}/interests`,
  );

  expectStatus("regression: list student interests", studentInterests, 200);
  expectTrue(
    "regression: the added interest is listed",
    containsText(studentInterests.body, interestId),
  );
  expectStatus(
    "regression: remove interest from student",
    await api(
      "DELETE",
      `/student-profiles/${fixture.users.alice}/interests/${interestId}`,
    ),
    204,
  );

  const connection = await api("POST", "/connections", {
    requesterId: fixture.users.alice,
    receiverId: fixture.users.bob,
  });
  const connectionId = await requireCreatedId(
    "regression: create connection request",
    connection,
    201,
  );
  context.connectionIds.push(connectionId);
  expectStatus(
    "regression: get connection by id",
    await api("GET", `/connections/${connectionId}`),
    200,
  );
  expectStatus(
    "regression: list student connections",
    await api("GET", `/student-profiles/${fixture.users.alice}/connections`),
    200,
  );
  expectStatus(
    "regression: list received requests",
    await api(
      "GET",
      `/student-profiles/${fixture.users.bob}/connections/requests/received`,
    ),
    200,
  );
  expectStatus(
    "regression: list sent requests",
    await api(
      "GET",
      `/student-profiles/${fixture.users.alice}/connections/requests/sent`,
    ),
    200,
  );
  expectStatus(
    "regression: list blocked connections",
    await api("GET", `/student-profiles/${fixture.users.alice}/blocked`),
    200,
  );

  expectError(
    "regression: removing a pending connection is rejected",
    await api(
      "DELETE",
      `/connections/${connectionId}?actorId=${fixture.users.alice}`,
    ),
    409,
    "Only accepted connections can be removed",
  );
  expectStatus(
    "regression: cancelling a pending request succeeds",
    await api(
      "DELETE",
      `/connections/${connectionId}/request?actorId=${fixture.users.alice}`,
    ),
    204,
  );

  const acceptedConnection = await api("POST", "/connections", {
    requesterId: fixture.users.alice,
    receiverId: fixture.users.bob,
  });
  const acceptedConnectionId = await requireCreatedId(
    "regression: create a second connection request",
    acceptedConnection,
    201,
  );
  context.connectionIds.push(acceptedConnectionId);
  expectStatus(
    "regression: accepting a connection request succeeds",
    await api("PATCH", `/connections/${acceptedConnectionId}/accept`, {
      actorId: fixture.users.bob,
    }),
    200,
  );
  expectStatus(
    "regression: removing an accepted connection succeeds",
    await api(
      "DELETE",
      `/connections/${acceptedConnectionId}?actorId=${fixture.users.alice}`,
    ),
    204,
  );

  expectStatus(
    "regression: list communities",
    await api("GET", "/communities"),
    200,
  );

  const communityById = await api("GET", `/communities/${fixture.publicId}`);

  expectStatus("regression: get community by id", communityById, 200);
  expectEqual(
    "regression: community slug round trips",
    readString(communityById.body, "slug"),
    `${RUN_ID}-public`,
  );
  expectStatus(
    "regression: list community members",
    await api("GET", `/communities/${fixture.publicId}/members`),
    200,
  );
  expectStatus(
    "regression: list membership requests",
    await api(
      "GET",
      `/communities/${fixture.publicId}/membership-requests?actorId=${fixture.users.owner}`,
    ),
    200,
  );

  const membership = await api(
    "GET",
    `/community-memberships/${fixture.publicMemberships.alice}`,
  );

  expectStatus("regression: get membership by id", membership, 200);
  expectEqual(
    "regression: membership status round trips",
    readString(membership.body, "status"),
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );
  expectStatus(
    "regression: list student communities",
    await api(
      "GET",
      `/student-profiles/${fixture.users.alice}/communities`,
    ),
    200,
  );
  expectError(
    "regression: unknown community returns 404",
    await api("GET", "/communities/00000000-0000-4000-8000-000000000000"),
    404,
    COMMUNITY_NOT_FOUND_MESSAGE,
  );
}

interface BaselineCounts {
  users: number;
  profiles: number;
  communities: number;
  posts: number;
  comments: number;
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

    const universities = await prisma.university.deleteMany({
      where: { id: { in: context.universityIds } },
    });

    console.log(
      `removed ${postReactions.count} post reactions, ` +
        `${commentReactions.count} comment reactions, ` +
        `${comments.count} comments, ${posts.count} posts, ` +
        `${memberships.count} memberships, ${connections.count} connections, ` +
        `${studentSkills.count} student skills, ` +
        `${studentInterests.count} student interests, ` +
        `${communities.count} communities, ${profiles.count} student profiles, ` +
        `${users.count} users, ${skills.count} skills, ` +
        `${interests.count} interests, ${universities.count} universities`,
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
  const leftoverUniversities = await prisma.university.count({
    where: { id: { in: context.universityIds } },
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
  expectEqual("audit: leftover test users by email prefix", leftoverUsersByEmail, 0);
  expectEqual(
    "audit: leftover test communities by slug prefix",
    leftoverCommunitiesBySlug,
    0,
  );
  expectEqual("audit: leftover test skills", leftoverSkills, 0);
  expectEqual("audit: leftover test interests", leftoverInterests, 0);
  expectEqual("audit: leftover test universities", leftoverUniversities, 0);

  const currentUsers = await prisma.user.count();
  const currentProfiles = await prisma.studentProfile.count();
  const currentCommunities = await prisma.community.count();
  const currentPosts = await prisma.post.count();
  const currentComments = await prisma.comment.count();

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
    "audit: pre-existing posts were not deleted",
    currentPosts >= baseline.posts,
    { baseline: baseline.posts, current: currentPosts },
  );
  expectTrue(
    "audit: pre-existing comments were not deleted",
    currentComments >= baseline.comments,
    { baseline: baseline.comments, current: currentComments },
  );
}

async function main(): Promise<void> {
  console.log(`BridgeEd post smoke test :: ${RUN_ID}`);
  console.log(`target ${API_BASE_URL}${API_PREFIX}`);

  const context: SmokeContext = {
    userIds: [],
    communityIds: [],
    postIds: [],
    commentIds: [],
    universityIds: [],
    skillIds: [],
    interestIds: [],
    connectionIds: [],
  };

  const baseline: BaselineCounts = {
    users: await prisma.user.count(),
    profiles: await prisma.studentProfile.count(),
    communities: await prisma.community.count(),
    posts: await prisma.post.count(),
    comments: await prisma.comment.count(),
  };

  try {
    const fixture = await setup(context);
    const posts = await runPostCreationChecks(context, fixture);

    await runListingChecks(context, fixture);
    await runDetailsChecks(context, fixture, posts);
    await runEditChecks(fixture, posts);
    await runDeleteChecks(fixture, posts);

    const comments = await runCommentChecks(context, fixture, posts);

    await runCommentEditDeleteChecks(fixture, posts, comments);
    await runPostReactionChecks(context, fixture, posts);
    await runCommentReactionChecks(fixture, posts, comments);
    await runPrivateCommunityChecks(context, fixture, posts);
    await runRegressionChecks(context, fixture);
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
