/**
 * BridgeEd student-profile live smoke test.
 *
 * Usage:
 *   1. Make sure PostgreSQL is running and the API is serving
 *      (`npm run dev --workspace=apps/api`).
 *   2. Run `npm run smoke:profile --workspace=apps/api`
 *
 * Optional environment variables:
 *   API_BASE_URL (default http://localhost:4000)
 *
 * It drives the authenticated self-profile endpoints exactly as the app does and
 * proves the ownership rule end to end: the owner of every write is the account
 * named by the bearer token, never a field in the body. Every account, skill,
 * interest and university it creates carries this run's id and is removed again
 * in cleanup, even when a check fails; the audit then proves the row counts came
 * back to where they started.
 */
import { randomUUID } from "node:crypto";
import { STUDENT_PROFILE_NOT_FOUND_MESSAGE } from "../src/controllers/student-profile.controller";
import { prisma } from "../src/config/prisma";
import { AUTH_AUTHENTICATION_REQUIRED_MESSAGE } from "../src/middleware/require-auth";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const API_PREFIX = "/api/v1";

const RUN_ID = `profsmk${Date.now().toString(36)}${Math.random()
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

interface SmokeState {
  createdUserIds: string[];
  createdUniversityIds: string[];
  createdSkillIds: string[];
  createdInterestIds: string[];
}

interface SessionTokens {
  userId: string;
  email: string;
  accessToken: string;
}

interface BaselineCounts {
  users: number;
  profiles: number;
  sessions: number;
  universities: number;
  skills: number;
  interests: number;
  studentSkills: number;
  studentInterests: number;
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

/** Pulls the session out of a register/login response. */
function readSession(body: unknown, label: string): SessionTokens {
  const user = asRecord(asRecord(body)["user"]);
  const accessToken = readString(body, "accessToken");
  const userId = readString(user, "id");

  if (!accessToken || !userId) {
    throw new Error(`${label}: response did not contain a usable session`);
  }

  return { userId, email: readString(user, "email") ?? "", accessToken };
}

function remember(state: SmokeState, userId: string): void {
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

  remember(state, session.userId);

  return session;
}

/** Creates a profile through the canonical authenticated endpoint. */
async function createProfile(
  session: SessionTokens,
  label: string,
  overrides: Record<string, unknown> = {},
): Promise<ApiResult> {
  return api("POST", "/student-profiles/me", {
    token: session.accessToken,
    body: {
      name: `Smoke ${label}`,
      username: `${RUN_ID}${label}`,
      ...overrides,
    },
  });
}

/** Creates a university through the existing catalog endpoint. */
async function createUniversity(
  state: SmokeState,
  suffix: string,
): Promise<string> {
  const result = await api("POST", "/universities", {
    body: { name: `${RUN_ID} University ${suffix}`, country: "India" },
  });

  expectStatus(`setup: create university ${suffix}`, result, 201);

  const id = readString(result.body, "id");

  if (id) {
    state.createdUniversityIds.push(id);
  }

  return id ?? "";
}

/** Creates a skill through the existing catalog endpoint. */
async function createSkill(state: SmokeState, suffix: string): Promise<string> {
  const result = await api("POST", "/skills", {
    body: { name: `${RUN_ID} Skill ${suffix}` },
  });

  expectStatus(`setup: create skill ${suffix}`, result, 201);

  const id = readString(result.body, "id");

  if (id) {
    state.createdSkillIds.push(id);
  }

  return id ?? "";
}

/** Creates an interest through the existing catalog endpoint. */
async function createInterest(
  state: SmokeState,
  suffix: string,
): Promise<string> {
  const result = await api("POST", "/interests", {
    body: { name: `${RUN_ID} Interest ${suffix}` },
  });

  expectStatus(`setup: create interest ${suffix}`, result, 201);

  const id = readString(result.body, "id");

  if (id) {
    state.createdInterestIds.push(id);
  }

  return id ?? "";
}

/** Creating and reading the signed-in profile. */
async function runSelfProfileChecks(user: SessionTokens): Promise<void> {
  console.log("\n--- create and read the signed-in profile ---");

  const created = await createProfile(user, "a", {
    bio: "Systems and badminton.",
    degree: "B.Tech",
    branch: "Computer Science",
    graduationYear: 2027,
    location: "Bengaluru, India",
  });

  expectStatus("create: POST /student-profiles/me succeeds", created, 201);
  expectEqual(
    "create: the response names the token's account",
    readString(created.body, "userId"),
    user.userId,
  );
  expectEqual(
    "create: the created name is stored",
    readString(created.body, "name"),
    "Smoke a",
  );

  const mine = await api("GET", "/student-profiles/me", {
    token: user.accessToken,
  });

  expectStatus("read: GET /student-profiles/me succeeds", mine, 200);
  expectEqual(
    "read: the profile belongs to the caller",
    readString(mine.body, "userId"),
    user.userId,
  );
  expectEqual("read: the degree is returned", readString(mine.body, "degree"), "B.Tech");
  expectEqual(
    "read: the graduation year is returned",
    asRecord(mine.body)["graduationYear"],
    2027,
  );
  expectEqual(
    "read: the university starts empty",
    asRecord(mine.body)["university"],
    null,
  );
  expectEqual(
    "read: skills start empty",
    asArray(asRecord(mine.body)["skills"]).length,
    0,
  );
  expectEqual(
    "read: interests start empty",
    asArray(asRecord(mine.body)["interests"]).length,
    0,
  );
  expectTrue(
    "read: the response never contains a password hash",
    !JSON.stringify(mine.body).includes("passwordHash"),
  );
}

/** Editing the signed-in profile. */
async function runUpdateChecks(
  state: SmokeState,
  user: SessionTokens,
): Promise<void> {
  console.log("\n--- edit the signed-in profile ---");

  const universityId = await createUniversity(state, "one");

  const updated = await api("PATCH", "/student-profiles/me", {
    token: user.accessToken,
    body: {
      name: "Smoke Renamed",
      bio: "Updated bio.",
      degree: "M.Tech",
      branch: "AI",
      graduationYear: 2028,
      location: "Mumbai, India",
      universityId,
    },
  });

  expectStatus("update: PATCH /student-profiles/me succeeds", updated, 200);
  expectEqual("update: the name changed", readString(updated.body, "name"), "Smoke Renamed");
  expectEqual(
    "update: the university is set",
    readString(asRecord(updated.body)["university"], "id"),
    universityId,
  );
  expectEqual("update: the year changed", asRecord(updated.body)["graduationYear"], 2028);

  const reread = await api("GET", "/student-profiles/me", {
    token: user.accessToken,
  });

  expectEqual("update: the change is persisted", readString(reread.body, "name"), "Smoke Renamed");
  expectEqual(
    "update: the university is persisted",
    readString(asRecord(reread.body)["university"], "id"),
    universityId,
  );

  const cleared = await api("PATCH", "/student-profiles/me", {
    token: user.accessToken,
    body: { branch: null, bio: null },
  });

  expectStatus("update: a clearing PATCH succeeds", cleared, 200);
  expectEqual("update: a cleared field is null", asRecord(cleared.body)["branch"], null);
  expectEqual("update: a cleared bio is null", asRecord(cleared.body)["bio"], null);
}

/** The rule that a body can never point a write at another account. */
async function runOwnershipChecks(
  state: SmokeState,
  alice: SessionTokens,
  bob: SessionTokens,
): Promise<void> {
  console.log("\n--- ownership ---");

  const bobCreate = await createProfile(bob, "b", { bio: "Bob's bio." });

  expectStatus("ownership: B creates B's own profile", bobCreate, 201);

  const before = await api("GET", `/student-profiles/${bob.userId}`);

  expectStatus("ownership: B's public profile is readable", before, 200);

  const bobNameBefore = readString(before.body, "name");

  // A names B in the body while updating A. The owner must still be A.
  const attack = await api("PATCH", "/student-profiles/me", {
    token: alice.accessToken,
    body: { userId: bob.userId, name: "Taken Over" },
  });

  expectStatus("ownership: A's PATCH is accepted", attack, 200);
  expectEqual(
    "ownership: the write landed on A, not B",
    readString(attack.body, "userId"),
    alice.userId,
  );

  const aliceAfter = await api("GET", "/student-profiles/me", {
    token: alice.accessToken,
  });

  expectEqual(
    "ownership: A's own name changed",
    readString(aliceAfter.body, "name"),
    "Taken Over",
  );

  const bobAfter = await api("GET", `/student-profiles/${bob.userId}`);

  expectEqual(
    "ownership: B's name is untouched",
    readString(bobAfter.body, "name"),
    bobNameBefore,
  );

  // A handle is an identity, so a body that names a new one is ignored.
  const handleBefore = readString(aliceAfter.body, "username");

  const handleAttempt = await api("PATCH", "/student-profiles/me", {
    token: alice.accessToken,
    body: { username: `${RUN_ID}hacked` },
  });

  expectStatus("ownership: a handle change is accepted as a no-op", handleAttempt, 200);
  expectEqual(
    "ownership: the handle is unchanged",
    readString(handleAttempt.body, "username"),
    handleBefore,
  );

  void state;
}

/** Each account's own profile is its own, and public reads still work. */
async function runIsolationChecks(
  alice: SessionTokens,
  bob: SessionTokens,
): Promise<void> {
  console.log("\n--- isolation and the public read ---");

  const bobMe = await api("GET", "/student-profiles/me", {
    token: bob.accessToken,
  });

  expectStatus("isolation: B can read B's own profile", bobMe, 200);
  expectEqual(
    "isolation: /me answers with B for B's token",
    readString(bobMe.body, "userId"),
    bob.userId,
  );

  const alicePublic = await api("GET", `/student-profiles/${alice.userId}`);

  expectStatus(
    "public: GET /student-profiles/:userId returns another student",
    alicePublic,
    200,
  );
  expectEqual(
    "public: the subject is the id in the path",
    readString(alicePublic.body, "userId"),
    alice.userId,
  );

  const missing = await api("GET", `/student-profiles/${randomUUID()}`);

  expectError(
    "public: an unknown subject is 404",
    missing,
    404,
    STUDENT_PROFILE_NOT_FOUND_MESSAGE,
  );
}

/** Replacing and clearing the signed-in student's skills and interests. */
async function runTagChecks(
  state: SmokeState,
  user: SessionTokens,
): Promise<void> {
  console.log("\n--- skills and interests ---");

  const skillId = await createSkill(state, "one");
  const interestId = await createInterest(state, "one");

  const setSkills = await api("PUT", "/student-profiles/me/skills", {
    token: user.accessToken,
    body: { skillIds: [skillId] },
  });

  expectStatus("tags: PUT /me/skills succeeds", setSkills, 200);
  expectEqual(
    "tags: the new skill set is returned",
    readString(asArray(setSkills.body)[0], "id"),
    skillId,
  );

  const setInterests = await api("PUT", "/student-profiles/me/interests", {
    token: user.accessToken,
    body: { interestIds: [interestId] },
  });

  expectStatus("tags: PUT /me/interests succeeds", setInterests, 200);
  expectEqual(
    "tags: the new interest set is returned",
    readString(asArray(setInterests.body)[0], "id"),
    interestId,
  );

  const mine = await api("GET", "/student-profiles/me", {
    token: user.accessToken,
  });

  expectEqual(
    "tags: the skill is on the profile",
    asArray(asRecord(mine.body)["skills"]).length,
    1,
  );
  expectEqual(
    "tags: the interest is on the profile",
    asArray(asRecord(mine.body)["interests"]).length,
    1,
  );

  const cleared = await api("PUT", "/student-profiles/me/skills", {
    token: user.accessToken,
    body: { skillIds: [] },
  });

  expectStatus("tags: an empty set is accepted", cleared, 200);
  expectEqual("tags: the skills are cleared", asArray(cleared.body).length, 0);

  const unknown = await api("PUT", "/student-profiles/me/skills", {
    token: user.accessToken,
    body: { skillIds: [randomUUID()] },
  });

  expectError(
    "tags: an unknown skill id is refused",
    unknown,
    400,
    "One or more skills do not exist",
  );

  const badBody = await api("PUT", "/student-profiles/me/interests", {
    token: user.accessToken,
    body: { interestIds: "not-an-array" },
  });

  expectError(
    "tags: a non-array body is refused",
    badBody,
    400,
    "interestIds must be an array of ids",
  );
}

/** The field rules the API enforces before anything is written. */
async function runValidationChecks(user: SessionTokens): Promise<void> {
  console.log("\n--- validation ---");

  const tooShort = await api("PATCH", "/student-profiles/me", {
    token: user.accessToken,
    body: { name: "A" },
  });

  expectError(
    "validation: a too-short name is refused",
    tooShort,
    400,
    "name must be at least 2 characters",
  );

  const wrongType = await api("PATCH", "/student-profiles/me", {
    token: user.accessToken,
    body: { name: 42 },
  });

  expectError(
    "validation: a non-string name is refused",
    wrongType,
    400,
    "name must be a string",
  );

  const longBio = await api("PATCH", "/student-profiles/me", {
    token: user.accessToken,
    body: { bio: "x".repeat(241) },
  });

  expectError(
    "validation: an over-long bio is refused",
    longBio,
    400,
    "bio must be at most 240 characters",
  );

  const badYear = await api("PATCH", "/student-profiles/me", {
    token: user.accessToken,
    body: { graduationYear: 12345 },
  });

  expectError(
    "validation: an out-of-range year is refused",
    badYear,
    400,
    "graduationYear must be between 1950 and 2100",
  );

  const badYearType = await api("PATCH", "/student-profiles/me", {
    token: user.accessToken,
    body: { graduationYear: "2026" },
  });

  expectError(
    "validation: a non-numeric year is refused",
    badYearType,
    400,
    "graduationYear must be a whole number or null",
  );

  const unknownUniversity = await api("PATCH", "/student-profiles/me", {
    token: user.accessToken,
    body: { universityId: randomUUID() },
  });

  expectError(
    "validation: an unknown university is refused",
    unknownUniversity,
    400,
    "The selected university does not exist",
  );
}

/** Every self-profile endpoint rejects a request with no credential. */
async function runGuardChecks(): Promise<void> {
  console.log("\n--- authentication ---");

  const read = await api("GET", "/student-profiles/me");

  expectError(
    "guard: GET /me without a token is refused",
    read,
    401,
    AUTH_AUTHENTICATION_REQUIRED_MESSAGE,
  );

  const update = await api("PATCH", "/student-profiles/me", {
    body: { name: "Ghost" },
  });

  expectError(
    "guard: PATCH /me without a token is refused",
    update,
    401,
    AUTH_AUTHENTICATION_REQUIRED_MESSAGE,
  );

  const skills = await api("PUT", "/student-profiles/me/skills", {
    body: { skillIds: [] },
  });

  expectError(
    "guard: PUT /me/skills without a token is refused",
    skills,
    401,
    AUTH_AUTHENTICATION_REQUIRED_MESSAGE,
  );
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
    universities: await prisma.university.count(),
    skills: await prisma.skill.count(),
    interests: await prisma.interest.count(),
    studentSkills: await prisma.studentSkill.count(),
    studentInterests: await prisma.studentInterest.count(),
  };
}

/**
 * Deletes exactly what this run created. Profiles, sessions and tag rows cascade
 * from the account, so removing the accounts is enough for those; the catalog
 * rows (university, skill, interest) do not cascade, so each is removed by the
 * id this run recorded.
 */
async function cleanup(state: SmokeState): Promise<void> {
  console.log("\n--- cleanup ---");

  const removed = await prisma.user.deleteMany({
    where: { id: { in: state.createdUserIds } },
  });

  console.log(`deleted ${removed.count} smoke accounts`);

  const strays = await prisma.user.deleteMany({
    where: { email: { startsWith: `${RUN_ID}-` } },
  });

  console.log(`deleted ${strays.count} further rows carrying the run prefix`);

  const universities = await prisma.university.deleteMany({
    where: { id: { in: state.createdUniversityIds } },
  });
  const skills = await prisma.skill.deleteMany({
    where: { id: { in: state.createdSkillIds } },
  });
  const interests = await prisma.interest.deleteMany({
    where: { id: { in: state.createdInterestIds } },
  });

  console.log(
    `deleted ${universities.count} universities, ${skills.count} skills, ${interests.count} interests`,
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

async function main(): Promise<void> {
  console.log(`BridgeEd student-profile smoke test :: ${RUN_ID}`);
  console.log(`target ${API_BASE_URL}${API_PREFIX}`);

  const state: SmokeState = {
    createdUserIds: [],
    createdUniversityIds: [],
    createdSkillIds: [],
    createdInterestIds: [],
  };
  const baseline = await readBaseline();

  try {
    const alice = await registerAccount(state, "a");
    await runSelfProfileChecks(alice);
    await runUpdateChecks(state, alice);

    const bob = await registerAccount(state, "b");
    await runOwnershipChecks(state, alice, bob);
    await runIsolationChecks(alice, bob);

    await runTagChecks(state, alice);
    await runValidationChecks(alice);
    await runGuardChecks();
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




