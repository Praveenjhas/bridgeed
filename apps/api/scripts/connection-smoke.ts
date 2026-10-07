/**
 * BridgeEd connections + student discovery live smoke test.
 *
 * Usage:
 *   1. Make sure PostgreSQL is running and the API is serving
 *      (`npm run dev --workspace=apps/api`).
 *   2. Run `npm run smoke:connection --workspace=apps/api`
 *
 * Optional environment variables: API_BASE_URL (default http://localhost:4000)
 *
 * It proves the two things hardest to see by reading the code: that the acting
 * student of every connection mutation is the bearer token and never a body
 * field, and that the Discover directory is authenticated and never lists the
 * reader. Every row this run creates is prefixed and removed again, even when a
 * check fails, so the database is left exactly at its baseline.
 */
import { CONNECTION_STATUSES } from "@bridgeed/shared";
import { prisma } from "../src/config/prisma";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const API_PREFIX = "/api/v1";
const RUN_ID = `smk${Date.now().toString(36)}${Math.random()
  .toString(36)
  .slice(2, 7)}`;
/** Prefix every row this run creates carries in its unique key. */
const RUN_PREFIX = `${RUN_ID}-`;
/** A password that satisfies the policy and is not on the blocklist. */
const VALID_PASSWORD = "Smoke-Verifier-9f3a-Qz";

/** Messages produced by the HTTP layer (validation handled in controllers). */
const AUTH_REQUIRED_MESSAGE = "Authentication is required";
const INVALID_PAGINATION_MESSAGE = "page and limit must be positive integers";
const INVALID_STUDENT_ID_MESSAGE = "Invalid student ID";

interface ApiResult {
  status: number;
  body: unknown;
}

interface ApiOptions {
  /** Convenience for `Authorization: Bearer <token>`. */
  token?: string;
  body?: unknown;
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

  return record(name, ok, ok ? undefined : { status, error, body: result.body });
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

function readNumber(source: unknown, key: string): number | null {
  const value = asRecord(source)[key];

  return typeof value === "number" ? value : null;
}

function readItems(value: unknown): Record<string, unknown>[] {
  const items = asRecord(value)["items"];

  return Array.isArray(items) ? items.map(asRecord) : [];
}

interface Account {
  userId: string;
  email: string;
  accessToken: string;
}

/** Registers an account with a password and gives it a student profile. */
async function createStudent(label: string): Promise<Account> {
  const email = `${RUN_PREFIX}${label}@bridgeed-smoke.test`;
  const registered = await api("POST", "/auth/register", {
    body: { email, password: VALID_PASSWORD },
  });

  expectStatus(`setup: register ${label}`, registered, 201);

  const userId = readString(asRecord(registered.body)["user"], "id");
  const accessToken = readString(registered.body, "accessToken");

  if (!userId || !accessToken) {
    throw new Error(`setup: register ${label} did not return a usable session`);
  }

  const profile = await api("POST", "/student-profiles", {
    body: { userId, name: `Smoke ${label}`, username: `${RUN_PREFIX}${label}` },
  });

  expectStatus(`setup: profile ${label}`, profile, 201);

  return { userId, email, accessToken };
}

/** Creates a request and returns the row id, failing loudly if it did not. */
async function createRequest(
  label: string,
  actor: Account,
  receiverId: string,
): Promise<string> {
  const result = await api("POST", "/connections", {
    token: actor.accessToken,
    body: { receiverId },
  });

  const id = readString(result.body, "id");

  if (result.status !== 201 || !id) {
    throw new Error(`${label}: could not create a connection request`);
  }

  return id;
}

/** The Discover directory: authenticated, paginated and never the reader. */
async function runDiscoveryChecks(
  reader: Account,
  others: Account[],
): Promise<void> {
  console.log("\n--- discovery: student directory ---");

  const anonymous = await api("GET", "/student-profiles?page=1&limit=5");
  expectError(
    "discovery: an anonymous directory read is refused",
    anonymous,
    401,
    AUTH_REQUIRED_MESSAGE,
  );

  const firstPage = await api("GET", "/student-profiles?page=1&limit=10", {
    token: reader.accessToken,
  });

  expectStatus("discovery: the first page responds 200", firstPage, 200);
  expectEqual("discovery: the page number is echoed", readNumber(firstPage.body, "page"), 1);
  expectEqual("discovery: the page size is echoed", readNumber(firstPage.body, "limit"), 10);
  expectTrue(
    "discovery: the total is a number",
    typeof readNumber(firstPage.body, "total") === "number",
    firstPage.body,
  );

  const items = readItems(firstPage.body);
  const itemIds = items.map((item) => readString(item, "userId"));

  expectTrue(
    "discovery: every row is a student profile",
    items.every((item) => typeof readString(item, "username") === "string"),
    items,
  );
  expectTrue(
    "discovery: the reader is never listed",
    !itemIds.includes(reader.userId),
    itemIds,
  );
  expectTrue(
    "discovery: other students are listed",
    others.every((other) => itemIds.includes(other.userId)),
    { expected: others.map((other) => other.userId), itemIds },
  );

  const invalidPage = await api("GET", "/student-profiles?page=0&limit=5", {
    token: reader.accessToken,
  });
  expectError(
    "discovery: a zero page is a bad request",
    invalidPage,
    400,
    INVALID_PAGINATION_MESSAGE,
  );

  const invalidLimit = await api("GET", "/student-profiles?limit=abc", {
    token: reader.accessToken,
  });
  expectError(
    "discovery: a non-numeric limit is a bad request",
    invalidLimit,
    400,
    INVALID_PAGINATION_MESSAGE,
  );

  const pageOne = await api("GET", "/student-profiles?page=1&limit=1", {
    token: reader.accessToken,
  });
  const pageTwo = await api("GET", "/student-profiles?page=2&limit=1", {
    token: reader.accessToken,
  });

  expectEqual("discovery: a page holds the requested size", readItems(pageOne.body).length, 1);
  expectTrue(
    "discovery: the directory has more than one page",
    (readNumber(pageOne.body, "totalPages") ?? 0) >= 2,
    pageOne.body,
  );
  expectTrue(
    "discovery: the second page is a different student",
    readString(readItems(pageOne.body)[0], "userId") !==
      readString(readItems(pageTwo.body)[0], "userId"),
    { pageOne: pageOne.body, pageTwo: pageTwo.body },
  );
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

/**
 * The relationship rules, with the acting student always coming from the token.
 *
 * The central check is that a bearer token beats the body: an authenticated
 * caller cannot send, accept or block as somebody else, and a body `requesterId`
 * or `actorId` is ignored the moment a token is present.
 */
async function runConnectionSecurityChecks(
  a: Account,
  b: Account,
  c: Account,
): Promise<void> {
  console.log("\n--- connections: sending and identity ---");

  const created = await api("POST", "/connections", {
    token: a.accessToken,
    body: { receiverId: b.userId },
  });

  expectStatus("connections: A can send a request to B", created, 201);
  expectEqual("connections: the requester is the token holder", readString(created.body, "requesterId"), a.userId);
  expectEqual("connections: the receiver is the target", readString(created.body, "receiverId"), b.userId);
  expectEqual("connections: a new request starts pending", readString(created.body, "status"), CONNECTION_STATUSES.PENDING);

  const abId = readString(created.body, "id");

  if (!abId) {
    throw new Error("connections: the created request had no id");
  }

  const spoofed = await api("POST", "/connections", {
    token: a.accessToken,
    body: { requesterId: b.userId, receiverId: c.userId },
  });

  expectStatus("connections: a spoofed requesterId still creates a request", spoofed, 201);
  expectEqual("connections: the authenticated actor wins over the body requesterId", readString(spoofed.body, "requesterId"), a.userId);
  expectTrue(
    "connections: the spoofed requester does not become the requester",
    readString(spoofed.body, "requesterId") !== b.userId,
    spoofed.body,
  );
  expectEqual("connections: only the receiver from the body is honoured", readString(spoofed.body, "receiverId"), c.userId);

  const duplicate = await api("POST", "/connections", {
    token: a.accessToken,
    body: { receiverId: b.userId },
  });
  expectError("connections: a duplicate request is refused", duplicate, 409, "A connection request is already pending");

  const reverse = await api("POST", "/connections", {
    token: b.accessToken,
    body: { receiverId: a.userId },
  });
  expectError("connections: the other side cannot also request", reverse, 409, "This student has already sent a connection request");

  const self = await api("POST", "/connections", {
    token: a.accessToken,
    body: { receiverId: a.userId },
  });
  expectError("connections: a student cannot connect with themselves", self, 400, "A student cannot connect with themselves");

  const unknown = await api("POST", "/connections", {
    token: a.accessToken,
    body: { receiverId: crypto.randomUUID() },
  });
  expectError("connections: an unknown target is a not-found", unknown, 404, "Student profile not found");

  console.log("\n--- connections: accepting and identity ---");

  const outsiderAccept = await api("PATCH", `/connections/${abId}/accept`, {
    token: c.accessToken,
  });
  expectError("connections: a non-participant cannot accept", outsiderAccept, 403, "Only connection participants can perform this action");

  const requesterAccept = await api("PATCH", `/connections/${abId}/accept`, {
    token: a.accessToken,
  });
  expectError("connections: the requester cannot accept their own request", requesterAccept, 403, "Only the recipient can accept this connection request");

  const spoofedActorAccept = await api("PATCH", `/connections/${abId}/accept`, {
    token: a.accessToken,
    body: { actorId: b.userId },
  });
  expectError(
    "connections: a body actorId cannot make the requester the recipient",
    spoofedActorAccept,
    403,
    "Only the recipient can accept this connection request",
  );

  const accepted = await api("PATCH", `/connections/${abId}/accept`, {
    token: b.accessToken,
  });
  expectStatus("connections: the recipient can accept", accepted, 200);
  expectEqual("connections: the connection is now accepted", readString(accepted.body, "status"), CONNECTION_STATUSES.ACCEPTED);
  expectEqual("connections: the accepted connection keeps A as requester", readString(accepted.body, "requesterId"), a.userId);
  expectEqual("connections: the accepted connection keeps B as receiver", readString(accepted.body, "receiverId"), b.userId);

  const acceptedList = await api(
    "GET",
    `/student-profiles/${a.userId}/connections?status=${CONNECTION_STATUSES.ACCEPTED}`,
    { token: a.accessToken },
  );
  expectStatus("connections: A can list its accepted connections", acceptedList, 200);
  expectTrue(
    "connections: the accepted connection appears in A's list",
    asArray(acceptedList.body).some((row) => readString(row, "id") === abId),
    acceptedList.body,
  );

  console.log("\n--- connections: another user's request is untouchable ---");

  const cbId = await createRequest("connections: C requests B", c, b.userId);
  const foreignAccept = await api("PATCH", `/connections/${cbId}/accept`, {
    token: a.accessToken,
  });
  expectError("connections: A cannot accept a request between C and B", foreignAccept, 403, "Only connection participants can perform this action");
}

/**
 * Removes every row this run created.
 *
 * Deleting the users cascades to their student profiles and, through them, to
 * every connection the run made, so one delete leaves the database exactly as it
 * was found. Rows are matched by the run's email prefix, so nothing a student
 * actually owns is ever touched.
 */
async function cleanup(): Promise<number> {
  console.log("\n--- cleanup ---");

  try {
    const result = await prisma.user.deleteMany({
      where: { email: { startsWith: RUN_PREFIX } },
    });

    return result.count;
  } catch (error) {
    console.error("cleanup: could not remove the run's users", error);
    process.exitCode = 1;

    return 0;
  }
}

async function main(): Promise<void> {
  const baseline = {
    users: await prisma.user.count(),
    profiles: await prisma.studentProfile.count(),
    connections: await prisma.connection.count(),
  };

  try {
    const a = await createStudent("a");
    const b = await createStudent("b");
    const c = await createStudent("c");

    await runDiscoveryChecks(a, [b, c]);
    await runConnectionSecurityChecks(a, b, c);
  } finally {
    await cleanup();

    const after = {
      users: await prisma.user.count(),
      profiles: await prisma.studentProfile.count(),
      connections: await prisma.connection.count(),
    };

    expectEqual("cleanup: user count is back to baseline", after.users, baseline.users);
    expectEqual("cleanup: profile count is back to baseline", after.profiles, baseline.profiles);
    expectEqual("cleanup: connection count is back to baseline", after.connections, baseline.connections);
  }

  const passed = checkCount - failures.length;

  console.log(`\n${passed}/${checkCount} checks passed`);

  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of failures) {
      console.log(`  - ${failure}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log("All connection + discovery smoke checks passed.");
}

main()
  .catch((error) => {
    console.error("\nSmoke run failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
