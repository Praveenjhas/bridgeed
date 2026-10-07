/**
 * BridgeEd global search live smoke test.
 *
 * Usage:
 *   1. Make sure PostgreSQL is running and the API is serving
 *      (`npm run dev --workspace=apps/api`).
 *   2. Run `npm run smoke:search --workspace=apps/api`
 *
 * Optional environment variables:
 *   API_BASE_URL (default http://localhost:4000)
 *
 * It drives `GET /api/v1/search` the way the app does: the guarded boundary, the
 * bad requests it owns, the grouped answer a student sees while typing, the
 * relevance order inside each group, the secondary fields a row can be found by,
 * the typed read that pages inside one category, and the boundaries a v1 search
 * deliberately has (case insensitive, whitespace trimmed, `limit` clamped, and a
 * term that matches nothing being an empty answer rather than an error).
 *
 * Every row it creates carries this run's id in its name, its username or its
 * slug and is removed again in cleanup, even when a check fails; the audit then
 * proves the row counts came back to where they started.
 */
import { randomUUID } from "node:crypto";
import {
  COMMUNITY_TYPES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  SEARCH_DEFAULT_CATEGORY_LIMIT,
  SEARCH_TYPE_VALUES,
} from "@bridgeed/shared";
import { prisma } from "../src/config/prisma";
import {
  SEARCH_QUERY_INVALID_MESSAGE,
  SEARCH_QUERY_REQUIRED_MESSAGE,
  SEARCH_UNKNOWN_TYPE_MESSAGE,
} from "../src/controllers/search.controller";
import { AUTH_AUTHENTICATION_REQUIRED_MESSAGE } from "../src/middleware/require-auth";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const API_PREFIX = "/api/v1";

/** Every row this run creates carries this id in its unique key. */
const RUN_ID = `srchsmk${Date.now().toString(36)}${Math.random()
  .toString(36)
  .slice(2, 6)}`;

/** A password that satisfies the policy and is not on the blocklist. */
const VALID_PASSWORD = "Smoke-Verifier-9f3a-Qz";

/** The message the paged reads return for an unusable `page` or `limit`. */
const INVALID_PAGINATION_MESSAGE = "page and limit must be positive integers";

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

/** The ids this run creates, so cleanup can take exactly them away again. */
interface RunIds {
  universityAlpha: string;
  universityBeta: string;
  universityAlphaName: string;
  universityBetaName: string;
  programExact: string;
  programAlpha: string;
  programBeta: string;
  /** Only ever matched by its `field`, never by its name. */
  programFieldOnly: string;
  subjectAlpha: string;
  subjectAlphaName: string;
  subjectBeta: string;
  communityAlpha: string;
  communityAlphaName: string;
  /** Only ever matched by its description, never by its name. */
  communityDescribed: string;
  communityDescribedName: string;
  userIds: string[];
  viewerId: string;
  otherStudentId: string;
  otherStudentUsername: string;
}

interface BaselineCounts {
  users: number;
  profiles: number;
  universities: number;
  programs: number;
  subjects: number;
  programSubjects: number;
  communities: number;
  memberships: number;
}

/**
 * How many rows of each category the run seeds, and therefore how many a grouped
 * search of this run's id has to count. Students are one rather than two because
 * the searcher's own profile is never part of an answer.
 */
const SEEDED: Record<string, number> = {
  universities: 2,
  programs: 4,
  subjects: 2,
  communities: 2,
  students: 1,
};

/** Every category a response groups its results into. */
const GROUPS = Object.keys(SEEDED);

/** The sum of the seeded rows, which is the `total` a grouped answer reports. */
const SEEDED_TOTAL = GROUPS.reduce(
  (sum, group) => sum + (SEEDED[group] ?? 0),
  0,
);

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

function expectEqual(
  name: string,
  actual: unknown,
  expected: unknown,
): boolean {
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
      : {
          expected: { status, message },
          actual: { status: result.status, error },
        },
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

function readNumber(source: unknown, key: string): number | null {
  const value = asRecord(source)[key];

  return typeof value === "number" ? value : null;
}

/** One group of a search response, as rows. */
function readGroup(body: unknown, group: string): Record<string, unknown>[] {
  return asArray(asRecord(asRecord(body)["results"])[group]).map(asRecord);
}

/** How many rows a group of a response holds. */
function groupSize(body: unknown, group: string): number {
  return readGroup(body, group).length;
}

/** A count out of the `counts` block. */
function countOf(body: unknown, group: string): number | null {
  return readNumber(asRecord(asRecord(body)["counts"]), group);
}

/** A number out of the `pagination` block. */
function pageOf(body: unknown, key: string): number | null {
  return readNumber(asRecord(asRecord(body)["pagination"]), key);
}

/** The `name` of every row in a list, in the order the API returned them. */
function namesOf(rows: Record<string, unknown>[]): (string | null)[] {
  return rows.map((row) => readString(row, "name"));
}

/** Everything but a student is identified by `id`; a student is a `userId`. */
function idsOf(rows: Record<string, unknown>[]): (string | null)[] {
  return rows.map((row) =>
    readString(row, typeof row["userId"] === "string" ? "userId" : "id"),
  );
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

function smokeEmail(label: string): string {
  return `${RUN_ID}-${label}@bridgeed-smoke.test`;
}

/** Encodes a query value, so a term with spaces stays one parameter. */
function query(term: string): string {
  return encodeURIComponent(term);
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

/** Creates a university through the catalog endpoint and returns its identity. */
async function createUniversity(
  label: string,
  city: string,
): Promise<{ id: string; name: string; slug: string }> {
  const name = `${RUN_ID} University ${label}`;
  const result = await api("POST", "/universities", {
    body: {
      name,
      country: "India",
      state: "Himachal Pradesh",
      city,
      websiteUrl: "https://example.edu",
      description: `${RUN_ID} search smoke`,
      logoUrl: null,
    },
  });

  expectStatus(`setup: create university ${label}`, result, 201);

  const id = readString(result.body, "id");
  const slug = readString(result.body, "slug");

  if (!id || !slug) {
    throw new Error(`setup: create university ${label} returned no identity`);
  }

  return { id, name, slug };
}

/** Seeds a programme row directly: programmes are read-only over HTTP. */
async function seedProgram(
  universityId: string,
  label: string,
  degree: string,
  field: string,
): Promise<{ id: string; name: string }> {
  const name = `${RUN_ID} ${label}`;
  const id = randomUUID();

  await prisma.program.create({
    data: {
      id,
      universityId,
      name,
      degree,
      field,
      description: `${RUN_ID} search smoke`,
    },
  });

  return { id, name };
}

/** Seeds a subject row directly: the catalog is read-only over HTTP. */
async function seedSubject(
  label: string,
): Promise<{ id: string; name: string }> {
  const name = `${RUN_ID} Subject ${label}`;
  const id = randomUUID();

  await prisma.subject.create({
    data: { id, name, slug: `${RUN_ID}-subject-${label.toLowerCase()}` },
  });

  return { id, name };
}

/** Links a subject to a programme, so the programme's subject list is real. */
async function linkSubject(
  programId: string,
  subjectId: string,
): Promise<void> {
  await prisma.programSubject.create({ data: { programId, subjectId } });
}

/** Creates a community owned by the caller, optionally anchored academically. */
async function createCommunity(
  token: string,
  name: string,
  slug: string,
  description: string,
  anchors: {
    universityId?: string;
    programId?: string;
    subjectId?: string;
  } = {},
): Promise<string> {
  const result = await api("POST", "/communities", {
    token,
    body: {
      name,
      slug,
      type: COMMUNITY_TYPES.PUBLIC,
      description,
      ...anchors,
    },
  });

  expectStatus(`setup: create community ${slug}`, result, 201);

  const id = readString(result.body, "id");

  if (!id) {
    throw new Error(`setup: create community ${slug} returned no id`);
  }

  return id;
}

/** Registers a fresh account and returns its session. */
async function registerAccount(
  ids: RunIds,
  label: string,
): Promise<SessionTokens> {
  const result = await api("POST", "/auth/register", {
    body: { email: smokeEmail(label), password: VALID_PASSWORD },
  });

  expectStatus(`setup: register ${label}`, result, 201);

  const session = readSession(result.body, `setup: register ${label}`);

  ids.userIds.push(session.userId);

  return session;
}

/** Creates the caller's student profile, which is what search reads back. */
async function createProfile(
  token: string,
  label: string,
  profile: {
    name: string;
    username: string;
    universityId: string;
    programId: string;
  },
): Promise<void> {
  const result = await api("POST", "/student-profiles/me", {
    token,
    body: profile,
  });

  expectStatus(`setup: create the ${label} profile`, result, 201);
}

/** Row counts this run has to leave exactly as it found them. */
async function readCounts(): Promise<BaselineCounts> {
  const [
    users,
    profiles,
    universities,
    programs,
    subjects,
    programSubjects,
    communities,
    memberships,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.studentProfile.count(),
    prisma.university.count(),
    prisma.program.count(),
    prisma.subject.count(),
    prisma.programSubject.count(),
    prisma.community.count(),
    prisma.communityMembership.count(),
  ]);

  return {
    users,
    profiles,
    universities,
    programs,
    subjects,
    programSubjects,
    communities,
    memberships,
  };
}

function emptyRunIds(): RunIds {
  return {
    universityAlpha: "",
    universityBeta: "",
    universityAlphaName: "",
    universityBetaName: "",
    programExact: "",
    programAlpha: "",
    programBeta: "",
    programFieldOnly: "",
    subjectAlpha: "",
    subjectAlphaName: "",
    subjectBeta: "",
    communityAlpha: "",
    communityAlphaName: "",
    communityDescribed: "",
    communityDescribedName: "",
    userIds: [],
    viewerId: "",
    otherStudentId: "",
    otherStudentUsername: "",
  };
}

/**
 * Creates everything the run searches for.
 *
 * The rows are chosen so that each relevance tier has exactly one owner: a
 * programme whose name is the term itself, two whose names start with it, one that
 * only its `field` can find, a university that only its `city` can find, and a
 * community that only its description can find. The two accounts are what the
 * student category is checked against — one of them is the searcher, whose own
 * profile must never come back.
 */
async function runSetup(ids: RunIds): Promise<SessionTokens> {
  console.log("\n--- setup ---");

  const universityAlpha = await createUniversity("Alpha", "Mandi");
  const universityBeta = await createUniversity("Beta", `${RUN_ID} City`);

  ids.universityAlpha = universityAlpha.id;
  ids.universityBeta = universityBeta.id;
  ids.universityAlphaName = universityAlpha.name;
  ids.universityBetaName = universityBeta.name;

  const subjectAlpha = await seedSubject("Alpha");
  const subjectBeta = await seedSubject("Beta");

  ids.subjectAlpha = subjectAlpha.id;
  ids.subjectAlphaName = subjectAlpha.name;
  ids.subjectBeta = subjectBeta.id;

  const programExact = await seedProgram(
    ids.universityAlpha,
    "Program",
    "B.Tech",
    "Engineering",
  );
  const programAlpha = await seedProgram(
    ids.universityAlpha,
    "Program Alpha",
    "B.Tech",
    "Engineering",
  );
  const programBeta = await seedProgram(
    ids.universityAlpha,
    "Program Beta",
    "M.Tech",
    "Engineering",
  );
  const programFieldOnly = await seedProgram(
    ids.universityBeta,
    "Studies",
    "B.Sc",
    `${RUN_ID} Domain`,
  );

  ids.programExact = programExact.id;
  ids.programAlpha = programAlpha.id;
  ids.programBeta = programBeta.id;
  ids.programFieldOnly = programFieldOnly.id;

  await linkSubject(programAlpha.id, subjectAlpha.id);
  await linkSubject(programAlpha.id, subjectBeta.id);

  const viewer = await registerAccount(ids, "viewer");
  const other = await registerAccount(ids, "other");

  ids.viewerId = viewer.userId;
  ids.otherStudentId = other.userId;
  ids.otherStudentUsername = `${RUN_ID}other`;

  await createProfile(viewer.accessToken, "viewer", {
    name: "Search Smoke Viewer",
    username: `${RUN_ID}viewer`,
    universityId: ids.universityAlpha,
    programId: ids.programAlpha,
  });

  await createProfile(other.accessToken, "other", {
    name: `${RUN_ID} Student Other`,
    username: ids.otherStudentUsername,
    universityId: ids.universityAlpha,
    programId: ids.programAlpha,
  });

  ids.communityAlphaName = `${RUN_ID} Circle Alpha`;
  ids.communityDescribedName = `${RUN_ID} Circle Beta`;

  ids.communityAlpha = await createCommunity(
    viewer.accessToken,
    ids.communityAlphaName,
    `${RUN_ID}-circle-alpha`,
    "general discussion",
    {
      universityId: ids.universityAlpha,
      programId: ids.programAlpha,
      subjectId: ids.subjectAlpha,
    },
  );
  ids.communityDescribed = await createCommunity(
    viewer.accessToken,
    ids.communityDescribedName,
    `${RUN_ID}-circle-beta`,
    `A place to talk about the ${ids.communityAlphaName} every week`,
  );

  // A second active member, so the member count a search row carries is not just
  // "one, because the owner is always there".
  const join = await api("POST", `/communities/${ids.communityAlpha}/join`, {
    token: other.accessToken,
  });

  expectStatus(
    "setup: the second student joins the anchored community",
    join,
    201,
  );

  return viewer;
}

/** Removes every row this run created, in dependency order. */
async function cleanup(ids: RunIds): Promise<void> {
  console.log("\n--- cleanup ---");

  await prisma.community.deleteMany({
    where: { id: { in: [ids.communityAlpha, ids.communityDescribed] } },
  });
  await prisma.program.deleteMany({
    where: {
      id: {
        in: [
          ids.programExact,
          ids.programAlpha,
          ids.programBeta,
          ids.programFieldOnly,
        ],
      },
    },
  });
  await prisma.subject.deleteMany({
    where: { id: { in: [ids.subjectAlpha, ids.subjectBeta] } },
  });
  // Deleting the accounts takes their profiles, sessions, memberships, posts and
  // reactions with them.
  await prisma.user.deleteMany({ where: { id: { in: ids.userIds } } });
  await prisma.university.deleteMany({
    where: { id: { in: [ids.universityAlpha, ids.universityBeta] } },
  });

  const [
    leftoverUniversities,
    leftoverPrograms,
    leftoverSubjects,
    leftoverCommunities,
    leftoverProfiles,
  ] = await Promise.all([
    prisma.university.count({ where: { name: { startsWith: RUN_ID } } }),
    prisma.program.count({ where: { name: { startsWith: RUN_ID } } }),
    prisma.subject.count({ where: { name: { startsWith: RUN_ID } } }),
    prisma.community.count({ where: { slug: { startsWith: RUN_ID } } }),
    prisma.studentProfile.count({
      where: { username: { startsWith: RUN_ID } },
    }),
  ]);

  expectEqual("cleanup: no universities left behind", leftoverUniversities, 0);
  expectEqual("cleanup: no programmes left behind", leftoverPrograms, 0);
  expectEqual("cleanup: no subjects left behind", leftoverSubjects, 0);
  expectEqual("cleanup: no communities left behind", leftoverCommunities, 0);
  expectEqual("cleanup: no student profiles left behind", leftoverProfiles, 0);
}

/** The guarded boundary and the bad requests the endpoint owns. */
async function runRequestChecks(viewer: SessionTokens): Promise<void> {
  console.log("\n--- request shape ---");

  const token = viewer.accessToken;
  const unauthenticated = await api("GET", `/search?q=${query(RUN_ID)}`);

  expectError(
    "request: search without a token is rejected",
    unauthenticated,
    401,
    AUTH_AUTHENTICATION_REQUIRED_MESSAGE,
  );

  const missing = await api("GET", "/search", { token });

  expectError(
    "request: a missing q is refused",
    missing,
    400,
    SEARCH_QUERY_REQUIRED_MESSAGE,
  );

  const blank = await api("GET", "/search?q=", { token });

  expectError(
    "request: an empty q is refused",
    blank,
    400,
    SEARCH_QUERY_REQUIRED_MESSAGE,
  );

  const whitespace = await api("GET", "/search?q=%20%20%20", { token });

  expectError(
    "request: a whitespace-only q is refused rather than searched",
    whitespace,
    400,
    SEARCH_QUERY_REQUIRED_MESSAGE,
  );

  const repeated = await api("GET", "/search?q=alpha&q=beta", { token });

  expectError(
    "request: a repeated q is refused",
    repeated,
    400,
    SEARCH_QUERY_INVALID_MESSAGE,
  );

  const unknownType = await api(
    "GET",
    `/search?q=${query(RUN_ID)}&type=question`,
    { token },
  );

  expectError(
    "request: an unknown type is refused",
    unknownType,
    400,
    SEARCH_UNKNOWN_TYPE_MESSAGE,
  );

  const blankType = await api("GET", `/search?q=${query(RUN_ID)}&type=`, {
    token,
  });

  expectError(
    "request: an empty type is refused",
    blankType,
    400,
    SEARCH_UNKNOWN_TYPE_MESSAGE,
  );

  const repeatedType = await api(
    "GET",
    `/search?q=${query(RUN_ID)}&type=university&type=subject`,
    { token },
  );

  expectError(
    "request: a repeated type is refused",
    repeatedType,
    400,
    SEARCH_UNKNOWN_TYPE_MESSAGE,
  );

  const zeroPage = await api("GET", `/search?q=${query(RUN_ID)}&page=0`, {
    token,
  });

  expectError(
    "request: a zero page is refused",
    zeroPage,
    400,
    INVALID_PAGINATION_MESSAGE,
  );

  const textLimit = await api("GET", `/search?q=${query(RUN_ID)}&limit=abc`, {
    token,
  });

  expectError(
    "request: a non-numeric limit is refused",
    textLimit,
    400,
    INVALID_PAGINATION_MESSAGE,
  );

  const negativeLimit = await api(
    "GET",
    `/search?q=${query(RUN_ID)}&limit=-1`,
    {
      token,
    },
  );

  expectError(
    "request: a negative limit is refused",
    negativeLimit,
    400,
    INVALID_PAGINATION_MESSAGE,
  );
}

/**
 * Proves the run left every table it touched exactly as it found it.
 *
 * It runs after cleanup, so a leak shows up as a count that did not come back
 * rather than as a leftover row carrying this run's id.
 */
async function audit(baseline: BaselineCounts): Promise<void> {
  console.log("\n--- audit ---");

  const final = await readCounts();

  expectEqual("audit: users restored", final.users, baseline.users);
  expectEqual(
    "audit: student profiles restored",
    final.profiles,
    baseline.profiles,
  );
  expectEqual(
    "audit: universities restored",
    final.universities,
    baseline.universities,
  );
  expectEqual("audit: programmes restored", final.programs, baseline.programs);
  expectEqual("audit: subjects restored", final.subjects, baseline.subjects);
  expectEqual(
    "audit: programme subject links restored",
    final.programSubjects,
    baseline.programSubjects,
  );
  expectEqual(
    "audit: communities restored",
    final.communities,
    baseline.communities,
  );
  expectEqual(
    "audit: community memberships restored",
    final.memberships,
    baseline.memberships,
  );
}

/**
 * The grouped answer: every category searched at once, each capped at a preview.
 */
async function runGroupedChecks(
  ids: RunIds,
  viewer: SessionTokens,
): Promise<void> {
  console.log("\n--- grouped search ---");

  const token = viewer.accessToken;
  const all = await api("GET", `/search?q=${query(RUN_ID)}`, { token });

  expectStatus(
    "grouped: a term every seeded row carries is answered",
    all,
    200,
  );
  expectEqual(
    "grouped: the term is echoed as it was searched",
    readString(all.body, "query"),
    RUN_ID,
  );
  expectEqual(
    "grouped: a grouped answer names no single type",
    asRecord(all.body)["type"] ?? null,
    null,
  );

  for (const group of GROUPS) {
    const expected = SEEDED[group] ?? 0;

    expectEqual(
      `grouped: the ${group} count is what this run created`,
      countOf(all.body, group),
      expected,
    );
    expectEqual(
      `grouped: the ${group} group holds the first page of them`,
      groupSize(all.body, group),
      Math.min(expected, SEARCH_DEFAULT_CATEGORY_LIMIT),
    );
  }

  expectEqual(
    "grouped: a grouped answer is page one",
    pageOf(all.body, "page"),
    1,
  );
  expectEqual(
    "grouped: the per category cap is the search default",
    pageOf(all.body, "limit"),
    SEARCH_DEFAULT_CATEGORY_LIMIT,
  );
  expectEqual(
    "grouped: the total is the sum of the category counts",
    pageOf(all.body, "total"),
    SEEDED_TOTAL,
  );
  expectEqual(
    "grouped: a grouped answer is a single page",
    pageOf(all.body, "totalPages"),
    1,
  );

  // The cap is a preview, not a limit on what was counted: a term that matches more
  // than the cap still reports the true count, so a screen can say "12 matches"
  // while showing five.
  const capped = await api("GET", `/search?q=${query(RUN_ID)}&limit=1`, {
    token,
  });

  expectEqual(
    "grouped: an explicit limit caps the rows",
    groupSize(capped.body, "programs"),
    1,
  );
  expectEqual(
    "grouped: the cap does not change the count",
    countOf(capped.body, "programs"),
    SEEDED.programs,
  );
  expectEqual(
    "grouped: the cap is echoed back",
    pageOf(capped.body, "limit"),
    1,
  );
  expectEqual(
    "grouped: a capped group is the head of the uncapped order",
    readString(readGroup(capped.body, "programs")[0], "id"),
    readString(readGroup(all.body, "programs")[0], "id"),
  );

  const clamped = await api("GET", `/search?q=${query(RUN_ID)}&limit=500`, {
    token,
  });

  expectEqual(
    "grouped: a limit above the maximum is clamped",
    pageOf(clamped.body, "limit"),
    MAX_PAGE_SIZE,
  );

  const repeat = await api("GET", `/search?q=${query(RUN_ID)}`, { token });

  expectTrue(
    "grouped: the same term returns the same rows in the same order",
    JSON.stringify(idsOf(readGroup(all.body, "programs"))) ===
      JSON.stringify(idsOf(readGroup(repeat.body, "programs"))),
    {
      first: idsOf(readGroup(all.body, "programs")),
      second: idsOf(readGroup(repeat.body, "programs")),
    },
  );

  await runRankingChecks(ids, token);
  await runStudentChecks(ids, all, token);
  await runCommunityContextChecks(ids, all);
}

/**
 * Relevance: an exact name beats a prefix, a prefix beats a substring, and a
 * secondary field is only consulted once the primary one has nothing to add.
 */
async function runRankingChecks(ids: RunIds, token: string): Promise<void> {
  console.log("\n--- relevance ---");

  const programs = await api("GET", `/search?q=${query(`${RUN_ID} Program`)}`, {
    token,
  });
  const programNames = namesOf(readGroup(programs.body, "programs"));

  expectStatus("relevance: a programme term is answered", programs, 200);
  expectEqual(
    "relevance: only the programmes that carry the term are counted",
    countOf(programs.body, "programs"),
    3,
  );
  expectTrue(
    "relevance: the exact name is first and the prefix matches follow in name order",
    JSON.stringify(programNames) ===
      JSON.stringify([
        `${RUN_ID} Program`,
        `${RUN_ID} Program Alpha`,
        `${RUN_ID} Program Beta`,
      ]),
    programNames,
  );

  // The programme called "Studies" cannot be found by its name, its degree or its
  // field prefix: only the field it records can lead to it.
  const byField = await api("GET", `/search?q=${query(`${RUN_ID} Domain`)}`, {
    token,
  });

  expectEqual(
    "relevance: a secondary field finds a row its name cannot",
    countOf(byField.body, "programs"),
    1,
  );
  expectEqual(
    "relevance: the field match is the programme that records it",
    readString(readGroup(byField.body, "programs")[0], "id"),
    ids.programFieldOnly,
  );

  const byCity = await api("GET", `/search?q=${query(`${RUN_ID} City`)}`, {
    token,
  });

  expectEqual(
    "relevance: a city finds a university its name cannot",
    countOf(byCity.body, "universities"),
    1,
  );
  expectEqual(
    "relevance: the city match is the university that records it",
    readString(readGroup(byCity.body, "universities")[0], "id"),
    ids.universityBeta,
  );

  const byDescription = await api(
    "GET",
    `/search?q=${query(ids.communityAlphaName)}`,
    { token },
  );
  const communityNames = namesOf(readGroup(byDescription.body, "communities"));

  expectEqual(
    "relevance: both communities carry the name of the first",
    countOf(byDescription.body, "communities"),
    2,
  );
  expectTrue(
    "relevance: the name match is listed before the description match",
    JSON.stringify(communityNames) ===
      JSON.stringify([ids.communityAlphaName, ids.communityDescribedName]),
    communityNames,
  );

  const subjects = await api(
    "GET",
    `/search?q=${query(ids.subjectAlphaName)}`,
    {
      token,
    },
  );
  const subjectRow = readGroup(subjects.body, "subjects")[0];

  expectEqual(
    "relevance: an exact subject name finds exactly that subject",
    countOf(subjects.body, "subjects"),
    1,
  );
  expectEqual(
    "relevance: the subject row carries its canonical slug",
    typeof readString(subjectRow, "slug"),
    "string",
  );
}

/** The student category: identity, context, and the profile that never comes back. */
async function runStudentChecks(
  ids: RunIds,
  all: ApiResult,
  token: string,
): Promise<void> {
  console.log("\n--- student results ---");

  const rows = readGroup(all.body, "students");

  expectEqual("students: the term finds the other student", rows.length, 1);
  expectEqual(
    "students: a row is identified by the profile's user id",
    readString(rows[0], "userId"),
    ids.otherStudentId,
  );
  expectEqual(
    "students: the row carries the username",
    readString(rows[0], "username"),
    ids.otherStudentUsername,
  );
  expectEqual(
    "students: the row names the university the profile records",
    readString(rows[0], "universityName"),
    ids.universityAlphaName,
  );
  expectEqual(
    "students: the row names the programme the profile records",
    readString(rows[0], "programName"),
    `${RUN_ID} Program Alpha`,
  );
  expectTrue(
    "students: the searcher is not among the rows",
    !idsOf(rows).includes(ids.viewerId),
    idsOf(rows),
  );

  // The searcher's own username is only ever on the searcher's profile, so a search
  // for it has to come back empty rather than name them to themselves.
  const selfOnly = await api("GET", `/search?q=${query(`${RUN_ID}viewer`)}`, {
    token,
  });

  expectEqual(
    "students: a term only the searcher matches counts nobody",
    countOf(selfOnly.body, "students"),
    0,
  );
  expectEqual(
    "students: ... and returns no row at all",
    groupSize(selfOnly.body, "students"),
    0,
  );

  const byStudy = await api(
    "GET",
    `/search?q=${query(`${RUN_ID} Program Alpha`)}&type=student`,
    { token },
  );

  expectEqual(
    "students: the programme a profile records finds its students",
    countOf(byStudy.body, "students"),
    1,
  );
  expectEqual(
    "students: the row found by programme is the same student",
    readString(readGroup(byStudy.body, "students")[0], "userId"),
    ids.otherStudentId,
  );
}

/** The community category: live member counts and resolved academic context. */
async function runCommunityContextChecks(
  ids: RunIds,
  all: ApiResult,
): Promise<void> {
  console.log("\n--- community results ---");

  const rows = readGroup(all.body, "communities");
  const anchored = rows.find(
    (row) => readString(row, "id") === ids.communityAlpha,
  );
  const unanchored = rows.find(
    (row) => readString(row, "id") === ids.communityDescribed,
  );

  expectTrue(
    "communities: the anchored community is in the results",
    anchored !== undefined,
    idsOf(rows),
  );
  expectTrue(
    "communities: the described community is in the results",
    unanchored !== undefined,
    idsOf(rows),
  );
  expectEqual(
    "communities: the member count is the number of active members",
    readNumber(anchored, "memberCount"),
    2,
  );
  expectEqual(
    "communities: an unanchored community counts its owner",
    readNumber(unanchored, "memberCount"),
    1,
  );

  const context = asRecord(asRecord(anchored)["academicContext"]);

  expectEqual(
    "communities: the context names the university it is anchored to",
    readString(asRecord(context["university"]), "name"),
    ids.universityAlphaName,
  );
  expectEqual(
    "communities: the context carries the university slug",
    typeof readString(asRecord(context["university"]), "slug"),
    "string",
  );
  expectEqual(
    "communities: the context names the programme",
    readString(asRecord(context["program"]), "name"),
    `${RUN_ID} Program Alpha`,
  );
  expectEqual(
    "communities: the context names the subject",
    readString(asRecord(context["subject"]), "name"),
    ids.subjectAlphaName,
  );
  expectEqual(
    "communities: an unanchored community has no university in its context",
    asRecord(asRecord(unanchored)["academicContext"])["university"] ?? null,
    null,
  );
}

/** A typed read: one category, paged exactly like a directory listing. */
async function runTypedChecks(
  ids: RunIds,
  viewer: SessionTokens,
): Promise<void> {
  console.log("\n--- typed search ---");

  const token = viewer.accessToken;
  const groupByType: Record<string, string> = {
    university: "universities",
    program: "programs",
    subject: "subjects",
    community: "communities",
    student: "students",
  };

  for (const type of SEARCH_TYPE_VALUES) {
    const group = groupByType[type] ?? "";
    const result = await api("GET", `/search?q=${query(RUN_ID)}&type=${type}`, {
      token,
    });
    const others = GROUPS.filter((other) => other !== group);
    const leaked = others
      .map((other) => ({
        group: other,
        size: groupSize(result.body, other),
        count: countOf(result.body, other),
      }))
      .filter((entry) => entry.size !== 0 || entry.count !== 0);

    expectStatus(`typed: ${type} is a category`, result, 200);
    expectEqual(
      `typed: ${type} names the type it searched`,
      readString(result.body, "type"),
      type,
    );
    expectEqual(
      `typed: ${type} counts its own matches`,
      countOf(result.body, group),
      SEEDED[group],
    );
    expectEqual(
      `typed: ${type} reports the listing page size`,
      pageOf(result.body, "limit"),
      DEFAULT_PAGE_SIZE,
    );
    expectTrue(
      `typed: ${type} does not answer for any other category`,
      leaked.length === 0,
      leaked,
    );
  }

  const typedAll = await api(
    "GET",
    `/search?q=${query(RUN_ID)}&type=university`,
    {
      token,
    },
  );

  expectEqual(
    "typed: two universities are a single page",
    pageOf(typedAll.body, "totalPages"),
    1,
  );

  const secondPage = await api(
    "GET",
    `/search?q=${query(RUN_ID)}&type=university&limit=1&page=2`,
    { token },
  );

  expectStatus(
    "typed: a typed read pages inside its category",
    secondPage,
    200,
  );
  expectEqual(
    "typed: the page number is echoed",
    pageOf(secondPage.body, "page"),
    2,
  );
  expectEqual(
    "typed: the second page holds the row after the first",
    readString(readGroup(secondPage.body, "universities")[0], "id"),
    ids.universityBeta,
  );
  expectEqual(
    "typed: the total is still the whole category",
    pageOf(secondPage.body, "total"),
    SEEDED.universities,
  );
  expectEqual(
    "typed: the page count follows the typed page size",
    pageOf(secondPage.body, "totalPages"),
    SEEDED.universities,
  );

  const beyond = await api(
    "GET",
    `/search?q=${query(RUN_ID)}&type=university&page=5&limit=2`,
    { token },
  );

  expectStatus("typed: a page past the end is answered", beyond, 200);
  expectEqual(
    "typed: a page past the end holds no rows",
    groupSize(beyond.body, "universities"),
    0,
  );
  expectEqual(
    "typed: a page past the end still reports the total",
    pageOf(beyond.body, "total"),
    SEEDED.universities,
  );

  const typedEmpty = await api(
    "GET",
    `/search?q=${query(`${RUN_ID} Domain`)}&type=community`,
    { token },
  );

  expectStatus(
    "typed: a category with no match is an empty answer",
    typedEmpty,
    200,
  );
  expectEqual(
    "typed: an empty category counts zero",
    countOf(typedEmpty.body, "communities"),
    0,
  );
  expectEqual(
    "typed: an empty category has no pages",
    pageOf(typedEmpty.body, "totalPages"),
    0,
  );

  // The grouped preview and the typed listing are the same read of the same
  // ranking, so the first rows of one are the first rows of the other.
  const typedPrograms = await api(
    "GET",
    `/search?q=${query(RUN_ID)}&type=program&limit=100`,
    { token },
  );
  const groupedPrograms = await api(
    "GET",
    `/search?q=${query(RUN_ID)}&limit=100`,
    {
      token,
    },
  );

  expectTrue(
    "typed: the typed listing is the same order as the grouped preview",
    JSON.stringify(idsOf(readGroup(typedPrograms.body, "programs"))) ===
      JSON.stringify(idsOf(readGroup(groupedPrograms.body, "programs"))),
    {
      typed: idsOf(readGroup(typedPrograms.body, "programs")),
      grouped: idsOf(readGroup(groupedPrograms.body, "programs")),
    },
  );
}

/** The boundaries v1 deliberately has: case, whitespace and finding nothing. */
async function runBoundaryChecks(viewer: SessionTokens): Promise<void> {
  console.log("\n--- boundaries ---");

  const token = viewer.accessToken;
  const absent = await api("GET", `/search?q=${query(`${RUN_ID}-absent`)}`, {
    token,
  });

  expectStatus(
    "boundary: a term that matches nothing is answered, not refused",
    absent,
    200,
  );

  for (const group of GROUPS) {
    expectEqual(
      `boundary: the ${group} count of a no-match term is zero`,
      countOf(absent.body, group),
      0,
    );
  }

  expectTrue(
    "boundary: a no-match term holds no rows in any group",
    GROUPS.every((group) => groupSize(absent.body, group) === 0),
    GROUPS.map((group) => groupSize(absent.body, group)),
  );

  const upperCase = await api(
    "GET",
    `/search?q=${query(RUN_ID.toUpperCase())}`,
    {
      token,
    },
  );

  expectStatus("boundary: an upper case term is answered", upperCase, 200);
  expectEqual(
    "boundary: matching ignores case",
    countOf(upperCase.body, "programs"),
    SEEDED.programs,
  );

  const padded = await api("GET", `/search?q=${query(`  ${RUN_ID}  `)}`, {
    token,
  });

  expectEqual(
    "boundary: a padded term is echoed trimmed",
    readString(padded.body, "query"),
    RUN_ID,
  );
  expectEqual(
    "boundary: a padded term finds the same rows",
    countOf(padded.body, "programs"),
    SEEDED.programs,
  );

  const punctuation = await api("GET", `/search?q=${query("%")}`, { token });

  expectStatus(
    "boundary: a punctuation-only term is answered",
    punctuation,
    200,
  );
  expectEqual(
    "boundary: a punctuation-only term is still page one",
    pageOf(punctuation.body, "page"),
    1,
  );
}

/** The endpoints that existed before search still behave exactly as they did. */
async function runUnchangedChecks(
  ids: RunIds,
  viewer: SessionTokens,
): Promise<void> {
  console.log("\n--- unchanged endpoints ---");

  const directory = await api(
    "GET",
    `/universities?search=${query(RUN_ID)}&limit=100`,
  );

  expectStatus(
    "unchanged: the university directory still reads",
    directory,
    200,
  );
  expectEqual(
    "unchanged: the directory search still matches this run's universities",
    readNumber(directory.body, "total"),
    SEEDED.universities,
  );

  const program = await api("GET", `/programs/${ids.programAlpha}`);
  expectStatus("unchanged: a programme detail still reads", program, 200);

  const subjects = await api("GET", `/subjects?search=${query(RUN_ID)}`);
  expectStatus("unchanged: the subject catalog still reads", subjects, 200);

  const community = await api("GET", `/communities/${ids.communityAlpha}`);
  expectStatus("unchanged: a community detail still reads", community, 200);

  const students = await api("GET", "/student-profiles?limit=100", {
    token: viewer.accessToken,
  });

  expectStatus(
    "unchanged: the student directory still reads for a signed-in student",
    students,
    200,
  );
  expectTrue(
    "unchanged: the directory still lists the other student",
    asArray(asRecord(students.body)["items"])
      .map(asRecord)
      .some((row) => readString(row, "userId") === ids.otherStudentId),
  );

  const feed = await api("GET", `/feed?userId=${ids.viewerId}&limit=5`);

  expectStatus("unchanged: the feed still reads", feed, 200);
}

async function main(): Promise<void> {
  console.log(`BridgeEd global search smoke test :: ${RUN_ID}`);
  console.log(`target ${API_BASE_URL}${API_PREFIX}`);

  const ids = emptyRunIds();
  const baseline = await readCounts();

  try {
    const viewer = await runSetup(ids);

    await runRequestChecks(viewer);
    await runGroupedChecks(ids, viewer);
    await runTypedChecks(ids, viewer);
    await runBoundaryChecks(viewer);
    await runUnchangedChecks(ids, viewer);
  } finally {
    await cleanup(ids);
    await audit(baseline);
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
