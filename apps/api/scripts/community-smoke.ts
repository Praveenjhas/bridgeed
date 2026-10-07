/**
 * BridgeEd communities + community membership live smoke test.
 *
 * Usage:
 *   1. Make sure PostgreSQL is running and `npm run dev --workspace=apps/api`
 *      (or `npx tsx src/server.ts`) is serving the API.
 *   2. Run `npm run smoke:community --workspace=apps/api`
 *
 * Optional environment variables:
 *   API_BASE_URL (default http://localhost:4000)
 *
 * All data created by this script is clearly prefixed and removed again in the
 * cleanup step, even when a check fails.
 */
import {
  COMMUNITY_MEMBER_ROLES,
  COMMUNITY_MEMBERSHIP_STATUSES,
  COMMUNITY_TYPES,
  USER_ROLES,
} from "@bridgeed/shared";
import type { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/config/prisma";
import { COMMUNITY_SLUG_TAKEN_MESSAGE } from "../src/repositories/community.repository";
import {
  ALREADY_ACTIVE_MEMBER_MESSAGE,
  BANNED_FROM_COMMUNITY_MESSAGE,
  COMMUNITY_MEMBERSHIP_NOT_FOUND_MESSAGE,
  JOIN_REQUEST_ALREADY_PENDING_MESSAGE,
  MANAGE_MEMBERS_FORBIDDEN_MESSAGE,
  NOT_ACTIVE_MEMBER_MESSAGE,
  ONLY_PENDING_REQUEST_CAN_BE_APPROVED_MESSAGE,
  ONLY_PENDING_REQUEST_CAN_BE_REJECTED_MESSAGE,
  OWNER_CANNOT_LEAVE_MESSAGE,
} from "../src/services/community-membership.service";
import {
  COMMUNITY_COVER_IMAGE_INVALID_MESSAGE,
  COMMUNITY_DESCRIPTION_INVALID_MESSAGE,
  COMMUNITY_NAME_REQUIRED_MESSAGE,
  COMMUNITY_NAME_TOO_LONG_MESSAGE,
  COMMUNITY_NOT_FOUND_MESSAGE,
  COMMUNITY_SLUG_INVALID_MESSAGE,
  COMMUNITY_SLUG_REQUIRED_MESSAGE,
  COMMUNITY_SLUG_TOO_LONG_MESSAGE,
  COMMUNITY_TYPE_INVALID_MESSAGE,
  STUDENT_PROFILE_NOT_FOUND_MESSAGE,
} from "../src/services/community.service";

/** Messages produced by the HTTP layer (validation handled in controllers). */
const HTTP_MESSAGES = {
  createCommunityFields: "name, slug, type and createdById are required",
  actorIdRequired: "actorId is required",
  joinUserIdRequired: "userId is required",
  invalidCommunityId: "Invalid community ID",
  invalidMembershipId: "Invalid membership ID",
  invalidStudentId: "Invalid student ID",
  invalidMembershipStatus: "Invalid membership status",
  invalidPagination: "page and limit must be positive integers",
};

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const API_PREFIX = "/api/v1";
const RUN_ID = `smk${Date.now().toString(36)}${Math.random()
  .toString(36)
  .slice(2, 7)}`;

interface ApiResult {
  status: number;
  body: unknown;
}

interface SmokeContext {
  createdUserIds: string[];
  createdCommunityIds: string[];
}

/** Prefix every row created by this run carries in its unique key. */
const RUN_PREFIX = `${RUN_ID}-`;
/** Skill and interest rows seeded for a run carry that run's id in their name. */
const RUN_SKILL_NAME_PREFIX = "Smoke Skill ";
const RUN_INTEREST_NAME_PREFIX = "Smoke Interest ";

/** User and community ids this run can be shown to own. */
interface RunRowIds {
  userIds: string[];
  communityIds: string[];
}

/** Counts captured before the run starts, so the audit can prove nothing else was lost. */
interface BaselineCounts {
  users: number;
  profiles: number;
  communities: number;
  memberships: number;
  posts: number;
  comments: number;
  postReactions: number;
  commentReactions: number;
  connections: number;
  studentSkills: number;
  studentInterests: number;
  skills: number;
  interests: number;
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

function readString(source: unknown, key: string): string | null {
  const value = asRecord(source)[key];

  return typeof value === "string" ? value : null;
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

  context.createdUserIds.push(userId);

  const profileResult = await api("POST", "/student-profiles", {
    userId,
    name: `Smoke ${label}`,
    username: `${RUN_ID}-${label}`,
  });

  expectStatus(`setup: create student profile ${label}`, profileResult, 201);

  return userId;
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
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

function readTotal(value: unknown): number | null {
  const total = asRecord(value)["total"];

  return typeof total === "number" ? total : null;
}

function hasCommunityId(
  memberships: Record<string, unknown>[],
  communityId: string,
): boolean {
  return memberships.some(
    (membership) => asRecord(membership["community"])["id"] === communityId,
  );
}

function userIdsOf(items: Record<string, unknown>[]): string[] {
  return items.map((item) => String(item["userId"]));
}

async function createCommunityRecord(
  context: SmokeContext,
  label: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await api("POST", "/communities", input);
  const id = await requireCreatedId(`create community: ${label}`, result, 201);

  context.createdCommunityIds.push(id);

  return asRecord(result.body);
}

async function joinCommunity(
  label: string,
  communityId: string,
  userId: string,
): Promise<Record<string, unknown>> {
  const result = await api("POST", `/communities/${communityId}/join`, {
    userId,
  });

  expectStatus(`join: ${label}`, result, 201);

  return asRecord(result.body);
}

/** Direct database setup for states the API intentionally cannot produce. */
async function setMembershipRow(
  membershipId: string,
  data: { role?: string; status?: string },
): Promise<void> {
  await prisma.communityMembership.update({
    where: { id: membershipId },
    data: data as { role?: "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER"; status?: "PENDING" | "ACTIVE" | "REJECTED" | "BANNED" },
  });
}

interface CommunityIds {
  publicId: string;
  privateId: string;
}

async function runCreationChecks(
  context: SmokeContext,
  ownerId: string,
): Promise<CommunityIds> {
  console.log("\n--- community creation ---");

  const publicRecord = await createCommunityRecord(context, "public club", {
    name: `  Smoke Public Club ${RUN_ID}  `,
    slug: `${RUN_ID} Public Club 'n Friends`,
    description: "  A public smoke test community.  ",
    type: "PUBLIC",
    createdById: ownerId,
  });

  const publicId = String(publicRecord["id"]);

  expectEqual(
    "creation: name is trimmed",
    publicRecord["name"],
    `Smoke Public Club ${RUN_ID}`,
  );
  expectEqual(
    "creation: slug is normalized",
    publicRecord["slug"],
    `${RUN_ID}-public-club-n-friends`,
  );
  expectEqual(
    "creation: type is normalized to the shared value",
    publicRecord["type"],
    COMMUNITY_TYPES.PUBLIC,
  );
  expectEqual(
    "creation: description is trimmed",
    publicRecord["description"],
    "A public smoke test community.",
  );
  expectEqual(
    "creation: cover image defaults to null",
    publicRecord["coverImageUrl"],
    null,
  );
  expectEqual("creation: creator is recorded", publicRecord["createdById"], ownerId);
  expectTrue(
    "creation: timestamps are ISO strings",
    typeof publicRecord["createdAt"] === "string" &&
      !Number.isNaN(Date.parse(String(publicRecord["createdAt"]))) &&
      typeof publicRecord["updatedAt"] === "string",
    publicRecord,
  );

  const privateRecord = await createCommunityRecord(context, "private circle", {
    name: `Smoke Private Circle ${RUN_ID}`,
    slug: `${RUN_ID}-private-circle`,
    type: "private",
    createdById: ownerId,
    coverImageUrl: "  https://cdn.bridgeed.test/covers/smoke.png  ",
  });

  const privateId = String(privateRecord["id"]);

  expectEqual(
    "creation: private community type",
    privateRecord["type"],
    COMMUNITY_TYPES.PRIVATE,
  );
  expectEqual(
    "creation: private community slug",
    privateRecord["slug"],
    `${RUN_ID}-private-circle`,
  );
  expectEqual(
    "creation: missing description defaults to null",
    privateRecord["description"],
    null,
  );
  expectEqual(
    "creation: cover image is trimmed",
    privateRecord["coverImageUrl"],
    "https://cdn.bridgeed.test/covers/smoke.png",
  );

  return { publicId, privateId };
}

async function runCreationValidationChecks(
  context: SmokeContext,
  ownerId: string,
  publicId: string,
): Promise<void> {
  console.log("\n--- community creation validation ---");

  const validFields = {
    name: `Smoke Invalid ${RUN_ID}`,
    slug: `${RUN_ID}-invalid-${context.createdCommunityIds.length}`,
    type: COMMUNITY_TYPES.PUBLIC,
    createdById: ownerId,
  };

  const missingName = await api("POST", "/communities", {
    slug: validFields.slug,
    type: validFields.type,
    createdById: ownerId,
  });
  expectError(
    "validation: missing name",
    missingName,
    400,
    HTTP_MESSAGES.createCommunityFields,
  );

  const missingSlug = await api("POST", "/communities", {
    name: validFields.name,
    type: validFields.type,
    createdById: ownerId,
  });
  expectError(
    "validation: missing slug",
    missingSlug,
    400,
    HTTP_MESSAGES.createCommunityFields,
  );

  const missingType = await api("POST", "/communities", {
    name: validFields.name,
    slug: validFields.slug,
    createdById: ownerId,
  });
  expectError(
    "validation: missing type",
    missingType,
    400,
    HTTP_MESSAGES.createCommunityFields,
  );

  const missingCreator = await api("POST", "/communities", {
    name: validFields.name,
    slug: validFields.slug,
    type: validFields.type,
  });
  expectError(
    "validation: missing createdById",
    missingCreator,
    400,
    HTTP_MESSAGES.createCommunityFields,
  );

  const blankName = await api("POST", "/communities", {
    ...validFields,
    name: "   ",
  });
  expectError(
    "validation: blank name",
    blankName,
    400,
    HTTP_MESSAGES.createCommunityFields,
  );

  const unknownType = await api("POST", "/communities", {
    ...validFields,
    type: "secret",
  });
  expectError(
    "validation: unknown type",
    unknownType,
    400,
    COMMUNITY_TYPE_INVALID_MESSAGE,
  );

  const numericType = await api("POST", "/communities", {
    ...validFields,
    type: 42,
  });
  expectError(
    "validation: numeric type",
    numericType,
    400,
    HTTP_MESSAGES.createCommunityFields,
  );

  const foreignSlug = await api("POST", "/communities", {
    ...validFields,
    slug: "!!! not a slug !!!",
  });
  expectError(
    "validation: foreign slug characters",
    foreignSlug,
    400,
    COMMUNITY_SLUG_INVALID_MESSAGE,
  );

  const longSlug = await api("POST", "/communities", {
    ...validFields,
    slug: "a".repeat(121),
  });
  expectError(
    "validation: slug too long",
    longSlug,
    400,
    COMMUNITY_SLUG_TOO_LONG_MESSAGE,
  );

  const longName = await api("POST", "/communities", {
    ...validFields,
    name: "a".repeat(121),
  });
  expectError(
    "validation: name too long",
    longName,
    400,
    COMMUNITY_NAME_TOO_LONG_MESSAGE,
  );

  const numericDescription = await api("POST", "/communities", {
    ...validFields,
    description: 42,
  });
  expectError(
    "validation: non string description",
    numericDescription,
    400,
    COMMUNITY_DESCRIPTION_INVALID_MESSAGE,
  );

  const numericCoverImage = await api("POST", "/communities", {
    ...validFields,
    coverImageUrl: 42,
  });
  expectError(
    "validation: non string cover image",
    numericCoverImage,
    400,
    COMMUNITY_COVER_IMAGE_INVALID_MESSAGE,
  );

  const duplicateSlug = await api("POST", "/communities", {
    name: `Smoke Duplicate ${RUN_ID}`,
    slug: `  ${RUN_ID}  PUBLIC-club-'n   friends `,
    type: COMMUNITY_TYPES.PUBLIC,
    createdById: ownerId,
  });
  expectError(
    "validation: duplicate normalized slug",
    duplicateSlug,
    409,
    COMMUNITY_SLUG_TAKEN_MESSAGE,
  );

  const unknownCreator = await api("POST", "/communities", {
    ...validFields,
    createdById: crypto.randomUUID(),
  });
  expectError(
    "validation: creator without student profile",
    unknownCreator,
    404,
    STUDENT_PROFILE_NOT_FOUND_MESSAGE,
  );

  const unknownCommunityId = await api(
    "GET",
    `/communities/${crypto.randomUUID()}`,
  );
  expectError(
    "lookup: unknown community",
    unknownCommunityId,
    404,
    COMMUNITY_NOT_FOUND_MESSAGE,
  );

  const existingCommunity = await api("GET", `/communities/${publicId}`);
  expectStatus("lookup: community by id", existingCommunity, 200);
  expectEqual(
    "lookup: community by id returns the slug",
    readString(existingCommunity.body, "slug"),
    `${RUN_ID}-public-club-n-friends`,
  );
}

async function runOwnerMembershipChecks(
  ownerId: string,
  ids: CommunityIds,
): Promise<void> {
  console.log("\n--- owner membership ---");

  const ownerCommunities = await api(
    "GET",
    `/student-profiles/${ownerId}/communities`,
  );
  const ownerMemberships = asArray(ownerCommunities.body);

  expectStatus("owner: list own communities", ownerCommunities, 200);
  expectEqual("owner: belongs to both communities", ownerMemberships.length, 2);
  expectTrue(
    "owner: created communities are returned",
    hasCommunityId(ownerMemberships, ids.publicId) &&
      hasCommunityId(ownerMemberships, ids.privateId),
    ownerMemberships,
  );
  expectTrue(
    "owner: membership role, status and community",
    ownerMemberships.every(
      (membership) =>
        membership["role"] === COMMUNITY_MEMBER_ROLES.OWNER &&
        membership["status"] === COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE &&
        membership["userId"] === ownerId &&
        typeof asRecord(membership["community"])["id"] === "string",
    ),
    ownerMemberships,
  );

  const members = await api("GET", `/communities/${ids.publicId}/members`);
  const memberItems = readItems(members.body);
  const memberInfo = asRecord(memberItems[0]?.["member"]);

  expectStatus("members: default listing", members, 200);
  expectEqual("members: only the owner so far", readTotal(members.body), 1);
  expectEqual("members: default limit", asRecord(members.body)["limit"], 20);
  expectEqual("members: default page", asRecord(members.body)["page"], 1);
  expectEqual("members: default totalPages", asRecord(members.body)["totalPages"], 1);
  expectEqual(
    "members: owner role is surfaced",
    memberItems[0]?.["role"],
    COMMUNITY_MEMBER_ROLES.OWNER,
  );
  expectEqual(
    "members: owner status is active",
    memberItems[0]?.["status"],
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );
  expectEqual(
    "members: only public member fields are exposed",
    Object.keys(memberInfo).sort().join(","),
    "name,profileImageUrl,userId,username",
  );
  expectEqual("members: member username is exposed", memberInfo["username"], `${RUN_ID}-owner`);
  expectEqual("members: empty profile image defaults to null", memberInfo["profileImageUrl"], null);

  const privateMembers = await api("GET", `/communities/${ids.privateId}/members`);
  expectEqual("members: private community has only the owner", readTotal(privateMembers.body), 1);

  const emptyPending = await api(
    "GET",
    `/communities/${ids.publicId}/members?status=${COMMUNITY_MEMBERSHIP_STATUSES.PENDING}`,
  );
  expectStatus("members: pending filter is accepted", emptyPending, 200);
  expectEqual("members: no pending members yet", readTotal(emptyPending.body), 0);

  const unknownMembers = await api(
    "GET",
    `/communities/${crypto.randomUUID()}/members`,
  );
  expectError(
    "members: unknown community",
    unknownMembers,
    404,
    COMMUNITY_NOT_FOUND_MESSAGE,
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
  judy: string;
}

interface PublicJoinState {
  aliceMembershipId: string;
  daveMembershipId: string;
  graceMembershipId: string;
  ivanMembershipId: string;
}

async function runPublicJoinChecks(
  context: SmokeContext,
  ids: CommunityIds,
  users: SmokeUsers,
): Promise<PublicJoinState> {
  console.log("\n--- public community joins ---");

  const aliceMembership = await joinCommunity(
    "public community: active student",
    ids.publicId,
    users.alice,
  );

  expectEqual("public join: role defaults to member", aliceMembership["role"], COMMUNITY_MEMBER_ROLES.MEMBER);
  expectEqual("public join: status is active", aliceMembership["status"], COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE);
  expectEqual("public join: user is recorded", aliceMembership["userId"], users.alice);
  expectEqual("public join: community is recorded", aliceMembership["communityId"], ids.publicId);
  expectTrue(
    "public join: timestamps are ISO strings",
    typeof aliceMembership["createdAt"] === "string" &&
      typeof aliceMembership["updatedAt"] === "string",
    aliceMembership,
  );

  const duplicateJoin = await api(
    "POST",
    `/communities/${ids.publicId}/join`,
    { userId: users.alice },
  );
  expectError("public join: duplicate join", duplicateJoin, 409, ALREADY_ACTIVE_MEMBER_MESSAGE);

  const ownerDuplicateJoin = await api(
    "POST",
    `/communities/${ids.privateId}/join`,
    { userId: users.owner },
  );
  expectError(
    "public join: owner is already an active member",
    ownerDuplicateJoin,
    409,
    ALREADY_ACTIVE_MEMBER_MESSAGE,
  );

  const graceMembership = await joinCommunity(
    "public community: plain member for authorization checks",
    ids.publicId,
    users.grace,
  );
  const daveMembership = await joinCommunity(
    "public community: student to be banned",
    ids.publicId,
    users.dave,
  );
  const ivanMembership = await joinCommunity(
    "public community: student who will leave",
    ids.publicId,
    users.ivan,
  );

  const missingUser = await api("POST", `/communities/${ids.publicId}/join`, {});
  expectError("public join: missing userId", missingUser, 400, HTTP_MESSAGES.joinUserIdRequired);

  const blankUser = await api("POST", `/communities/${ids.publicId}/join`, {
    userId: "   ",
  });
  expectError("public join: blank userId", blankUser, 400, HTTP_MESSAGES.joinUserIdRequired);

  const unknownCommunity = await api(
    "POST",
    `/communities/${crypto.randomUUID()}/join`,
    { userId: users.judy },
  );
  expectError("public join: unknown community", unknownCommunity, 404, COMMUNITY_NOT_FOUND_MESSAGE);

  const unknownStudent = await api(
    "POST",
    `/communities/${ids.publicId}/join`,
    { userId: crypto.randomUUID() },
  );
  expectError(
    "public join: unknown student profile",
    unknownStudent,
    404,
    STUDENT_PROFILE_NOT_FOUND_MESSAGE,
  );

  const ghostUser = await api("POST", "/users", {
    email: `${RUN_ID}-ghost@bridgeed-smoke.test`,
    role: USER_ROLES.USER,
  });
  const ghostUserId = await requireCreatedId("setup: create user ghost", ghostUser, 201);

  context.createdUserIds.push(ghostUserId);

  const ghostJoin = await api("POST", `/communities/${ids.publicId}/join`, {
    userId: ghostUserId,
  });
  expectError(
    "public join: user without a student profile",
    ghostJoin,
    404,
    STUDENT_PROFILE_NOT_FOUND_MESSAGE,
  );

  return {
    aliceMembershipId: String(aliceMembership["id"]),
    daveMembershipId: String(daveMembership["id"]),
    graceMembershipId: String(graceMembership["id"]),
    ivanMembershipId: String(ivanMembership["id"]),
  };
}

interface PrivateRequestState {
  bobMembershipId: string;
  carolMembershipId: string;
  daveMembershipId: string;
}

function statusesOf(items: Record<string, unknown>[]): string[] {
  return items.map((item) => String(item["status"]));
}

async function runPrivateRequestChecks(
  ids: CommunityIds,
  users: SmokeUsers,
): Promise<PrivateRequestState> {
  console.log("\n--- private community join requests ---");

  const bobMembership = await joinCommunity(
    "private community: pending request",
    ids.privateId,
    users.bob,
  );

  expectEqual("private join: status is pending", bobMembership["status"], COMMUNITY_MEMBERSHIP_STATUSES.PENDING);
  expectEqual("private join: role defaults to member", bobMembership["role"], COMMUNITY_MEMBER_ROLES.MEMBER);
  expectEqual("private join: community is recorded", bobMembership["communityId"], ids.privateId);

  const duplicateRequest = await api(
    "POST",
    `/communities/${ids.privateId}/join`,
    { userId: users.bob },
  );
  expectError(
    "private join: duplicate pending request",
    duplicateRequest,
    409,
    JOIN_REQUEST_ALREADY_PENDING_MESSAGE,
  );

  const carolMembership = await joinCommunity(
    "private community: request that will be rejected",
    ids.privateId,
    users.carol,
  );
  const daveMembership = await joinCommunity(
    "private community: request decided by an admin",
    ids.privateId,
    users.dave,
  );

  const requests = await api(
    "GET",
    `/communities/${ids.privateId}/membership-requests?actorId=${users.owner}`,
  );
  const requestItems = readItems(requests.body);

  expectStatus("requests: owner can read pending requests", requests, 200);
  expectEqual("requests: all pending requests are returned", readTotal(requests.body), 3);
  expectTrue(
    "requests: only pending memberships are listed",
    statusesOf(requestItems).every(
      (status) => status === COMMUNITY_MEMBERSHIP_STATUSES.PENDING,
    ),
    requestItems,
  );
  expectTrue(
    "requests: requesting students are included",
    [users.bob, users.carol, users.dave].every((userId) =>
      userIdsOf(requestItems).includes(userId),
    ),
    requestItems,
  );
  expectEqual(
    "requests: requester profile is exposed",
    readString(findItemWithId(requestItems, users.bob, "userId")?.["member"], "username"),
    `${RUN_ID}-bob`,
  );
  expectEqual(
    "requests: requester profile hides private fields",
    Object.keys(asRecord(findItemWithId(requestItems, users.bob, "userId")?.["member"]))
      .sort()
      .join(","),
    "name,profileImageUrl,userId,username",
  );

  const pagedRequests = await api(
    "GET",
    `/communities/${ids.privateId}/membership-requests?actorId=${users.owner}&page=1&limit=2`,
  );
  expectEqual("requests: page size is applied", readItems(pagedRequests.body).length, 2);
  expectEqual("requests: total ignores paging", readTotal(pagedRequests.body), 3);
  expectEqual("requests: totalPages is derived", asRecord(pagedRequests.body)["totalPages"], 2);

  const lastRequestPage = await api(
    "GET",
    `/communities/${ids.privateId}/membership-requests?actorId=${users.owner}&page=2&limit=2`,
  );
  expectEqual("requests: last page holds the remainder", readItems(lastRequestPage.body).length, 1);

  const approvedBob = await api(
    "PATCH",
    `/community-memberships/${bobMembership["id"]}/approve`,
    { actorId: users.owner },
  );
  expectStatus("approve: owner approves a request", approvedBob, 200);
  expectEqual(
    "approve: membership becomes active",
    readString(approvedBob.body, "status"),
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );

  const approveAgain = await api(
    "PATCH",
    `/community-memberships/${bobMembership["id"]}/approve`,
    { actorId: users.owner },
  );
  expectError(
    "approve: already active membership",
    approveAgain,
    409,
    ONLY_PENDING_REQUEST_CAN_BE_APPROVED_MESSAGE,
  );

  const approveUnknown = await api(
    "PATCH",
    `/community-memberships/${crypto.randomUUID()}/approve`,
    { actorId: users.owner },
  );
  expectError(
    "approve: unknown membership",
    approveUnknown,
    404,
    COMMUNITY_MEMBERSHIP_NOT_FOUND_MESSAGE,
  );

  const approveWithoutActor = await api(
    "PATCH",
    `/community-memberships/${daveMembership["id"]}/approve`,
    {},
  );
  expectError(
    "approve: missing actorId",
    approveWithoutActor,
    400,
    HTTP_MESSAGES.actorIdRequired,
  );

  const rejectedCarol = await api(
    "PATCH",
    `/community-memberships/${carolMembership["id"]}/reject`,
    { actorId: users.owner },
  );
  expectStatus("reject: owner rejects a request", rejectedCarol, 200);
  expectEqual(
    "reject: membership becomes rejected",
    readString(rejectedCarol.body, "status"),
    COMMUNITY_MEMBERSHIP_STATUSES.REJECTED,
  );

  const rejectAgain = await api(
    "PATCH",
    `/community-memberships/${carolMembership["id"]}/reject`,
    { actorId: users.owner },
  );
  expectError(
    "reject: already rejected membership",
    rejectAgain,
    409,
    ONLY_PENDING_REQUEST_CAN_BE_REJECTED_MESSAGE,
  );

  const rejectedJoin = await api(
    "POST",
    `/communities/${ids.privateId}/join`,
    { userId: users.carol },
  );
  expectStatus("reject: rejected student may ask again", rejectedJoin, 201);
  expectEqual(
    "reject: re-request reuses the membership row",
    readString(rejectedJoin.body, "id"),
    String(carolMembership["id"]),
  );
  expectEqual(
    "reject: re-request status is pending again",
    readString(rejectedJoin.body, "status"),
    COMMUNITY_MEMBERSHIP_STATUSES.PENDING,
  );
  expectEqual(
    "reject: re-request role is reset to member",
    readString(rejectedJoin.body, "role"),
    COMMUNITY_MEMBER_ROLES.MEMBER,
  );

  const privateMembers = await api("GET", `/communities/${ids.privateId}/members`);
  const privateMemberUserIds = userIdsOf(readItems(privateMembers.body));

  expectEqual("private members: approved student is listed", privateMemberUserIds.includes(users.bob), true);
  expectEqual("private members: rejected student is not listed", privateMemberUserIds.includes(users.carol), false);
  expectEqual("private members: pending students are not listed", privateMemberUserIds.includes(users.dave), false);

  return {
    bobMembershipId: String(bobMembership["id"]),
    carolMembershipId: String(carolMembership["id"]),
    daveMembershipId: String(daveMembership["id"]),
  };
}

interface AuthorizationState {
  carolMembershipId: string;
  hankMembershipId: string;
}

async function runAuthorizationChecks(
  ids: CommunityIds,
  users: SmokeUsers,
  state: PrivateRequestState,
): Promise<AuthorizationState> {
  console.log("\n--- membership authorization ---");

  const erinMembership = await joinCommunity(
    "private community: student promoted to admin",
    ids.privateId,
    users.erin,
  );
  const frankMembership = await joinCommunity(
    "private community: student promoted to moderator",
    ids.privateId,
    users.frank,
  );
  const hankMembership = await joinCommunity(
    "private community: request approved by an admin",
    ids.privateId,
    users.hank,
  );

  const requests = await api(
    "GET",
    `/communities/${ids.privateId}/membership-requests?actorId=${users.owner}`,
  );
  expectStatus("authorization: owner reads requests", requests, 200);
  expectEqual("authorization: every pending request is listed", readTotal(requests.body), 5);

  const forbiddenReaders: Array<{ label: string; actorId: string }> = [
    { label: "public member", actorId: users.grace },
    { label: "student outside the community", actorId: users.judy },
    { label: "member with a pending request", actorId: users.hank },
    { label: "unknown student", actorId: crypto.randomUUID() },
  ];

  for (const reader of forbiddenReaders) {
    const forbidden = await api(
      "GET",
      `/communities/${ids.privateId}/membership-requests?actorId=${reader.actorId}`,
    );

    expectError(
      `authorization: ${reader.label} cannot read requests`,
      forbidden,
      403,
      MANAGE_MEMBERS_FORBIDDEN_MESSAGE,
    );
  }

  const requestsWithoutActor = await api(
    "GET",
    `/communities/${ids.privateId}/membership-requests`,
  );
  expectError(
    "authorization: requests need an actor",
    requestsWithoutActor,
    400,
    HTTP_MESSAGES.actorIdRequired,
  );

  const requestsWithBadPaging = await api(
    "GET",
    `/communities/${ids.privateId}/membership-requests?actorId=${users.owner}&page=0`,
  );
  expectError(
    "authorization: requests reject bad paging",
    requestsWithBadPaging,
    400,
    HTTP_MESSAGES.invalidPagination,
  );

  const rejectWithoutActor = await api(
    "PATCH",
    `/community-memberships/${state.daveMembershipId}/reject`,
    {},
  );
  expectError(
    "authorization: reject needs an actor",
    rejectWithoutActor,
    400,
    HTTP_MESSAGES.actorIdRequired,
  );

  const approvedFrank = await api(
    "PATCH",
    `/community-memberships/${frankMembership["id"]}/approve`,
    { actorId: users.owner },
  );
  expectStatus("authorization: owner approves the future moderator", approvedFrank, 200);
  expectEqual(
    "authorization: approved membership id is unchanged",
    readString(approvedFrank.body, "id"),
    String(frankMembership["id"]),
  );
  expectEqual(
    "authorization: approved membership is active",
    readString(approvedFrank.body, "status"),
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );

  const approvedErin = await api(
    "PATCH",
    `/community-memberships/${erinMembership["id"]}/approve`,
    { actorId: users.owner },
  );
  expectStatus("authorization: owner approves the future admin", approvedErin, 200);

  // Roles above member cannot be assigned through the public API yet, so the
  // elevated state is seeded directly in the database.
  await setMembershipRow(String(frankMembership["id"]), {
    role: "MODERATOR",
  });
  await setMembershipRow(String(erinMembership["id"]), { role: "ADMIN" });

  const activeMembers = await api(
    "GET",
    `/communities/${ids.privateId}/members`,
  );
  const activeMemberItems = readItems(activeMembers.body);

  expectEqual("authorization: active member count", readTotal(activeMembers.body), 4);
  expectTrue(
    "authorization: every role is surfaced in the member listing",
    ["owner", "member", "moderator", "admin"].every((role) =>
      activeMemberItems.some((member) => member["role"] === role),
    ),
    activeMemberItems,
  );
  expectTrue(
    "authorization: default member listing only returns active memberships",
    statusesOf(activeMemberItems).every(
      (status) => status === COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
    ),
    activeMemberItems,
  );

  const moderatorRequests = await api(
    "GET",
    `/communities/${ids.privateId}/membership-requests?actorId=${users.frank}`,
  );
  expectError(
    "authorization: moderator cannot read requests",
    moderatorRequests,
    403,
    MANAGE_MEMBERS_FORBIDDEN_MESSAGE,
  );

  const moderatorApproval = await api(
    "PATCH",
    `/community-memberships/${hankMembership["id"]}/approve`,
    { actorId: users.frank },
  );
  expectError(
    "authorization: moderator cannot approve requests",
    moderatorApproval,
    403,
    MANAGE_MEMBERS_FORBIDDEN_MESSAGE,
  );

  const moderatorRejection = await api(
    "PATCH",
    `/community-memberships/${state.carolMembershipId}/reject`,
    { actorId: users.frank },
  );
  expectError(
    "authorization: moderator cannot reject requests",
    moderatorRejection,
    403,
    MANAGE_MEMBERS_FORBIDDEN_MESSAGE,
  );

  const adminRequests = await api(
    "GET",
    `/communities/${ids.privateId}/membership-requests?actorId=${users.erin}`,
  );
  expectStatus("authorization: admin can read requests", adminRequests, 200);
  expectEqual("authorization: admin sees the pending requests", readTotal(adminRequests.body), 3);

  const adminApproval = await api(
    "PATCH",
    `/community-memberships/${hankMembership["id"]}/approve`,
    { actorId: users.erin },
  );
  expectStatus("authorization: admin can approve requests", adminApproval, 200);
  expectEqual(
    "authorization: admin approval activates the membership",
    readString(adminApproval.body, "status"),
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );

  const adminRejection = await api(
    "PATCH",
    `/community-memberships/${state.daveMembershipId}/reject`,
    { actorId: users.erin },
  );
  expectStatus("authorization: admin can reject requests", adminRejection, 200);
  expectEqual(
    "authorization: admin rejection rejects the membership",
    readString(adminRejection.body, "status"),
    COMMUNITY_MEMBERSHIP_STATUSES.REJECTED,
  );

  const approveRejected = await api(
    "PATCH",
    `/community-memberships/${state.daveMembershipId}/approve`,
    { actorId: users.owner },
  );
  expectError(
    "authorization: rejected membership cannot be approved",
    approveRejected,
    409,
    ONLY_PENDING_REQUEST_CAN_BE_APPROVED_MESSAGE,
  );

  const finalPrivateMembers = await api(
    "GET",
    `/communities/${ids.privateId}/members`,
  );
  expectEqual("authorization: private community member count", readTotal(finalPrivateMembers.body), 5);

  const moderatorDetails = await api(
    "GET",
    `/community-memberships/${frankMembership["id"]}`,
  );
  const moderatorDetailsBody = asRecord(moderatorDetails.body);
  const moderatorDetailsMember = asRecord(moderatorDetailsBody["member"]);
  const moderatorDetailsCommunity = asRecord(moderatorDetailsBody["community"]);

  expectStatus("authorization: membership details", moderatorDetails, 200);
  expectEqual("authorization: details expose the elevated role", moderatorDetailsBody["role"], "moderator");
  expectEqual("authorization: details expose the status", moderatorDetailsBody["status"], COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE);
  expectEqual("authorization: details expose the community", moderatorDetailsCommunity["id"], ids.privateId);
  expectEqual("authorization: details expose the community slug", moderatorDetailsCommunity["slug"], `${RUN_ID}-private-circle`);
  expectEqual("authorization: details expose the member", moderatorDetailsMember["username"], `${RUN_ID}-frank`);
  expectEqual("authorization: details hide account fields", moderatorDetailsMember["email"], undefined);

  return {
    carolMembershipId: state.carolMembershipId,
    hankMembershipId: String(hankMembership["id"]),
  };
}

async function runBanChecks(
  ids: CommunityIds,
  users: SmokeUsers,
  state: PublicJoinState,
): Promise<void> {
  console.log("\n--- banned memberships ---");

  // A ban can only be produced by a future moderation endpoint, so the state is
  // seeded directly in the database.
  await setMembershipRow(state.daveMembershipId, { status: "BANNED" });

  const bannedJoin = await api("POST", `/communities/${ids.publicId}/join`, {
    userId: users.dave,
  });
  expectError(
    "ban: banned student cannot join again",
    bannedJoin,
    409,
    BANNED_FROM_COMMUNITY_MESSAGE,
  );

  const bannedLeave = await api(
    "DELETE",
    `/communities/${ids.publicId}/membership`,
    { actorId: users.dave },
  );
  expectError(
    "ban: banned student cannot leave",
    bannedLeave,
    409,
    BANNED_FROM_COMMUNITY_MESSAGE,
  );

  const bannedMembers = await api(
    "GET",
    `/communities/${ids.publicId}/members?status=${COMMUNITY_MEMBERSHIP_STATUSES.BANNED}`,
  );
  const bannedItems = readItems(bannedMembers.body);

  expectStatus("ban: banned filter is accepted", bannedMembers, 200);
  expectEqual("ban: banned listing only contains the banned student", readTotal(bannedMembers.body), 1);
  expectEqual("ban: banned student is listed", bannedItems[0]?.["userId"], users.dave);
  expectEqual("ban: banned status is surfaced", bannedItems[0]?.["status"], COMMUNITY_MEMBERSHIP_STATUSES.BANNED);

  const defaultMembers = await api("GET", `/communities/${ids.publicId}/members`);
  const defaultMemberUserIds = userIdsOf(readItems(defaultMembers.body));

  expectEqual("ban: default listing hides banned memberships", defaultMemberUserIds.includes(users.dave), false);
  expectEqual("ban: default listing contains the active members", readTotal(defaultMembers.body), 4);

  const firstMemberPage = await api(
    "GET",
    `/communities/${ids.publicId}/members?page=1&limit=2`,
  );
  expectEqual("ban: member page size is applied", readItems(firstMemberPage.body).length, 2);
  expectEqual("ban: member total ignores paging", readTotal(firstMemberPage.body), 4);
  expectEqual("ban: member totalPages is derived", asRecord(firstMemberPage.body)["totalPages"], 2);

  const secondMemberPage = await api(
    "GET",
    `/communities/${ids.publicId}/members?page=2&limit=2`,
  );
  expectEqual("ban: second member page holds the remainder", readItems(secondMemberPage.body).length, 2);

  const limitedMembers = await api(
    "GET",
    `/communities/${ids.publicId}/members?limit=1000`,
  );
  expectEqual("ban: limit is clamped to the maximum page size", asRecord(limitedMembers.body)["limit"], 100);

  const invalidStatus = await api(
    "GET",
    `/communities/${ids.publicId}/members?status=ACTIVE`,
  );
  expectError(
    "ban: status filter is case sensitive",
    invalidStatus,
    400,
    HTTP_MESSAGES.invalidMembershipStatus,
  );

  const invalidPage = await api(
    "GET",
    `/communities/${ids.publicId}/members?page=abc`,
  );
  expectError("ban: page must be numeric", invalidPage, 400, HTTP_MESSAGES.invalidPagination);

  const zeroLimit = await api(
    "GET",
    `/communities/${ids.publicId}/members?limit=0`,
  );
  expectError("ban: limit must be positive", zeroLimit, 400, HTTP_MESSAGES.invalidPagination);
}

async function runLeaveChecks(
  ids: CommunityIds,
  users: SmokeUsers,
  state: PublicJoinState,
  authorization: AuthorizationState,
): Promise<void> {
  console.log("\n--- leaving and cancelling requests ---");

  const leaveResult = await api(
    "DELETE",
    `/communities/${ids.publicId}/membership`,
    { actorId: users.ivan },
  );
  expectStatus("leave: active member leaves", leaveResult, 204);
  expectEqual("leave: response has no body", leaveResult.body, null);

  const membersAfterLeave = await api("GET", `/communities/${ids.publicId}/members`);
  expectEqual("leave: member count drops", readTotal(membersAfterLeave.body), 3);
  expectEqual(
    "leave: the member is removed",
    userIdsOf(readItems(membersAfterLeave.body)).includes(users.ivan),
    false,
  );

  const secondLeave = await api(
    "DELETE",
    `/communities/${ids.publicId}/membership`,
    { actorId: users.ivan },
  );
  expectError(
    "leave: removed member cannot leave twice",
    secondLeave,
    404,
    COMMUNITY_MEMBERSHIP_NOT_FOUND_MESSAGE,
  );

  const ownerLeave = await api(
    "DELETE",
    `/communities/${ids.privateId}/membership`,
    { actorId: users.owner },
  );
  expectError("leave: owner cannot leave", ownerLeave, 409, OWNER_CANNOT_LEAVE_MESSAGE);

  const rejectedLeave = await api(
    "DELETE",
    `/communities/${ids.privateId}/membership`,
    { actorId: users.dave },
  );
  expectError(
    "leave: rejected request cannot leave",
    rejectedLeave,
    409,
    NOT_ACTIVE_MEMBER_MESSAGE,
  );

  const leaveWithoutActor = await api(
    "DELETE",
    `/communities/${ids.publicId}/membership`,
  );
  expectError(
    "leave: actor is required",
    leaveWithoutActor,
    400,
    HTTP_MESSAGES.actorIdRequired,
  );

  const leaveUnknownCommunity = await api(
    "DELETE",
    `/communities/${crypto.randomUUID()}/membership`,
    { actorId: users.grace },
  );
  expectError(
    "leave: unknown community",
    leaveUnknownCommunity,
    404,
    COMMUNITY_NOT_FOUND_MESSAGE,
  );

  const strangerRemoval = await api(
    "DELETE",
    `/communities/${ids.publicId}/membership`,
    { actorId: users.judy },
  );
  expectError(
    "leave: outsider cannot remove memberships",
    strangerRemoval,
    404,
    COMMUNITY_MEMBERSHIP_NOT_FOUND_MESSAGE,
  );

  const aliceAfterStranger = await api(
    "GET",
    `/community-memberships/${state.aliceMembershipId}`,
  );
  expectEqual(
    "leave: other memberships are untouched",
    readString(aliceAfterStranger.body, "status"),
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );

  const cancelRequest = await api(
    "DELETE",
    `/communities/${ids.privateId}/membership`,
    { actorId: users.carol },
  );
  expectStatus("cancel: pending request is cancelled", cancelRequest, 204);

  const requestsAfterCancel = await api(
    "GET",
    `/communities/${ids.privateId}/membership-requests?actorId=${users.owner}`,
  );
  expectEqual("cancel: cancelled request disappears", readTotal(requestsAfterCancel.body), 0);

  const rejoinedCarol = await api(
    "POST",
    `/communities/${ids.privateId}/join`,
    { userId: users.carol },
  );
  expectStatus("cancel: cancelled student may ask again", rejoinedCarol, 201);

  const rejoinedCarolId = readString(rejoinedCarol.body, "id");

  expectEqual(
    "cancel: the new request is a fresh membership",
    rejoinedCarolId === authorization.carolMembershipId,
    false,
  );
  expectEqual(
    "cancel: the new request is pending",
    readString(rejoinedCarol.body, "status"),
    COMMUNITY_MEMBERSHIP_STATUSES.PENDING,
  );

  const approveCancelled = await api(
    "PATCH",
    `/community-memberships/${authorization.carolMembershipId}/approve`,
    { actorId: users.owner },
  );
  expectError(
    "cancel: the cancelled membership is gone",
    approveCancelled,
    404,
    COMMUNITY_MEMBERSHIP_NOT_FOUND_MESSAGE,
  );

  const approveRejoined = await api(
    "PATCH",
    `/community-memberships/${rejoinedCarolId}/approve`,
    { actorId: users.owner },
  );
  expectStatus("cancel: re-joined request can be approved", approveRejoined, 200);

  const finalPrivateMembers = await api("GET", `/communities/${ids.privateId}/members`);
  expectEqual("cancel: private community member count", readTotal(finalPrivateMembers.body), 6);

  const kickAttempt = await api(
    "DELETE",
    `/communities/${ids.publicId}/membership`,
    { actorId: users.grace, userId: users.alice },
  );
  expectStatus("kick: body userId is not used as a target", kickAttempt, 204);

  const membersAfterKickAttempt = await api(
    "GET",
    `/communities/${ids.publicId}/members`,
  );
  const memberUserIdsAfterKick = userIdsOf(readItems(membersAfterKickAttempt.body));

  expectEqual("kick: no other membership was removed", memberUserIdsAfterKick.includes(users.alice), true);
  expectEqual("kick: the actor only removed itself", memberUserIdsAfterKick.includes(users.grace), false);
  expectEqual("kick: public community member count", readTotal(membersAfterKickAttempt.body), 2);
}

async function runListingChecks(
  ids: CommunityIds,
  users: SmokeUsers,
): Promise<void> {
  console.log("\n--- community and membership listings ---");

  const allCommunities = await api("GET", "/communities?page=1&limit=100");
  const allCommunityItems = readItems(allCommunities.body);
  const allCommunityTotal = readTotal(allCommunities.body) ?? 0;

  expectStatus("listing: communities page", allCommunities, 200);
  expectEqual("listing: page size is applied", asRecord(allCommunities.body)["limit"], 100);
  expectEqual("listing: page number is echoed", asRecord(allCommunities.body)["page"], 1);
  expectEqual(
    "listing: totalPages is derived",
    asRecord(allCommunities.body)["totalPages"],
    Math.ceil(allCommunityTotal / 100),
  );
  expectTrue(
    "listing: both smoke communities are listed",
    allCommunityTotal <= 100
      ? hasItemWithId(allCommunityItems, ids.publicId) &&
          hasItemWithId(allCommunityItems, ids.privateId)
      : true,
    { total: allCommunityTotal, items: allCommunityItems.length },
  );

  const clampedCommunities = await api("GET", "/communities?limit=1000");
  expectEqual(
    "listing: oversized page size is clamped",
    asRecord(clampedCommunities.body)["limit"],
    100,
  );

  const badPage = await api("GET", "/communities?page=abc");
  expectError("listing: page must be numeric", badPage, 400, HTTP_MESSAGES.invalidPagination);

  const fractionalPage = await api("GET", "/communities?page=1.5");
  expectError("listing: page must be an integer", fractionalPage, 400, HTTP_MESSAGES.invalidPagination);

  const negativeLimit = await api("GET", "/communities?limit=-1");
  expectError("listing: limit cannot be negative", negativeLimit, 400, HTTP_MESSAGES.invalidPagination);

  const aliceCommunities = await api(
    "GET",
    `/student-profiles/${users.alice}/communities`,
  );
  const aliceCommunitiesBody = asArray(aliceCommunities.body);

  expectStatus("listing: student communities", aliceCommunities, 200);
  expectEqual("listing: public member belongs to one community", aliceCommunitiesBody.length, 1);
  expectEqual(
    "listing: the community is embedded",
    readString(aliceCommunitiesBody[0]?.["community"], "id"),
    ids.publicId,
  );
  expectEqual(
    "listing: the embedded community keeps its type",
    readString(aliceCommunitiesBody[0]?.["community"], "type"),
    COMMUNITY_TYPES.PUBLIC,
  );
  expectEqual(
    "listing: the membership status is embedded",
    aliceCommunitiesBody[0]?.["status"],
    COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );

  const aliceActive = await api(
    "GET",
    `/student-profiles/${users.alice}/communities?status=${COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE}`,
  );
  expectEqual("listing: active filter matches", asArray(aliceActive.body).length, 1);

  const alicePending = await api(
    "GET",
    `/student-profiles/${users.alice}/communities?status=${COMMUNITY_MEMBERSHIP_STATUSES.PENDING}`,
  );
  expectEqual("listing: pending filter is empty", asArray(alicePending.body).length, 0);

  const daveCommunities = await api(
    "GET",
    `/student-profiles/${users.dave}/communities`,
  );
  const daveCommunitiesBody = asArray(daveCommunities.body);

  expectEqual("listing: every membership status is visible to the student", daveCommunitiesBody.length, 2);
  expectTrue(
    "listing: banned and rejected memberships are both returned",
    daveCommunitiesBody.some(
      (membership) =>
        membership["status"] === COMMUNITY_MEMBERSHIP_STATUSES.BANNED,
    ) &&
      daveCommunitiesBody.some(
        (membership) =>
          membership["status"] === COMMUNITY_MEMBERSHIP_STATUSES.REJECTED,
      ),
    daveCommunitiesBody,
  );

  const daveBanned = await api(
    "GET",
    `/student-profiles/${users.dave}/communities?status=${COMMUNITY_MEMBERSHIP_STATUSES.BANNED}`,
  );
  expectEqual("listing: banned filter matches", asArray(daveBanned.body).length, 1);

  const judyCommunities = await api(
    "GET",
    `/student-profiles/${users.judy}/communities`,
  );
  expectEqual("listing: unrelated student has no memberships", asArray(judyCommunities.body).length, 0);

  const judyPending = await api(
    "GET",
    `/student-profiles/${users.judy}/communities?status=${COMMUNITY_MEMBERSHIP_STATUSES.PENDING}`,
  );
  expectEqual("listing: unrelated student has no pending requests", asArray(judyPending.body).length, 0);

  const unknownStudentCommunities = await api(
    "GET",
    `/student-profiles/${crypto.randomUUID()}/communities`,
  );
  expectError(
    "listing: unknown student profile",
    unknownStudentCommunities,
    404,
    STUDENT_PROFILE_NOT_FOUND_MESSAGE,
  );

  const invalidStudentStatus = await api(
    "GET",
    `/student-profiles/${users.alice}/communities?status=ACTIVE`,
  );
  expectError(
    "listing: status filter is case sensitive",
    invalidStudentStatus,
    400,
    HTTP_MESSAGES.invalidMembershipStatus,
  );
}


async function runDetailsChecks(
  ids: CommunityIds,
  users: SmokeUsers,
  state: PublicJoinState,
): Promise<void> {
  console.log("\n--- membership details ---");

  const details = await api(
    "GET",
    `/community-memberships/${state.aliceMembershipId}`,
  );
  const detailsBody = asRecord(details.body);
  const member = asRecord(detailsBody["member"]);
  const community = asRecord(detailsBody["community"]);

  expectStatus("details: membership by id", details, 200);
  expectEqual(
    "details: the exposed field set is stable",
    Object.keys(detailsBody).sort().join(","),
    "community,communityId,createdAt,id,member,role,status,updatedAt,userId",
  );
  expectEqual("details: owning student", detailsBody["userId"], users.alice);
  expectEqual("details: community reference", detailsBody["communityId"], ids.publicId);
  expectEqual("details: role", detailsBody["role"], COMMUNITY_MEMBER_ROLES.MEMBER);
  expectEqual("details: status", detailsBody["status"], COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE);
  expectEqual("details: member username", member["username"], `${RUN_ID}-alice`);
  expectTrue(
    "details: member name is exposed",
    typeof member["name"] === "string" && member["name"].includes("alice"),
    member,
  );
  expectEqual("details: missing profile image is null", member["profileImageUrl"], null);
  expectEqual("details: account fields are not leaked", member["email"], undefined);
  expectEqual("details: community slug", community["slug"], `${RUN_ID}-public-club-n-friends`);
  expectEqual("details: community name", community["name"], `Smoke Public Club ${RUN_ID}`);
  expectEqual("details: community type", community["type"], COMMUNITY_TYPES.PUBLIC);

  const unknownMembership = await api(
    "GET",
    `/community-memberships/${crypto.randomUUID()}`,
  );
  expectError(
    "details: unknown membership",
    unknownMembership,
    404,
    COMMUNITY_MEMBERSHIP_NOT_FOUND_MESSAGE,
  );
}

async function runRegressionChecks(
  ids: CommunityIds,
  users: SmokeUsers,
): Promise<void> {
  console.log("\n--- regression: previously shipped endpoints ---");

  const health = await api("GET", "/health");
  expectStatus("regression: health", health, 200);
  expectEqual("regression: health status", readString(health.body, "status"), "ok");
  expectEqual("regression: health service", readString(health.body, "service"), "bridgeed-api");

  const ownerUser = await api("GET", `/users/${users.owner}`);
  expectStatus("regression: user by id", ownerUser, 200);
  expectEqual("regression: user role", readString(ownerUser.body, "role"), USER_ROLES.USER);
  expectTrue(
    "regression: user email carries the run prefix",
    (readString(ownerUser.body, "email") ?? "").startsWith(RUN_ID),
    ownerUser.body,
  );

  const unknownUser = await api("GET", `/users/${crypto.randomUUID()}`);
  expectError("regression: unknown user", unknownUser, 404, "User not found");

  const ownerProfile = await api("GET", `/student-profiles/${users.owner}`);
  expectStatus("regression: student profile by user id", ownerProfile, 200);
  expectEqual(
    "regression: student profile username",
    readString(ownerProfile.body, "username"),
    `${RUN_ID}-owner`,
  );
  expectEqual("regression: student profile user link", readString(ownerProfile.body, "userId"), users.owner);

  const unknownProfile = await api(
    "GET",
    `/student-profiles/${crypto.randomUUID()}`,
  );
  expectError("regression: unknown student profile", unknownProfile, 404, "Student profile not found");

  const connections = await api(
    "GET",
    `/student-profiles/${users.owner}/connections`,
  );
  expectStatus("regression: student connections", connections, 200);
  expectEqual("regression: a new student has no connections", asArray(connections.body).length, 0);

  const metadataChecks: ReadonlyArray<readonly [string, string]> = [
    ["skills", "/skills"],
    ["interests", "/interests"],
    ["universities", "/universities"],
  ];

  for (const [label, path] of metadataChecks) {
    const response = await api("GET", path);
    expectStatus(`regression: ${label} listing`, response, 200);
    expectTrue(
      `regression: ${label} listing returns a list`,
      Array.isArray(response.body) || Array.isArray(asRecord(response.body)["items"]),
      response.body,
    );
  }

  const privateCommunity = await api("GET", `/communities/${ids.privateId}`);
  expectStatus("regression: community by id", privateCommunity, 200);
  expectEqual(
    "regression: private community keeps its type",
    readString(privateCommunity.body, "type"),
    COMMUNITY_TYPES.PRIVATE,
  );
  expectEqual(
    "regression: private community name",
    readString(privateCommunity.body, "name"),
    `Smoke Private Circle ${RUN_ID}`,
  );
}


async function setupStudents(context: SmokeContext): Promise<SmokeUsers> {
  console.log("\n--- setup ---");

  const owner = await createStudent(context, "owner");
  const alice = await createStudent(context, "alice");
  const bob = await createStudent(context, "bob");
  const carol = await createStudent(context, "carol");
  const dave = await createStudent(context, "dave");
  const erin = await createStudent(context, "erin");
  const frank = await createStudent(context, "frank");
  const grace = await createStudent(context, "grace");
  const hank = await createStudent(context, "hank");
  const ivan = await createStudent(context, "ivan");
  const judy = await createStudent(context, "judy");

  return {
    owner,
    alice,
    bob,
    carol,
    dave,
    erin,
    frank,
    grace,
    hank,
    ivan,
    judy,
  };
}

/** Users this run owns: tracked ids plus every row stamped with `RUN_PREFIX`. */
function userWhere(context: SmokeContext): Prisma.UserWhereInput {
  return {
    OR: [
      { id: { in: context.createdUserIds } },
      { email: { startsWith: RUN_PREFIX } },
    ],
  };
}

/** Student profiles this run owns: tracked user ids plus `RUN_PREFIX` usernames. */
function profileWhere(context: SmokeContext): Prisma.StudentProfileWhereInput {
  return {
    OR: [
      { userId: { in: context.createdUserIds } },
      { username: { startsWith: RUN_PREFIX } },
    ],
  };
}

/** Communities this run owns: tracked ids plus `RUN_PREFIX` slugs and names. */
function communityWhere(context: SmokeContext): Prisma.CommunityWhereInput {
  return {
    OR: [
      { id: { in: context.createdCommunityIds } },
      { slug: { startsWith: RUN_PREFIX } },
      { name: { endsWith: ` ${RUN_ID}` } },
    ],
  };
}

/** Skill rows seeded for this run (the name carries this run's id). */
function skillWhere(): Prisma.SkillWhereInput {
  return {
    AND: [
      { name: { startsWith: RUN_SKILL_NAME_PREFIX } },
      { name: { endsWith: RUN_ID } },
    ],
  };
}

/** Interest rows seeded for this run (the name carries this run's id). */
function interestWhere(): Prisma.InterestWhereInput {
  return {
    AND: [
      { name: { startsWith: RUN_INTEREST_NAME_PREFIX } },
      { name: { endsWith: RUN_ID } },
    ],
  };
}

function uniqueIds(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Resolves every user and community id this run can be shown to own. Tracked ids
 * are merged with the rows stamped with this run's prefix, so rows created just
 * before a failing check (and therefore never tracked) are still removed.
 */
async function resolveRunRowIds(context: SmokeContext): Promise<RunRowIds> {
  try {
    const users = await prisma.user.findMany({
      where: userWhere(context),
      select: { id: true },
    });
    const profiles = await prisma.studentProfile.findMany({
      where: profileWhere(context),
      select: { userId: true },
    });
    const communities = await prisma.community.findMany({
      where: communityWhere(context),
      select: { id: true },
    });

    return {
      userIds: uniqueIds([
        ...context.createdUserIds,
        ...users.map((user) => user.id),
        ...profiles.map((profile) => profile.userId),
      ]),
      communityIds: uniqueIds([
        ...context.createdCommunityIds,
        ...communities.map((community) => community.id),
      ]),
    };
  } catch (error) {
    console.error("cleanup: could not resolve run rows, falling back to tracked ids", error);
    process.exitCode = 1;

    return {
      userIds: uniqueIds(context.createdUserIds),
      communityIds: uniqueIds(context.createdCommunityIds),
    };
  }
}

/** Collects ids for one node of the run's graph without aborting the cleanup. */
async function collectIds(
  label: string,
  run: () => Promise<{ id: string }[]>,
): Promise<string[]> {
  try {
    const rows = await run();

    return rows.map((row) => row.id);
  } catch (error) {
    console.error(`cleanup: ${label} lookup failed`, error);
    process.exitCode = 1;

    return [];
  }
}

/** Runs one delete step; a failure is reported but never blocks the other steps. */
async function deleteStep(
  label: string,
  run: () => Promise<{ count: number }>,
): Promise<number> {
  try {
    const result = await run();

    return result.count;
  } catch (error) {
    console.error(`cleanup: ${label} failed`, error);
    process.exitCode = 1;

    return 0;
  }
}


/**
 * Removes every row created by this run. Deletion walks from the leaf tables
 * (reactions, comments, posts, connections, skills, interests, memberships) to
 * the communities, profiles and users they belong to, so foreign keys are never
 * violated and pre-existing rows are never touched.
 */
async function cleanup(context: SmokeContext): Promise<void> {
  console.log("\n--- cleanup ---");

  const { userIds, communityIds } = await resolveRunRowIds(context);

  const postIds = await collectIds("post", () =>
    prisma.post.findMany({
      where: {
        OR: [{ authorId: { in: userIds } }, { communityId: { in: communityIds } }],
      },
      select: { id: true },
    }),
  );

  const commentIds = await collectIds("comment", () =>
    prisma.comment.findMany({
      where: {
        OR: [{ authorId: { in: userIds } }, { postId: { in: postIds } }],
      },
      select: { id: true },
    }),
  );

  const postReactions = await deleteStep("post reactions", () =>
    prisma.postReaction.deleteMany({
      where: {
        OR: [{ postId: { in: postIds } }, { userId: { in: userIds } }],
      },
    }),
  );

  const commentReactions = await deleteStep("comment reactions", () =>
    prisma.commentReaction.deleteMany({
      where: {
        OR: [{ commentId: { in: commentIds } }, { userId: { in: userIds } }],
      },
    }),
  );

  const comments = await deleteStep("comments", () =>
    prisma.comment.deleteMany({
      where: {
        OR: [
          { id: { in: commentIds } },
          { postId: { in: postIds } },
          { authorId: { in: userIds } },
        ],
      },
    }),
  );

  const posts = await deleteStep("posts", () =>
    prisma.post.deleteMany({
      where: {
        OR: [
          { id: { in: postIds } },
          { communityId: { in: communityIds } },
          { authorId: { in: userIds } },
        ],
      },
    }),
  );

  const connections = await deleteStep("connections", () =>
    prisma.connection.deleteMany({
      where: {
        OR: [
          { requesterId: { in: userIds } },
          { receiverId: { in: userIds } },
          { blockedById: { in: userIds } },
        ],
      },
    }),
  );

  const studentSkills = await deleteStep("student skills", () =>
    prisma.studentSkill.deleteMany({
      where: { studentId: { in: userIds } },
    }),
  );

  const studentInterests = await deleteStep("student interests", () =>
    prisma.studentInterest.deleteMany({
      where: { studentId: { in: userIds } },
    }),
  );

  const skills = await deleteStep("skills", () =>
    prisma.skill.deleteMany({ where: skillWhere() }),
  );

  const interests = await deleteStep("interests", () =>
    prisma.interest.deleteMany({ where: interestWhere() }),
  );

  const memberships = await deleteStep("memberships", () =>
    prisma.communityMembership.deleteMany({
      where: {
        OR: [
          { communityId: { in: communityIds } },
          { userId: { in: userIds } },
        ],
      },
    }),
  );

  const communities = await deleteStep("communities", () =>
    prisma.community.deleteMany({ where: communityWhere(context) }),
  );

  const profiles = await deleteStep("student profiles", () =>
    prisma.studentProfile.deleteMany({ where: profileWhere(context) }),
  );

  const users = await deleteStep("users", () =>
    prisma.user.deleteMany({ where: userWhere(context) }),
  );

  console.log(
    `removed ${postReactions} post reactions, ${commentReactions} comment reactions, ` +
      `${comments} comments, ${posts} posts, ${connections} connections, ` +
      `${studentSkills} student skills, ${studentInterests} student interests, ` +
      `${skills} skills, ${interests} interests, ${memberships} memberships, ` +
      `${communities} communities, ${profiles} student profiles, ${users} users`,
  );
}

/** Snapshot of the dev database before the run, so the audit can prove nothing else was lost. */
async function readBaseline(): Promise<BaselineCounts> {
  return {
    users: await prisma.user.count(),
    profiles: await prisma.studentProfile.count(),
    communities: await prisma.community.count(),
    memberships: await prisma.communityMembership.count(),
    posts: await prisma.post.count(),
    comments: await prisma.comment.count(),
    postReactions: await prisma.postReaction.count(),
    commentReactions: await prisma.commentReaction.count(),
    connections: await prisma.connection.count(),
    studentSkills: await prisma.studentSkill.count(),
    studentInterests: await prisma.studentInterest.count(),
    skills: await prisma.skill.count(),
    interests: await prisma.interest.count(),
  };
}

/**
 * Confirms that no row created by this run survived (including rows that were
 * never tracked, matched through this run's `RUN_ID` prefix) and that no
 * pre-existing row was deleted.
 */
async function auditCleanup(
  context: SmokeContext,
  baseline: BaselineCounts,
): Promise<void> {
  console.log("\n--- cleanup audit ---");

  const { userIds, communityIds } = await resolveRunRowIds(context);

  const leftoverUsers = await prisma.user.count({ where: userWhere(context) });
  const leftoverProfiles = await prisma.studentProfile.count({
    where: profileWhere(context),
  });
  const leftoverCommunities = await prisma.community.count({
    where: communityWhere(context),
  });
  const leftoverTrackedUsers = await prisma.user.count({
    where: { id: { in: context.createdUserIds } },
  });
  const leftoverTrackedProfiles = await prisma.studentProfile.count({
    where: { userId: { in: context.createdUserIds } },
  });
  const leftoverTrackedCommunities = await prisma.community.count({
    where: { id: { in: context.createdCommunityIds } },
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
        { communityId: { in: communityIds } },
        { authorId: { in: userIds } },
      ],
    },
  });
  const leftoverComments = await prisma.comment.count({
    where: { authorId: { in: userIds } },
  });
  const leftoverPostReactions = await prisma.postReaction.count({
    where: { userId: { in: userIds } },
  });
  const leftoverCommentReactions = await prisma.commentReaction.count({
    where: { userId: { in: userIds } },
  });
  const leftoverConnections = await prisma.connection.count({
    where: {
      OR: [
        { requesterId: { in: userIds } },
        { receiverId: { in: userIds } },
        { blockedById: { in: userIds } },
      ],
    },
  });
  const leftoverStudentSkills = await prisma.studentSkill.count({
    where: { studentId: { in: userIds } },
  });
  const leftoverStudentInterests = await prisma.studentInterest.count({
    where: { studentId: { in: userIds } },
  });
  const leftoverSkills = await prisma.skill.count({ where: skillWhere() });
  const leftoverInterests = await prisma.interest.count({ where: interestWhere() });

  expectEqual("audit: leftover test users", leftoverUsers, 0);
  expectEqual("audit: leftover test student profiles", leftoverProfiles, 0);
  expectEqual("audit: leftover test communities", leftoverCommunities, 0);
  expectEqual("audit: leftover tracked users", leftoverTrackedUsers, 0);
  expectEqual("audit: leftover tracked student profiles", leftoverTrackedProfiles, 0);
  expectEqual("audit: leftover tracked communities", leftoverTrackedCommunities, 0);
  expectEqual("audit: leftover test memberships", leftoverMemberships, 0);
  expectEqual("audit: leftover test posts", leftoverPosts, 0);
  expectEqual("audit: leftover test comments", leftoverComments, 0);
  expectEqual("audit: leftover test post reactions", leftoverPostReactions, 0);
  expectEqual("audit: leftover test comment reactions", leftoverCommentReactions, 0);
  expectEqual("audit: leftover test connections", leftoverConnections, 0);
  expectEqual("audit: leftover test student skills", leftoverStudentSkills, 0);
  expectEqual("audit: leftover test student interests", leftoverStudentInterests, 0);
  expectEqual("audit: leftover test skills", leftoverSkills, 0);
  expectEqual("audit: leftover test interests", leftoverInterests, 0);

  const currentUsers = await prisma.user.count();
  const currentProfiles = await prisma.studentProfile.count();
  const currentCommunities = await prisma.community.count();
  const currentMemberships = await prisma.communityMembership.count();
  const currentPosts = await prisma.post.count();
  const currentComments = await prisma.comment.count();
  const currentPostReactions = await prisma.postReaction.count();
  const currentCommentReactions = await prisma.commentReaction.count();
  const currentConnections = await prisma.connection.count();
  const currentStudentSkills = await prisma.studentSkill.count();
  const currentStudentInterests = await prisma.studentInterest.count();
  const currentSkills = await prisma.skill.count();
  const currentInterests = await prisma.interest.count();

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
    "audit: pre-existing comment reactions were not deleted",
    currentCommentReactions >= baseline.commentReactions,
    { baseline: baseline.commentReactions, current: currentCommentReactions },
  );
  expectTrue(
    "audit: pre-existing connections were not deleted",
    currentConnections >= baseline.connections,
    { baseline: baseline.connections, current: currentConnections },
  );
  expectTrue(
    "audit: pre-existing student skills were not deleted",
    currentStudentSkills >= baseline.studentSkills,
    { baseline: baseline.studentSkills, current: currentStudentSkills },
  );
  expectTrue(
    "audit: pre-existing student interests were not deleted",
    currentStudentInterests >= baseline.studentInterests,
    { baseline: baseline.studentInterests, current: currentStudentInterests },
  );
  expectTrue(
    "audit: pre-existing skills were not deleted",
    currentSkills >= baseline.skills,
    { baseline: baseline.skills, current: currentSkills },
  );
  expectTrue(
    "audit: pre-existing interests were not deleted",
    currentInterests >= baseline.interests,
    { baseline: baseline.interests, current: currentInterests },
  );
}

async function main(): Promise<void> {
  console.log(`BridgeEd community smoke test :: ${RUN_ID}`);
  console.log(`target ${API_BASE_URL}${API_PREFIX}`);

  const context: SmokeContext = {
    createdUserIds: [],
    createdCommunityIds: [],
  };

  const baseline = await readBaseline();

  try {
    const users = await setupStudents(context);

    const ids = await runCreationChecks(context, users.owner);

    await runCreationValidationChecks(context, users.owner, ids.publicId);
    await runOwnerMembershipChecks(users.owner, ids);

    const publicState = await runPublicJoinChecks(context, ids, users);
    const requestState = await runPrivateRequestChecks(ids, users);
    const authorizationState = await runAuthorizationChecks(
      ids,
      users,
      requestState,
    );

    await runBanChecks(ids, users, publicState);
    await runLeaveChecks(ids, users, publicState, authorizationState);
    await runListingChecks(ids, users);
    await runDetailsChecks(ids, users, publicState);
    await runRegressionChecks(ids, users);
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

