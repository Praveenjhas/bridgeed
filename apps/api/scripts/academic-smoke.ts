/**
 * BridgeEd academic discovery live smoke test.
 *
 * Usage:
 *   1. Make sure PostgreSQL is running and the API is serving
 *      (`npm run dev --workspace=apps/api`).
 *   2. Run `npm run smoke:academic --workspace=apps/api`
 *
 * Optional environment variables:
 *   API_BASE_URL (default http://localhost:4000)
 *
 * It drives the whole discovery surface the way the app does: the university
 * directory (paging, search, invalid paging), one university by id and by slug
 * with its programmes and communities, one programme with its university and
 * subjects, the subject catalog, the programme a student profile records, and the
 * optional academic context a community can carry. Every row it creates carries
 * this run's id in its name and is removed again in cleanup, even when a check
 * fails; the audit then proves the row counts came back to where they started.
 */
import { randomUUID } from "node:crypto";
import { COMMUNITY_TYPES } from "@bridgeed/shared";
import { prisma } from "../src/config/prisma";
import {
  COMMUNITY_ACADEMIC_CONTEXT_INVALID_MESSAGE,
  COMMUNITY_PROGRAM_UNIVERSITY_MISMATCH_MESSAGE,
  COMMUNITY_UNKNOWN_PROGRAM_MESSAGE,
  COMMUNITY_UNKNOWN_SUBJECT_MESSAGE,
  COMMUNITY_UNKNOWN_UNIVERSITY_MESSAGE,
} from "../src/services/community.service";
import { PROGRAM_NOT_FOUND_MESSAGE } from "../src/services/program.service";
import {
  STUDENT_PROFILE_PROGRAM_UNIVERSITY_MISMATCH_MESSAGE,
  STUDENT_PROFILE_UNKNOWN_PROGRAM_MESSAGE,
  STUDENT_PROFILE_UNKNOWN_UNIVERSITY_MESSAGE,
} from "../src/services/student-profile.service";
import { UNIVERSITY_NOT_FOUND_MESSAGE } from "../src/services/university.service";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const API_PREFIX = "/api/v1";

/** Every row this run creates carries this id in its unique key. */
const RUN_ID = `acadsmk${Date.now().toString(36)}${Math.random()
  .toString(36)
  .slice(2, 6)}`;

/** A password that satisfies the policy and is not on the blocklist. */
const VALID_PASSWORD = "Smoke-Verifier-9f3a-Qz";

/** The page size the directory screens read; the API caps `limit` at 100. */
const DIRECTORY_PAGE_SIZE = 100;

/** The message the paged listings return for an unusable `page` or `limit`. */
const INVALID_PAGINATION_MESSAGE = "page and limit must be positive integers";

/** The message a repeated `search` parameter returns. */
const INVALID_SEARCH_MESSAGE = "search must be a single string";

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
  universityA: string;
  universityB: string;
  universityAName: string;
  universityBName: string;
  universityASlug: string;
  programA1: string;
  programA2: string;
  programB1: string;
  programA1Name: string;
  programB1Name: string;
  subjectOne: string;
  subjectTwo: string;
  subjectOneName: string;
  userIds: string[];
  communityIds: string[];
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

/** The `items` array of a paginated response. */
function readItems(body: unknown): Record<string, unknown>[] {
  return asArray(asRecord(body)["items"]).map(asRecord);
}

/** The `total` of a paginated response. */
function readTotal(body: unknown): number | null {
  return readNumber(body, "total");
}

/** The `name` of every row in a list, in the order the API returned them. */
function namesOf(rows: Record<string, unknown>[]): (string | null)[] {
  return rows.map((row) => readString(row, "name"));
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

/** Encodes a query value, so a search term with spaces stays one parameter. */
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
): Promise<{ id: string; name: string; slug: string }> {
  const name = `${RUN_ID} University ${label}`;
  const result = await api("POST", "/universities", {
    body: {
      name,
      country: "India",
      state: "Himachal Pradesh",
      city: "Mandi",
      websiteUrl: "https://example.edu",
      description: `${RUN_ID} academic smoke`,
      logoUrl: null,
    },
  });

  expectStatus(`setup: create university ${label}`, result, 201);

  const id = readString(result.body, "id");
  const slug = readString(result.body, "slug");

  if (!id || !slug) {
    throw new Error(`setup: create university ${label} returned no identity`);
  }

  // The slug is derived from the name, which is what the detail URL is built on.
  expectEqual(
    `setup: university ${label} slug is derived from its name`,
    slug,
    `${RUN_ID}-university-${label.toLowerCase()}`,
  );

  return { id, name, slug };
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

/** Seeds a programme row directly: programmes are read-only over HTTP. */
async function seedProgram(
  universityId: string,
  label: string,
): Promise<{ id: string; name: string }> {
  const name = `${RUN_ID} Program ${label}`;
  const id = randomUUID();

  await prisma.program.create({
    data: {
      id,
      universityId,
      name,
      degree: "B.Tech",
      field: "Engineering",
      description: `${RUN_ID} academic smoke`,
    },
  });

  return { id, name };
}

/** Links a programme to a subject through the join table. */
async function linkSubject(
  programId: string,
  subjectId: string,
): Promise<void> {
  await prisma.programSubject.create({ data: { programId, subjectId } });
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

  if (!ids.userIds.includes(session.userId)) {
    ids.userIds.push(session.userId);
  }

  return session;
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
    universityA: "",
    universityB: "",
    universityAName: "",
    universityBName: "",
    universityASlug: "",
    programA1: "",
    programA2: "",
    programB1: "",
    programA1Name: "",
    programB1Name: "",
    subjectOne: "",
    subjectTwo: "",
    subjectOneName: "",
    userIds: [],
    communityIds: [],
  };
}

/**
 * Creates everything the run reads: two universities, two programmes on the first
 * and one on the second, two subjects linked to the first programme, and a student
 * enrolled on that programme. Every row is named with the run id, so the directory
 * assertions can search for exactly this run's rows and nothing else.
 */
async function runSetup(ids: RunIds): Promise<SessionTokens> {
  console.log("\n--- setup ---");

  const universityA = await createUniversity("One");
  const universityB = await createUniversity("Two");

  ids.universityA = universityA.id;
  ids.universityB = universityB.id;
  ids.universityAName = universityA.name;
  ids.universityBName = universityB.name;
  ids.universityASlug = universityA.slug;

  const subjectOne = await seedSubject("Alpha");
  const subjectTwo = await seedSubject("Beta");

  ids.subjectOne = subjectOne.id;
  ids.subjectTwo = subjectTwo.id;
  ids.subjectOneName = subjectOne.name;

  const programA1 = await seedProgram(ids.universityA, "One");
  const programA2 = await seedProgram(ids.universityA, "Two");
  const programB1 = await seedProgram(ids.universityB, "One");

  ids.programA1 = programA1.id;
  ids.programA2 = programA2.id;
  ids.programB1 = programB1.id;
  ids.programA1Name = programA1.name;
  ids.programB1Name = programB1.name;

  await linkSubject(programA1.id, subjectOne.id);
  await linkSubject(programA1.id, subjectTwo.id);

  // The student is enrolled on the first university and its first programme, which
  // is the pair every profile assertion below reads back.
  const student = await registerAccount(ids, "one");
  const profile = await api("POST", "/student-profiles/me", {
    token: student.accessToken,
    body: {
      name: "Smoke Academic One",
      username: `${RUN_ID}one`,
      universityId: ids.universityA,
      programId: ids.programA1,
    },
  });

  expectStatus("setup: create the enrolled student profile", profile, 201);
  expectEqual(
    "setup: the profile records the programme",
    readString(profile.body, "programId"),
    ids.programA1,
  );

  return student;
}

/** Removes every row this run created, in dependency order. */
async function cleanup(ids: RunIds): Promise<void> {
  console.log("\n--- cleanup ---");

  await prisma.community.deleteMany({
    where: { id: { in: ids.communityIds } },
  });
  await prisma.program.deleteMany({
    where: { id: { in: [ids.programA1, ids.programA2, ids.programB1] } },
  });
  await prisma.subject.deleteMany({
    where: { id: { in: [ids.subjectOne, ids.subjectTwo] } },
  });
  // Deleting the accounts takes their profiles, sessions and memberships with them.
  await prisma.user.deleteMany({ where: { id: { in: ids.userIds } } });
  await prisma.university.deleteMany({
    where: { id: { in: [ids.universityA, ids.universityB] } },
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

/** Proves the run left every table it touched exactly as it found it. */
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

/** The university directory: paging, name search and the bad requests it owns. */
async function runDirectoryChecks(ids: RunIds): Promise<void> {
  console.log("\n--- university directory ---");

  const page = await api(
    "GET",
    `/universities?limit=${DIRECTORY_PAGE_SIZE}&search=${query(RUN_ID)}`,
  );

  expectStatus("directory: a search reads a page", page, 200);
  expectEqual(
    "directory: the page reports its size",
    readNumber(page.body, "limit"),
    DIRECTORY_PAGE_SIZE,
  );
  expectEqual(
    "directory: the search matches both universities",
    readTotal(page.body),
    2,
  );

  const rows = readItems(page.body);
  const listedNames = namesOf(rows);

  expectEqual("directory: the page carries both rows", rows.length, 2);
  expectEqual(
    "directory: rows are ordered by name",
    listedNames[0],
    ids.universityAName,
  );
  expectEqual(
    "directory: the second row follows",
    listedNames[1],
    ids.universityBName,
  );

  // Each row carries the three counts the directory card prints.
  expectEqual(
    "directory: the first university counts its programmes",
    readNumber(rows[0], "programCount"),
    2,
  );
  expectEqual(
    "directory: the first university counts its students",
    readNumber(rows[0], "studentCount"),
    1,
  );
  expectEqual(
    "directory: the first university counts its communities",
    readNumber(rows[0], "communityCount"),
    0,
  );
  expectEqual(
    "directory: the second university counts its programmes",
    readNumber(rows[1], "programCount"),
    1,
  );
  expectEqual(
    "directory: the second university counts its students",
    readNumber(rows[1], "studentCount"),
    0,
  );

  // The slug, country and description the card needs travel with the row.
  expectEqual(
    "directory: a row carries its slug",
    readString(rows[0], "slug"),
    ids.universityASlug,
  );
  expectEqual(
    "directory: a row carries its country",
    readString(rows[0], "country"),
    "India",
  );
  expectEqual(
    "directory: a row carries its description",
    readString(rows[0], "description"),
    `${RUN_ID} academic smoke`,
  );

  // Search is a case-insensitive match on the name.
  const upperCase = await api(
    "GET",
    `/universities?search=${query(RUN_ID.toUpperCase())}`,
  );
  expectEqual("directory: search ignores case", readTotal(upperCase.body), 2);

  const oneName = await api(
    "GET",
    `/universities?search=${query(`${RUN_ID} University Two`)}`,
  );
  expectEqual(
    "directory: search matches a full name",
    readTotal(oneName.body),
    1,
  );
  expectEqual(
    "directory: the named row is the one returned",
    readItems(oneName.body)[0]?.["name"],
    ids.universityBName,
  );

  const noMatch = await api(
    "GET",
    `/universities?search=${query(`${RUN_ID}-nothing`)}`,
  );
  expectEqual(
    "directory: an unmatched search is an empty page",
    readTotal(noMatch.body),
    0,
  );
  expectEqual(
    "directory: an empty page carries no rows",
    readItems(noMatch.body).length,
    0,
  );

  // Paging reads the same two rows one at a time.
  const secondPage = await api(
    "GET",
    `/universities?page=2&limit=1&search=${query(RUN_ID)}`,
  );

  expectStatus("directory: a second page is readable", secondPage, 200);
  expectEqual(
    "directory: the second page reports its number",
    readNumber(secondPage.body, "page"),
    2,
  );
  expectEqual(
    "directory: the second page counts both pages",
    readNumber(secondPage.body, "totalPages"),
    2,
  );
  expectEqual(
    "directory: the second page carries the second row",
    readItems(secondPage.body)[0]?.["name"],
    ids.universityBName,
  );

  // An empty search means "no search" rather than an error.
  const emptySearch = await api("GET", "/universities?search=");

  expectStatus("directory: an empty search is accepted", emptySearch, 200);
  expectTrue(
    "directory: an empty search reads the whole directory",
    (readTotal(emptySearch.body) ?? 0) >= 2,
    { total: readTotal(emptySearch.body) },
  );

  // Bad requests.
  const zeroPage = await api("GET", "/universities?page=0");
  expectError(
    "directory: page 0 is refused",
    zeroPage,
    400,
    INVALID_PAGINATION_MESSAGE,
  );

  const negativePage = await api("GET", "/universities?page=-1");
  expectError(
    "directory: a negative page is refused",
    negativePage,
    400,
    INVALID_PAGINATION_MESSAGE,
  );

  const badLimit = await api("GET", "/universities?limit=ten");
  expectError(
    "directory: a non-numeric limit is refused",
    badLimit,
    400,
    INVALID_PAGINATION_MESSAGE,
  );

  const repeatedSearch = await api("GET", "/universities?search=a&search=b");
  expectError(
    "directory: a repeated search is refused",
    repeatedSearch,
    400,
    INVALID_SEARCH_MESSAGE,
  );
}

/** One university: by id, by slug, and the two ways of asking for nothing. */
async function runUniversityDetailChecks(ids: RunIds): Promise<void> {
  console.log("\n--- university detail ---");

  const byId = await api("GET", `/universities/${ids.universityA}`);

  expectStatus("detail: a university is readable by id", byId, 200);
  expectEqual(
    "detail: the id is the one asked for",
    readString(byId.body, "id"),
    ids.universityA,
  );
  expectEqual(
    "detail: the name is carried",
    readString(byId.body, "name"),
    ids.universityAName,
  );
  expectEqual(
    "detail: the slug is carried",
    readString(byId.body, "slug"),
    ids.universityASlug,
  );
  expectEqual(
    "detail: the counts are carried",
    readNumber(byId.body, "programCount"),
    2,
  );

  // The programmes arrive inside the document, ordered by name.
  const programs = asArray(asRecord(byId.body)["programs"]).map(asRecord);

  expectEqual("detail: both programmes are carried", programs.length, 2);
  expectEqual(
    "detail: the programmes are ordered by name",
    namesOf(programs)[0],
    ids.programA1Name,
  );
  expectEqual(
    "detail: a programme row names its university",
    readString(programs[0], "universityName"),
    ids.universityAName,
  );
  expectEqual(
    "detail: a programme row carries its university id",
    readString(programs[0], "universityId"),
    ids.universityA,
  );
  expectEqual(
    "detail: a programme row carries its degree",
    readString(programs[0], "degree"),
    "B.Tech",
  );
  expectEqual(
    "detail: nothing is anchored to the university yet",
    asArray(asRecord(byId.body)["communities"]).length,
    0,
  );

  const bySlug = await api("GET", `/universities/slug/${ids.universityASlug}`);

  expectStatus("detail: a university is readable by slug", bySlug, 200);
  expectEqual(
    "detail: the slug resolves to the same university",
    readString(bySlug.body, "id"),
    ids.universityA,
  );

  const unknownId = await api("GET", `/universities/${randomUUID()}`);
  expectError(
    "detail: an unknown id is a 404",
    unknownId,
    404,
    UNIVERSITY_NOT_FOUND_MESSAGE,
  );

  const unknownSlug = await api(
    "GET",
    `/universities/slug/${RUN_ID}-does-not-exist`,
  );
  expectError(
    "detail: an unknown slug is a 404",
    unknownSlug,
    404,
    UNIVERSITY_NOT_FOUND_MESSAGE,
  );

  const blankSlug = await api("GET", "/universities/slug/%20");
  expectError(
    "detail: a blank slug is a bad request",
    blankSlug,
    400,
    "Invalid university slug",
  );
}

/** The programmes of a university, then one programme with its subjects. */
async function runProgramChecks(ids: RunIds): Promise<void> {
  console.log("\n--- programmes ---");

  const list = await api("GET", `/universities/${ids.universityA}/programs`);

  expectStatus("programmes: a university lists its programmes", list, 200);

  const rows = asArray(list.body).map(asRecord);

  expectEqual("programmes: both are listed", rows.length, 2);
  expectEqual(
    "programmes: they are ordered by name",
    namesOf(rows)[0],
    ids.programA1Name,
  );
  expectEqual(
    "programmes: a row names its university",
    readString(rows[0], "universityName"),
    ids.universityAName,
  );

  const unknownUniversity = await api(
    "GET",
    `/universities/${randomUUID()}/programs`,
  );
  expectError(
    "programmes: an unknown university is a 404, not an empty list",
    unknownUniversity,
    404,
    UNIVERSITY_NOT_FOUND_MESSAGE,
  );

  const detail = await api("GET", `/programs/${ids.programA1}`);

  expectStatus("programmes: a programme is readable by id", detail, 200);
  expectEqual(
    "programmes: the name is carried",
    readString(detail.body, "name"),
    ids.programA1Name,
  );
  expectEqual(
    "programmes: the university id is carried",
    readString(detail.body, "universityId"),
    ids.universityA,
  );
  expectEqual(
    "programmes: the university name is carried",
    readString(detail.body, "universityName"),
    ids.universityAName,
  );

  const university = asRecord(asRecord(detail.body)["university"]);

  expectEqual(
    "programmes: the university document is carried",
    readString(university, "id"),
    ids.universityA,
  );
  expectEqual(
    "programmes: the university document carries its slug",
    readString(university, "slug"),
    ids.universityASlug,
  );

  // The subjects arrive as full subject rows, ordered by name.
  const subjects = asArray(asRecord(detail.body)["subjects"]).map(asRecord);

  expectEqual("programmes: both subjects are carried", subjects.length, 2);
  expectEqual(
    "programmes: the first subject is the alpha one",
    namesOf(subjects)[0],
    ids.subjectOneName,
  );
  expectEqual(
    "programmes: the second subject is the beta one",
    namesOf(subjects)[1],
    `${RUN_ID} Subject Beta`,
  );
  expectEqual(
    "programmes: a subject carries its slug",
    readString(subjects[0], "slug"),
    `${RUN_ID}-subject-alpha`,
  );

  expectEqual(
    "programmes: the student count is carried",
    readNumber(detail.body, "studentCount"),
    1,
  );
  expectEqual(
    "programmes: the community count is carried",
    readNumber(detail.body, "communityCount"),
    0,
  );

  const unknownProgram = await api("GET", `/programs/${randomUUID()}`);
  expectError(
    "programmes: an unknown programme is a 404",
    unknownProgram,
    404,
    PROGRAM_NOT_FOUND_MESSAGE,
  );
}

/** The subject catalog: the same paging and search rules as the directory. */
async function runSubjectChecks(ids: RunIds): Promise<void> {
  console.log("\n--- subjects ---");

  const page = await api(
    "GET",
    `/subjects?limit=${DIRECTORY_PAGE_SIZE}&search=${query(RUN_ID)}`,
  );

  expectStatus("subjects: a search reads a page", page, 200);
  expectEqual("subjects: both subjects are matched", readTotal(page.body), 2);

  const rows = readItems(page.body);

  expectEqual("subjects: the page carries both rows", rows.length, 2);
  expectEqual(
    "subjects: the rows are ordered by name",
    namesOf(rows)[0],
    ids.subjectOneName,
  );
  expectEqual(
    "subjects: a row carries its slug",
    readString(rows[0], "slug"),
    `${RUN_ID}-subject-alpha`,
  );

  const upperCase = await api(
    "GET",
    `/subjects?search=${query(RUN_ID.toUpperCase())}`,
  );
  expectEqual("subjects: search ignores case", readTotal(upperCase.body), 2);

  const oneName = await api(
    "GET",
    `/subjects?search=${query(`${RUN_ID} Subject Beta`)}`,
  );
  expectEqual(
    "subjects: search matches a full name",
    readTotal(oneName.body),
    1,
  );
  expectEqual(
    "subjects: the named row is the one returned",
    readItems(oneName.body)[0]?.["name"],
    `${RUN_ID} Subject Beta`,
  );

  const secondPage = await api(
    "GET",
    `/subjects?page=2&limit=1&search=${query(RUN_ID)}`,
  );
  expectEqual(
    "subjects: the second page carries the second row",
    readItems(secondPage.body)[0]?.["name"],
    `${RUN_ID} Subject Beta`,
  );
  expectEqual(
    "subjects: the second page counts both pages",
    readNumber(secondPage.body, "totalPages"),
    2,
  );

  const zeroPage = await api("GET", "/subjects?page=0");
  expectError(
    "subjects: page 0 is refused",
    zeroPage,
    400,
    INVALID_PAGINATION_MESSAGE,
  );

  const zeroLimit = await api("GET", "/subjects?limit=0");
  expectError(
    "subjects: a zero limit is refused",
    zeroLimit,
    400,
    INVALID_PAGINATION_MESSAGE,
  );

  const repeatedSearch = await api("GET", "/subjects?search=a&search=b");
  expectError(
    "subjects: a repeated search is refused",
    repeatedSearch,
    400,
    INVALID_SEARCH_MESSAGE,
  );
}

/** The programme a profile records: create, read, move, clear and the refusals. */
async function runProfileProgramChecks(
  ids: RunIds,
  student: SessionTokens,
): Promise<SessionTokens> {
  console.log("\n--- student profile programme ---");

  const read = await api("GET", "/student-profiles/me", {
    token: student.accessToken,
  });

  expectStatus("profile: the student profile is readable", read, 200);
  expectEqual(
    "profile: the profile records the programme",
    readString(read.body, "programId"),
    ids.programA1,
  );
  expectEqual(
    "profile: the profile records the university",
    readString(read.body, "universityId"),
    ids.universityA,
  );

  const program = asRecord(asRecord(read.body)["program"]);

  expectEqual(
    "profile: the programme document is resolved",
    readString(program, "name"),
    ids.programA1Name,
  );
  expectEqual(
    "profile: the programme names its university",
    readString(program, "universityName"),
    ids.universityAName,
  );
  expectEqual(
    "profile: the university document is resolved",
    readString(asRecord(read.body)["university"], "id"),
    ids.universityA,
  );

  // A programme the recorded university does not offer is refused even when the
  // update names only the programme, so the pair can never drift apart.
  const mismatch = await api("PATCH", "/student-profiles/me", {
    token: student.accessToken,
    body: { programId: ids.programB1 },
  });
  expectError(
    "profile: a programme of another university is refused",
    mismatch,
    400,
    STUDENT_PROFILE_PROGRAM_UNIVERSITY_MISMATCH_MESSAGE,
  );

  const unknownProgram = await api("PATCH", "/student-profiles/me", {
    token: student.accessToken,
    body: { programId: randomUUID() },
  });
  expectError(
    "profile: an unknown programme is refused",
    unknownProgram,
    400,
    STUDENT_PROFILE_UNKNOWN_PROGRAM_MESSAGE,
  );

  const unknownUniversity = await api("PATCH", "/student-profiles/me", {
    token: student.accessToken,
    body: { universityId: randomUUID() },
  });
  expectError(
    "profile: an unknown university is refused",
    unknownUniversity,
    400,
    STUDENT_PROFILE_UNKNOWN_UNIVERSITY_MESSAGE,
  );

  // The whole pair can be moved together, and the programme can be cleared.
  const moved = await api("PATCH", "/student-profiles/me", {
    token: student.accessToken,
    body: { universityId: ids.universityB, programId: ids.programB1 },
  });

  expectStatus("profile: the pair can be moved together", moved, 200);
  expectEqual(
    "profile: the move records the programme",
    readString(moved.body, "programId"),
    ids.programB1,
  );
  expectEqual(
    "profile: the move records the university",
    readString(moved.body, "universityId"),
    ids.universityB,
  );

  const cleared = await api("PATCH", "/student-profiles/me", {
    token: student.accessToken,
    body: { programId: null },
  });

  expectStatus("profile: the programme can be cleared", cleared, 200);
  expectEqual(
    "profile: a cleared programme is stored as null",
    asRecord(cleared.body)["programId"] ?? null,
    null,
  );
  expectEqual(
    "profile: a cleared programme resolves to nothing",
    asRecord(cleared.body)["program"] ?? null,
    null,
  );

  const restored = await api("PATCH", "/student-profiles/me", {
    token: student.accessToken,
    body: { universityId: ids.universityA, programId: ids.programA1 },
  });

  expectStatus("profile: the student can be enrolled again", restored, 200);
  expectEqual(
    "profile: the enrolment is restored",
    readString(restored.body, "programId"),
    ids.programA1,
  );

  // The create path validates the same pair, which is what onboarding sends when
  // it writes the first profile.
  const secondStudent = await registerAccount(ids, "two");

  const badPair = await api("POST", "/student-profiles/me", {
    token: secondStudent.accessToken,
    body: {
      name: "Smoke Academic Two",
      username: `${RUN_ID}two`,
      universityId: ids.universityA,
      programId: ids.programB1,
    },
  });
  expectError(
    "profile: a new profile refuses a programme of another university",
    badPair,
    400,
    STUDENT_PROFILE_PROGRAM_UNIVERSITY_MISMATCH_MESSAGE,
  );

  const badProgram = await api("POST", "/student-profiles/me", {
    token: secondStudent.accessToken,
    body: {
      name: "Smoke Academic Two",
      username: `${RUN_ID}two`,
      programId: randomUUID(),
    },
  });
  expectError(
    "profile: a new profile refuses an unknown programme",
    badProgram,
    400,
    STUDENT_PROFILE_UNKNOWN_PROGRAM_MESSAGE,
  );

  const badUniversity = await api("POST", "/student-profiles/me", {
    token: secondStudent.accessToken,
    body: {
      name: "Smoke Academic Two",
      username: `${RUN_ID}two`,
      universityId: randomUUID(),
    },
  });
  expectError(
    "profile: a new profile refuses an unknown university",
    badUniversity,
    400,
    STUDENT_PROFILE_UNKNOWN_UNIVERSITY_MESSAGE,
  );

  const created = await api("POST", "/student-profiles/me", {
    token: secondStudent.accessToken,
    body: {
      name: "Smoke Academic Two",
      username: `${RUN_ID}two`,
      universityId: ids.universityB,
      programId: ids.programB1,
    },
  });

  expectStatus("profile: a new profile records the pair", created, 201);
  expectEqual(
    "profile: the new profile records the programme",
    readString(created.body, "programId"),
    ids.programB1,
  );

  return secondStudent;
}

/**
 * The optional academic context a community carries, and the community flows it
 * must not disturb. The context is what lets a community be discovered from the
 * university or programme it belongs to; a community without one has to behave
 * exactly as it did before the academic graph existed.
 */
async function runCommunityChecks(
  ids: RunIds,
  student: SessionTokens,
  secondStudent: SessionTokens,
): Promise<void> {
  console.log("\n--- community academic context ---");

  const withContext = await api("POST", "/communities", {
    token: student.accessToken,
    body: {
      name: `${RUN_ID} Thermodynamics Circle`,
      slug: `${RUN_ID}-thermo-circle`,
      type: COMMUNITY_TYPES.PUBLIC,
      description: `${RUN_ID} academic smoke`,
      universityId: ids.universityA,
      programId: ids.programA1,
      subjectId: ids.subjectOne,
    },
  });

  expectStatus("community: a community can be anchored", withContext, 201);

  const anchoredId = readString(withContext.body, "id");

  if (!anchoredId) {
    throw new Error("community: creating an anchored community returned no id");
  }

  ids.communityIds.push(anchoredId);

  expectEqual(
    "community: the university anchor is stored",
    readString(withContext.body, "universityId"),
    ids.universityA,
  );
  expectEqual(
    "community: the programme anchor is stored",
    readString(withContext.body, "programId"),
    ids.programA1,
  );
  expectEqual(
    "community: the subject anchor is stored",
    readString(withContext.body, "subjectId"),
    ids.subjectOne,
  );

  const detail = await api("GET", `/communities/${anchoredId}`);
  const context = asRecord(asRecord(detail.body)["academicContext"]);

  expectStatus("community: the anchored community is readable", detail, 200);
  expectEqual(
    "community: the context names the university",
    readString(asRecord(context["university"]), "name"),
    ids.universityAName,
  );
  expectEqual(
    "community: the context carries the university slug",
    readString(asRecord(context["university"]), "slug"),
    ids.universityASlug,
  );
  expectEqual(
    "community: the context names the programme",
    readString(asRecord(context["program"]), "name"),
    ids.programA1Name,
  );
  expectEqual(
    "community: the context names the subject",
    readString(asRecord(context["subject"]), "name"),
    ids.subjectOneName,
  );

  // A community with no academic context is exactly what it was before: every
  // anchor is null and the resolved context is empty rather than absent.
  const plain = await api("POST", "/communities", {
    body: {
      name: `${RUN_ID} Plain Circle`,
      slug: `${RUN_ID}-plain-circle`,
      type: COMMUNITY_TYPES.PUBLIC,
      createdById: student.userId,
    },
  });

  expectStatus(
    "community: a community without context is still created",
    plain,
    201,
  );

  const plainId = readString(plain.body, "id");

  if (!plainId) {
    throw new Error("community: creating a plain community returned no id");
  }

  ids.communityIds.push(plainId);

  expectEqual(
    "community: an unanchored row has no university",
    asRecord(plain.body)["universityId"] ?? null,
    null,
  );

  const plainDetail = await api("GET", `/communities/${plainId}`);
  const plainContext = asRecord(asRecord(plainDetail.body)["academicContext"]);

  expectStatus("community: the plain community is readable", plainDetail, 200);
  expectEqual(
    "community: the empty context has no university",
    plainContext["university"] ?? null,
    null,
  );
  expectEqual(
    "community: the empty context has no programme",
    plainContext["program"] ?? null,
    null,
  );
  expectEqual(
    "community: the empty context has no subject",
    plainContext["subject"] ?? null,
    null,
  );

  /** Attempts a community with one anchor, so a refusal can be named precisely. */
  const attemptAnchor = (
    label: string,
    anchors: Record<string, unknown>,
  ): Promise<ApiResult> =>
    api("POST", "/communities", {
      body: {
        name: `${RUN_ID} ${label}`,
        slug: `${RUN_ID}-${label.toLowerCase().replace(/\s+/g, "-")}`,
        type: COMMUNITY_TYPES.PUBLIC,
        createdById: student.userId,
        ...anchors,
      },
    });

  const mismatch = await attemptAnchor("mismatch circle", {
    universityId: ids.universityA,
    programId: ids.programB1,
  });
  expectError(
    "community: a programme of another university is refused",
    mismatch,
    400,
    COMMUNITY_PROGRAM_UNIVERSITY_MISMATCH_MESSAGE,
  );

  const unknownProgram = await attemptAnchor("unknown program circle", {
    programId: randomUUID(),
  });
  expectError(
    "community: an unknown programme is refused",
    unknownProgram,
    400,
    COMMUNITY_UNKNOWN_PROGRAM_MESSAGE,
  );

  const unknownUniversity = await attemptAnchor("unknown university circle", {
    universityId: randomUUID(),
  });
  expectError(
    "community: an unknown university is refused",
    unknownUniversity,
    400,
    COMMUNITY_UNKNOWN_UNIVERSITY_MESSAGE,
  );

  const unknownSubject = await attemptAnchor("unknown subject circle", {
    subjectId: randomUUID(),
  });
  expectError(
    "community: an unknown subject is refused",
    unknownSubject,
    400,
    COMMUNITY_UNKNOWN_SUBJECT_MESSAGE,
  );

  const invalidAnchor = await attemptAnchor("invalid anchor circle", {
    programId: 42,
  });
  expectError(
    "community: a non-string anchor is refused",
    invalidAnchor,
    400,
    COMMUNITY_ACADEMIC_CONTEXT_INVALID_MESSAGE,
  );

  // A blank id means "not set" rather than an error, so the form can send an
  // empty selection without the API having to special-case it.
  const blankAnchor = await attemptAnchor("blank anchor circle", {
    subjectId: "   ",
  });

  expectStatus(
    "community: a blank anchor is treated as no anchor",
    blankAnchor,
    201,
  );

  const blankAnchorId = readString(blankAnchor.body, "id");

  if (!blankAnchorId) {
    throw new Error(
      "community: creating a blank-anchor community returned no id",
    );
  }

  ids.communityIds.push(blankAnchorId);

  expectEqual(
    "community: a blank anchor is stored as null",
    asRecord(blankAnchor.body)["subjectId"] ?? null,
    null,
  );

  // The discovery documents now carry the community that anchors to them.
  const universityDetail = await api("GET", `/universities/${ids.universityA}`);
  const communities = asArray(
    asRecord(universityDetail.body)["communities"],
  ).map(asRecord);

  expectEqual(
    "community: the university lists its anchored community",
    communities.length,
    1,
  );
  expectEqual(
    "community: the listed community is the anchored one",
    readString(communities[0], "id"),
    anchoredId,
  );
  expectEqual(
    "community: the university counts its community",
    readNumber(universityDetail.body, "communityCount"),
    1,
  );

  const programDetail = await api("GET", `/programs/${ids.programA1}`);
  expectEqual(
    "community: the programme counts its community",
    readNumber(programDetail.body, "communityCount"),
    1,
  );

  // The flows that already existed keep working with the new columns in place.
  const list = await api(
    "GET",
    `/communities?page=1&limit=${DIRECTORY_PAGE_SIZE}`,
  );
  const listedIds = readItems(list.body).map((row) => readString(row, "id"));

  expectStatus("unchanged: the community list still reads", list, 200);
  expectTrue(
    "unchanged: the list carries both created communities",
    listedIds.includes(anchoredId) && listedIds.includes(plainId),
    { anchoredId, plainId },
  );

  const join = await api("POST", `/communities/${anchoredId}/join`, {
    token: secondStudent.accessToken,
  });
  expectStatus("unchanged: another student can still join", join, 201);

  const members = await api("GET", `/communities/${anchoredId}/members`);
  expectStatus("unchanged: the member list still reads", members, 200);
  expectEqual(
    "unchanged: the owner and the new member are listed",
    readTotal(members.body),
    2,
  );

  const feed = await api("GET", `/feed?userId=${student.userId}&limit=5`);
  expectStatus("unchanged: the feed still reads for a member", feed, 200);
}

async function main(): Promise<void> {
  console.log(`BridgeEd academic discovery smoke test :: ${RUN_ID}`);
  console.log(`target ${API_BASE_URL}${API_PREFIX}`);

  const ids = emptyRunIds();
  const baseline = await readCounts();

  try {
    const student = await runSetup(ids);

    await runDirectoryChecks(ids);
    await runUniversityDetailChecks(ids);
    await runProgramChecks(ids);
    await runSubjectChecks(ids);

    const secondStudent = await runProfileProgramChecks(ids, student);

    await runCommunityChecks(ids, student, secondStudent);
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
