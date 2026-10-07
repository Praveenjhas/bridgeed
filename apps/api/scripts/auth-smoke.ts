/**
 * BridgeEd authentication live smoke test.
 *
 * Usage:
 *   1. Make sure PostgreSQL is running and the API is serving
 *      (`npm run dev --workspace=apps/api` or `npx tsx src/server.ts`).
 *   2. Run `npm run smoke:auth --workspace=apps/api`
 *
 * Optional environment variables:
 *   API_BASE_URL (default http://localhost:4000)
 *
 * The script reaches into the database for the few states the API deliberately
 * cannot produce — a suspended account, a soft-deleted account, a bumped
 * password timestamp — so it imports the Prisma client directly. Every account
 * it creates carries this run's id in its address and is deleted again in the
 * cleanup step, even when a check fails; nothing that was already in the
 * database is read for anything other than a count.
 */
import { createHash, createHmac, randomUUID } from "node:crypto";
import { USER_ROLES } from "@bridgeed/shared/src/constants/roles";
import { USER_STATUSES } from "@bridgeed/shared/src/constants/user-statuses";
import { authConfig } from "../src/config/auth";
import { prisma } from "../src/config/prisma";
import {
  AUTH_CREDENTIALS_REQUIRED_MESSAGE,
  AUTH_REFRESH_TOKEN_REQUIRED_MESSAGE,
} from "../src/controllers/auth.controller";
import { AUTH_AUTHENTICATION_REQUIRED_MESSAGE } from "../src/middleware/require-auth";
import {
  AUTH_ACCOUNT_INACTIVE_MESSAGE,
  AUTH_INVALID_CREDENTIALS_MESSAGE,
  AUTH_INVALID_REFRESH_TOKEN_MESSAGE,
  AUTH_REFRESH_TOKEN_REUSED_MESSAGE,
  AUTH_SESSION_INVALID_MESSAGE,
} from "../src/services/auth.service";
import {
  USER_EMAIL_INVALID_MESSAGE,
  USER_EMAIL_TAKEN_MESSAGE,
} from "../src/services/user.services";
import {
  PASSWORD_LENGTH_INVALID_MESSAGE,
  PASSWORD_MATCHES_EMAIL_MESSAGE,
  PASSWORD_TOO_COMMON_MESSAGE,
} from "../src/utils/password-policy";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const API_PREFIX = "/api/v1";

const RUN_ID = `authsmk${Date.now().toString(36)}${Math.random()
  .toString(36)
  .slice(2, 7)}`;

/**
 * A password that satisfies the policy and is not on the blocklist. It is not
 * derived from the address, so it also proves the "password must not be the
 * email" rule is a real rule rather than the only thing being checked.
 */
const VALID_PASSWORD = "Smoke-Verifier-9f3a-Qz";

interface ApiResult {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

interface SmokeState {
  /** Accounts this run created, so cleanup can delete exactly those. */
  createdUserIds: string[];
}

interface BaselineCounts {
  users: number;
  profiles: number;
  sessions: number;
  communities: number;
  posts: number;
  comments: number;
  connections: number;
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

function readString(source: unknown, key: string): string | null {
  const value = asRecord(source)[key];

  return typeof value === "string" ? value : null;
}

function smokeEmail(label: string): string {
  return `${RUN_ID}-${label}@bridgeed-smoke.test`;
}

interface ApiOptions {
  body?: unknown;
  /** Convenience for `Authorization: Bearer <token>`. */
  token?: string;
  /** A raw Authorization header, for the malformed-header checks. */
  authorization?: string;
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

  if (options.authorization !== undefined) {
    headers["Authorization"] = options.authorization;
  } else if (options.token !== undefined) {
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

  const collected: Record<string, string> = {};

  response.headers.forEach((value, key) => {
    collected[key.toLowerCase()] = value;
  });

  return { status: response.status, body, headers: collected };
}

/** The claims a probe token carries; every field is overridable. */
interface TokenProbeInput {
  sub: string;
  sid: string;
  role?: string;
  iss?: string;
  aud?: string;
  alg?: string;
  typ?: string;
  iat?: number;
  exp?: number;
  /** Signing key, so a token signed with the wrong one can be produced. */
  secret?: string;
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

/**
 * Mints an HS256 token so the guard can be probed with exactly the token we want
 * — wrong issuer, wrong audience, wrong algorithm, expired, or signed with a key
 * that is not the server's. Well-formed tokens always come from the API itself.
 */
function mintAccessToken(input: TokenProbeInput): string {
  const now = Math.floor(Date.now() / 1000);

  const signingInput = `${base64UrlJson({
    alg: input.alg ?? "HS256",
    typ: input.typ ?? "JWT",
  })}.${base64UrlJson({
    sub: input.sub,
    sid: input.sid,
    role: input.role ?? USER_ROLES.USER,
    iat: input.iat ?? now,
    exp: input.exp ?? now + 900,
    iss: input.iss ?? authConfig.jwtIssuer,
    aud: input.aud ?? authConfig.jwtAudience,
    jti: `smoke-${RUN_ID}`,
  })}`;

  const signature = createHmac("sha256", input.secret ?? authConfig.jwtSecret)
    .update(signingInput, "utf8")
    .digest("base64url");

  return `${signingInput}.${signature}`;
}

/** Reads a token's claims without verifying it, so a check can name them. */
function readClaims(token: string): Record<string, unknown> {
  const segment = token.split(".")[1];

  if (segment === undefined) {
    return {};
  }

  try {
    return asRecord(
      JSON.parse(Buffer.from(segment, "base64url").toString("utf8")),
    );
  } catch {
    return {};
  }
}

interface SessionTokens {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  /** What the access token itself claims the account's role is. */
  tokenRole: string | null;
}

/** Pulls the pieces a check needs out of a register/login/refresh response. */
function readSession(body: unknown, label: string): SessionTokens {
  const user = asRecord(asRecord(body)["user"]);
  const accessToken = readString(body, "accessToken");
  const refreshToken = readString(body, "refreshToken");
  const userId = readString(user, "id");

  if (!accessToken || !refreshToken || !userId) {
    throw new Error(`${label}: response did not contain a usable session`);
  }

  const claims = readClaims(accessToken);

  return {
    userId,
    email: readString(user, "email") ?? "",
    accessToken,
    refreshToken,
    sessionId: typeof claims["sid"] === "string" ? claims["sid"] : "",
    tokenRole: typeof claims["role"] === "string" ? claims["role"] : null,
  };
}

/** Records an account so cleanup deletes it even when a later check throws. */
function remember(state: SmokeState, userId: string): void {
  if (!state.createdUserIds.includes(userId)) {
    state.createdUserIds.push(userId);
  }
}

/** Registers a fresh account and returns its session. */
async function registerAccount(
  state: SmokeState,
  label: string,
  password: string = VALID_PASSWORD,
): Promise<SessionTokens> {
  const email = smokeEmail(label);
  const result = await api("POST", "/auth/register", {
    body: { email, password },
  });

  expectStatus(`setup: register ${label}`, result, 201);

  const session = readSession(result.body, `setup: register ${label}`);

  remember(state, session.userId);

  return session;
}

/** Signs an existing account in. */
async function loginAccount(
  email: string,
  password: string = VALID_PASSWORD,
): Promise<ApiResult> {
  return api("POST", "/auth/login", { body: { email, password } });
}

type DatabaseStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

/** Database writes for the states the API has no endpoint for. */
async function setUserStatus(
  userId: string,
  status: DatabaseStatus,
): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { status } });
}

async function setUserRole(
  userId: string,
  role: "USER" | "ADMIN",
): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { role } });
}

async function setPasswordUpdatedAt(userId: string, when: Date): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { passwordUpdatedAt: when, updatedAt: new Date() },
  });
}

async function countActiveSessions(userId: string): Promise<number> {
  return prisma.session.count({ where: { userId, revokedAt: null } });
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Registration: what it creates, what it leaks, and what it refuses. */
async function runRegistrationChecks(state: SmokeState): Promise<void> {
  console.log("\n--- registration ---");

  const email = smokeEmail("primary");
  const result = await api("POST", "/auth/register", {
    body: { email, password: VALID_PASSWORD },
  });

  expectStatus("register: succeeds", result, 201);

  const session = readSession(result.body, "register");
  const returnedUser = asRecord(asRecord(result.body)["user"]);

  remember(state, session.userId);

  expectEqual(
    "register: the response exposes only safe user fields",
    Object.keys(returnedUser).sort().join(","),
    "email,id,role,status",
  );
  expectEqual(
    "register: the response role is the wire spelling",
    returnedUser["role"],
    USER_ROLES.USER,
  );
  expectEqual(
    "register: the response status is the wire spelling",
    returnedUser["status"],
    USER_STATUSES.ACTIVE,
  );
  expectEqual(
    "register: the response email is the normalized address",
    returnedUser["email"],
    email,
  );
  expectTrue(
    "register: the access token is a three-segment JWT",
    session.accessToken.split(".").length === 3,
  );
  expectTrue(
    "register: the refresh token is opaque",
    !session.refreshToken.includes(".") && session.refreshToken.length >= 32,
  );
  expectEqual(
    "register: the access token names the account",
    readClaims(session.accessToken)["sub"],
    session.userId,
  );
  expectTrue(
    "register: the access token names a session",
    session.sessionId.length > 0,
  );
  expectEqual(
    "register: the access token carries the wire role",
    session.tokenRole,
    USER_ROLES.USER,
  );
  expectEqual(
    "register: the access token carries the configured issuer",
    readClaims(session.accessToken)["iss"],
    authConfig.jwtIssuer,
  );
  expectEqual(
    "register: the access token carries the configured audience",
    readClaims(session.accessToken)["aud"],
    authConfig.jwtAudience,
  );

  const serialized = JSON.stringify(result.body);

  expectTrue(
    "register: the response never contains a password hash",
    !serialized.includes("passwordHash"),
  );
  expectTrue(
    "register: the response never contains session internals",
    !serialized.includes("refreshTokenHash") &&
      !serialized.includes("familyId"),
  );

  const row = await prisma.user.findUnique({ where: { id: session.userId } });

  expectTrue("register: the account row exists", row !== null);
  expectEqual(
    "register: the stored role is the database spelling",
    row?.role,
    "USER",
  );
  expectEqual("register: the account starts active", row?.status, "ACTIVE");
  expectTrue(
    "register: the password is stored as a scrypt digest",
    (row?.passwordHash ?? "").startsWith("scrypt$"),
  );
  expectTrue(
    "register: the password is never stored in clear",
    row?.passwordHash !== null && row?.passwordHash !== VALID_PASSWORD,
  );
  expectTrue(
    "register: the password timestamp is recorded",
    row?.passwordUpdatedAt instanceof Date,
  );

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.userId },
  });

  expectEqual("register: no student profile is created", profile, null);
  expectEqual(
    "register: exactly one session is opened",
    await countActiveSessions(session.userId),
    1,
  );

  const sessionRow = await prisma.session.findUnique({
    where: { id: session.sessionId },
  });

  expectTrue(
    "register: the raw refresh token is not stored",
    sessionRow?.refreshTokenHash !== session.refreshToken,
  );
  expectEqual(
    "register: only the SHA-256 digest of the refresh token is stored",
    sessionRow?.refreshTokenHash,
    sha256Hex(session.refreshToken),
  );
  expectEqual(
    "register: the session starts unrevoked",
    sessionRow?.revokedAt,
    null,
  );
}

/** The duplicate, normalization and password-policy rules. */
async function runRegistrationValidationChecks(): Promise<void> {
  console.log("\n--- registration validation ---");

  const duplicate = await api("POST", "/auth/register", {
    body: { email: smokeEmail("primary"), password: VALID_PASSWORD },
  });

  expectError(
    "register: a duplicate address is refused",
    duplicate,
    409,
    USER_EMAIL_TAKEN_MESSAGE,
  );
  expectEqual(
    "register: the conflict response carries nothing but the error",
    Object.keys(asRecord(duplicate.body)).join(","),
    "error",
  );

  const normalized = `${RUN_ID}-mixed@bridgeed-smoke.test`;
  const mixed = await api("POST", "/auth/register", {
    body: {
      email: `  ${RUN_ID}-MiXeD@BridgeEd-Smoke.Test  `,
      password: VALID_PASSWORD,
    },
  });

  expectStatus("register: a padded, mixed-case address is accepted", mixed, 201);

  const mixedSession = readSession(mixed.body, "register: normalized");

  expectEqual(
    "register: the response echoes the normalized address",
    asRecord(asRecord(mixed.body)["user"])["email"],
    normalized,
  );
  expectEqual(
    "register: the stored row uses the normalized address",
    (await prisma.user.findUnique({ where: { id: mixedSession.userId } }))
      ?.email,
    normalized,
  );

  const mixedLogin = await loginAccount(
    `  ${RUN_ID}-MIXED@BRIDGEED-SMOKE.TEST `,
  );

  expectStatus("register: normalization lets any casing sign in", mixedLogin, 200);
  expectEqual(
    "register: normalization signs in as the same account",
    readString(asRecord(mixedLogin.body)["user"], "id"),
    mixedSession.userId,
  );

  const malformed = await api("POST", "/auth/register", {
    body: { email: "not-an-address", password: VALID_PASSWORD },
  });
  expectError(
    "register: a syntactically invalid address is refused",
    malformed,
    400,
    USER_EMAIL_INVALID_MESSAGE,
  );

  const missingEmail = await api("POST", "/auth/register", {
    body: { password: VALID_PASSWORD },
  });
  expectError(
    "register: a missing email is a malformed request",
    missingEmail,
    400,
    AUTH_CREDENTIALS_REQUIRED_MESSAGE,
  );

  const shortPassword = await api("POST", "/auth/register", {
    body: { email: smokeEmail("short"), password: "short-pass" },
  });
  expectError(
    "register: a password below the minimum length is refused",
    shortPassword,
    400,
    PASSWORD_LENGTH_INVALID_MESSAGE,
  );

  const longPassword = await api("POST", "/auth/register", {
    body: { email: smokeEmail("long"), password: "a".repeat(129) },
  });
  expectError(
    "register: a password above the maximum length is refused",
    longPassword,
    400,
    PASSWORD_LENGTH_INVALID_MESSAGE,
  );

  const emailAsPassword = smokeEmail("password-is-email");
  const sameAsEmail = await api("POST", "/auth/register", {
    body: { email: emailAsPassword, password: emailAsPassword },
  });
  expectError(
    "register: a password equal to the address is refused",
    sameAsEmail,
    400,
    PASSWORD_MATCHES_EMAIL_MESSAGE,
  );

  const common = await api("POST", "/auth/register", {
    body: { email: smokeEmail("common"), password: "password1234" },
  });
  expectError(
    "register: a widely tried password is refused",
    common,
    400,
    PASSWORD_TOO_COMMON_MESSAGE,
  );

  const nonString = await api("POST", "/auth/register", {
    body: { email: smokeEmail("non-string"), password: 123456789012 },
  });
  expectError(
    "register: a non-string password is a malformed request",
    nonString,
    400,
    AUTH_CREDENTIALS_REQUIRED_MESSAGE,
  );
}

/** The role a client is allowed to ask for, in both spellings. */
async function runRegistrationRoleChecks(): Promise<void> {
  console.log("\n--- registration cannot select a role ---");

  const wireSpelling = await api("POST", "/auth/register", {
    body: {
      email: smokeEmail("admin-wire"),
      password: VALID_PASSWORD,
      role: USER_ROLES.ADMIN,
    },
  });

  expectStatus(
    "register: a wire-spelled admin request is still accepted",
    wireSpelling,
    201,
  );
  expectEqual(
    "register: the wire-spelled admin request produced an ordinary user",
    asRecord(asRecord(wireSpelling.body)["user"])["role"],
    USER_ROLES.USER,
  );

  const wireRow = await prisma.user.findUnique({
    where: { id: readSession(wireSpelling.body, "register: admin").userId },
  });

  expectEqual(
    "register: no administrator row was written for the wire spelling",
    wireRow?.role,
    "USER",
  );

  const databaseSpelling = await api("POST", "/auth/register", {
    body: {
      email: smokeEmail("admin-db"),
      password: VALID_PASSWORD,
      role: "ADMIN",
    },
  });

  expectStatus(
    "register: a database-spelled admin request is still accepted",
    databaseSpelling,
    201,
  );

  const databaseRow = await prisma.user.findUnique({
    where: {
      id: readSession(databaseSpelling.body, "register: admin db").userId,
    },
  });

  expectEqual(
    "register: no administrator row was written for the database spelling",
    databaseRow?.role,
    "USER",
  );
}

/** Sign-in: success, and the one failure every credential problem shares. */
async function runLoginChecks(state: SmokeState): Promise<void> {
  console.log("\n--- login ---");

  const email = smokeEmail("login");
  const registered = await registerAccount(state, "login");
  const loginResult = await loginAccount(email);

  expectStatus("login: succeeds", loginResult, 200);

  const session = readSession(loginResult.body, "login");
  const returnedUser = asRecord(asRecord(loginResult.body)["user"]);

  expectEqual(
    "login: the same account signs in",
    session.userId,
    registered.userId,
  );
  expectEqual(
    "login: the response role is the wire spelling",
    returnedUser["role"],
    USER_ROLES.USER,
  );
  expectEqual(
    "login: the response status is the wire spelling",
    returnedUser["status"],
    USER_STATUSES.ACTIVE,
  );
  expectTrue(
    "login: a fresh access token is issued",
    session.accessToken !== registered.accessToken,
  );
  expectTrue(
    "login: a fresh refresh token is issued",
    session.refreshToken !== registered.refreshToken,
  );
  expectTrue(
    "login: a fresh session is opened",
    session.sessionId !== registered.sessionId,
  );
  expectEqual(
    "login: the account now has two active sessions",
    await countActiveSessions(session.userId),
    2,
  );

  const loginRow = await prisma.session.findUnique({
    where: { id: session.sessionId },
  });
  const registerRow = await prisma.session.findUnique({
    where: { id: registered.sessionId },
  });

  expectTrue(
    "login: the new session starts a family of its own",
    loginRow !== null && loginRow.familyId !== registerRow?.familyId,
  );

  const wrongPassword = await loginAccount(email, "Smoke-Verifier-0000-Zz");

  expectError(
    "login: a wrong password is refused",
    wrongPassword,
    401,
    AUTH_INVALID_CREDENTIALS_MESSAGE,
  );

  const unknownEmail = await loginAccount(smokeEmail("never-registered"));

  expectError(
    "login: an unregistered address is refused the same way",
    unknownEmail,
    401,
    AUTH_INVALID_CREDENTIALS_MESSAGE,
  );
  expectEqual(
    "login: a wrong password and an unknown address are indistinguishable",
    unknownEmail.status === wrongPassword.status &&
      asRecord(unknownEmail.body)["error"] ===
        asRecord(wrongPassword.body)["error"],
    true,
  );

  const malformedEmail = await loginAccount("not-an-address");

  expectError(
    "login: a syntactically invalid address is refused the same way",
    malformedEmail,
    401,
    AUTH_INVALID_CREDENTIALS_MESSAGE,
  );

  const missingPassword = await api("POST", "/auth/login", {
    body: { email },
  });

  expectError(
    "login: a missing password is a malformed request",
    missingPassword,
    400,
    AUTH_CREDENTIALS_REQUIRED_MESSAGE,
  );
  expectTrue(
    "login: a failed sign-in never leaks a password hash",
    !JSON.stringify(wrongPassword.body).includes("passwordHash"),
  );
}

/** The guard: every way an access token can be refused. */
async function runGuardChecks(state: SmokeState): Promise<void> {
  console.log("\n--- authenticated route guard ---");

  const session = await registerAccount(state, "guard");

  const me = await api("GET", "/auth/me", { token: session.accessToken });

  expectStatus("guard: /auth/me succeeds with a valid token", me, 200);
  expectEqual(
    "guard: /auth/me returns the authenticated account",
    readString(me.body, "id"),
    session.userId,
  );
  expectEqual(
    "guard: /auth/me returns only safe fields",
    Object.keys(asRecord(me.body)).sort().join(","),
    "email,id,role,status",
  );
  expectEqual(
    "guard: /auth/me returns the wire role",
    readString(me.body, "role"),
    USER_ROLES.USER,
  );
  expectEqual(
    "guard: /auth/me returns the wire status",
    readString(me.body, "status"),
    USER_STATUSES.ACTIVE,
  );

  const noHeader = await api("GET", "/auth/me");

  expectError(
    "guard: /auth/me refuses a missing header",
    noHeader,
    401,
    AUTH_AUTHENTICATION_REQUIRED_MESSAGE,
  );

  const wrongScheme = await api("GET", "/auth/me", {
    authorization: `Token ${session.accessToken}`,
  });

  expectError(
    "guard: /auth/me refuses a non-bearer scheme",
    wrongScheme,
    401,
    AUTH_AUTHENTICATION_REQUIRED_MESSAGE,
  );

  const emptyCredential = await api("GET", "/auth/me", {
    authorization: "Bearer",
  });

  expectError(
    "guard: /auth/me refuses an empty bearer credential",
    emptyCredential,
    401,
    AUTH_AUTHENTICATION_REQUIRED_MESSAGE,
  );

  const badSignature = await api("GET", "/auth/me", {
    token: mintAccessToken({
      sub: session.userId,
      sid: session.sessionId,
      secret: "not-the-server-signing-key-0000",
    }),
  });

  expectError(
    "guard: /auth/me refuses a token signed with the wrong key",
    badSignature,
    401,
    AUTH_AUTHENTICATION_REQUIRED_MESSAGE,
  );

  const wrongIssuer = await api("GET", "/auth/me", {
    token: mintAccessToken({
      sub: session.userId,
      sid: session.sessionId,
      iss: "another-service",
    }),
  });

  expectError(
    "guard: /auth/me refuses a token from another issuer",
    wrongIssuer,
    401,
    AUTH_AUTHENTICATION_REQUIRED_MESSAGE,
  );

  const wrongAudience = await api("GET", "/auth/me", {
    token: mintAccessToken({
      sub: session.userId,
      sid: session.sessionId,
      aud: "another-app",
    }),
  });

  expectError(
    "guard: /auth/me refuses a token for another audience",
    wrongAudience,
    401,
    AUTH_AUTHENTICATION_REQUIRED_MESSAGE,
  );

  const wrongAlgorithm = await api("GET", "/auth/me", {
    token: mintAccessToken({
      sub: session.userId,
      sid: session.sessionId,
      alg: "HS512",
    }),
  });

  expectError(
    "guard: /auth/me refuses a token signed with another algorithm",
    wrongAlgorithm,
    401,
    AUTH_AUTHENTICATION_REQUIRED_MESSAGE,
  );

  const wrongType = await api("GET", "/auth/me", {
    token: mintAccessToken({
      sub: session.userId,
      sid: session.sessionId,
      typ: "at+jwt",
    }),
  });

  expectError(
    "guard: /auth/me refuses a token that does not declare the JWT type",
    wrongType,
    401,
    AUTH_AUTHENTICATION_REQUIRED_MESSAGE,
  );

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expired = await api("GET", "/auth/me", {
    token: mintAccessToken({
      sub: session.userId,
      sid: session.sessionId,
      iat: nowSeconds - 7200,
      exp: nowSeconds - 3600,
    }),
  });

  expectError(
    "guard: /auth/me refuses an expired token",
    expired,
    401,
    AUTH_AUTHENTICATION_REQUIRED_MESSAGE,
  );

  const unknownSession = await api("GET", "/auth/me", {
    token: mintAccessToken({ sub: session.userId, sid: randomUUID() }),
  });

  expectError(
    "guard: /auth/me refuses a token naming an unknown session",
    unknownSession,
    401,
    AUTH_SESSION_INVALID_MESSAGE,
  );

  const otherAccount = await registerAccount(state, "guard-other");
  const swappedSubject = await api("GET", "/auth/me", {
    token: mintAccessToken({
      sub: otherAccount.userId,
      sid: session.sessionId,
    }),
  });

  expectError(
    "guard: /auth/me refuses a token whose subject is not the session owner",
    swappedSubject,
    401,
    AUTH_SESSION_INVALID_MESSAGE,
  );

  const malformedToken = await api("GET", "/auth/me", { token: "not.a.token" });

  expectError(
    "guard: /auth/me refuses a malformed token",
    malformedToken,
    401,
    AUTH_AUTHENTICATION_REQUIRED_MESSAGE,
  );

  await prisma.session.update({
    where: { id: session.sessionId },
    data: { revokedAt: new Date(), updatedAt: new Date() },
  });

  const afterRevoke = await api("GET", "/auth/me", {
    token: session.accessToken,
  });

  expectError(
    "guard: /auth/me refuses an access token whose session was revoked",
    afterRevoke,
    401,
    AUTH_SESSION_INVALID_MESSAGE,
  );
}

/**
 * Rotation and reuse detection.
 *
 * The checks run over two independent sign-ins on purpose. A replay retires the
 * whole family, so proving "the successor still works" and "the rotated-away
 * token is refused" on a single chain would contradict itself: the first replay
 * would already have retired the successor.
 */
async function runRefreshChecks(state: SmokeState): Promise<void> {
  console.log("\n--- refresh rotation and reuse ---");

  const chainA = await registerAccount(state, "refresh-a");
  const rotated = await api("POST", "/auth/refresh", {
    body: { refreshToken: chainA.refreshToken },
  });

  expectStatus("refresh: succeeds", rotated, 200);

  const successor = readSession(rotated.body, "refresh");
  const oldRow = await prisma.session.findUnique({
    where: { id: chainA.sessionId },
  });
  const newRow = await prisma.session.findUnique({
    where: { id: successor.sessionId },
  });

  expectTrue(
    "refresh: rotates onto a different session",
    successor.sessionId !== chainA.sessionId,
  );
  expectTrue(
    "refresh: issues a different refresh token",
    successor.refreshToken !== chainA.refreshToken,
  );
  expectTrue(
    "refresh: issues a different access token",
    successor.accessToken !== chainA.accessToken,
  );
  expectEqual(
    "refresh: continues the same family",
    newRow?.familyId,
    oldRow?.familyId,
  );
  expectEqual("refresh: keeps the same account", newRow?.userId, chainA.userId);
  expectTrue(
    "refresh: revokes the session that was rotated away",
    oldRow?.revokedAt instanceof Date,
  );
  expectEqual(
    "refresh: stores only the digest of the new token",
    newRow?.refreshTokenHash,
    sha256Hex(successor.refreshToken),
  );
  expectEqual(
    "refresh: exactly one session of the chain stays active",
    await countActiveSessions(chainA.userId),
    1,
  );

  const replay = await api("POST", "/auth/refresh", {
    body: { refreshToken: chainA.refreshToken },
  });

  expectError(
    "refresh: replaying a rotated-away token is refused",
    replay,
    401,
    AUTH_REFRESH_TOKEN_REUSED_MESSAGE,
  );
  expectEqual(
    "refresh: a replay retires the whole family",
    await countActiveSessions(chainA.userId),
    0,
  );

  const successorAfterReplay = await api("POST", "/auth/refresh", {
    body: { refreshToken: successor.refreshToken },
  });

  expectError(
    "refresh: the successor is dead once its family is retired",
    successorAfterReplay,
    401,
    AUTH_REFRESH_TOKEN_REUSED_MESSAGE,
  );

  const activeInFamily = await prisma.session.count({
    where: { familyId: oldRow?.familyId ?? "", revokedAt: null },
  });

  expectEqual("refresh: no session of the retired family is active", activeInFamily, 0);

  const chainB = await registerAccount(state, "refresh-b");
  const firstRotation = await api("POST", "/auth/refresh", {
    body: { refreshToken: chainB.refreshToken },
  });

  expectStatus("refresh: a fresh chain rotates", firstRotation, 200);

  const usable = readSession(firstRotation.body, "refresh: chain b");
  const secondRotation = await api("POST", "/auth/refresh", {
    body: { refreshToken: usable.refreshToken },
  });

  expectStatus("refresh: the new refresh token works", secondRotation, 200);

  const afterSecond = readSession(secondRotation.body, "refresh: chain b twice");

  expectEqual(
    "refresh: repeated rotation still leaves one active session",
    await countActiveSessions(chainB.userId),
    1,
  );

  const meAfterSecond = await api("GET", "/auth/me", {
    token: afterSecond.accessToken,
  });

  expectStatus(
    "refresh: the access token from the new rotation is accepted",
    meAfterSecond,
    200,
  );

  const earlyReplay = await api("POST", "/auth/refresh", {
    body: { refreshToken: chainB.refreshToken },
  });

  expectError(
    "refresh: replaying the first token of a chain is refused",
    earlyReplay,
    401,
    AUTH_REFRESH_TOKEN_REUSED_MESSAGE,
  );
  expectEqual(
    "refresh: that replay retires the rest of the chain",
    await countActiveSessions(chainB.userId),
    0,
  );

  const missingToken = await api("POST", "/auth/refresh", { body: {} });

  expectError(
    "refresh: a missing refresh token is a malformed request",
    missingToken,
    400,
    AUTH_REFRESH_TOKEN_REQUIRED_MESSAGE,
  );

  const unknownToken = await api("POST", "/auth/refresh", {
    body: { refreshToken: randomUUID() },
  });

  expectError(
    "refresh: an unknown refresh token is refused",
    unknownToken,
    401,
    AUTH_INVALID_REFRESH_TOKEN_MESSAGE,
  );
}

/** Signing one session out, and signing them all out. */
async function runLogoutChecks(state: SmokeState): Promise<void> {
  console.log("\n--- logout ---");

  const account = await registerAccount(state, "logout");
  const secondLogin = await loginAccount(account.email);

  expectStatus("logout: a second device signs in", secondLogin, 200);

  const second = readSession(secondLogin.body, "logout: second session");

  expectEqual(
    "logout: the account has two active sessions",
    await countActiveSessions(account.userId),
    2,
  );

  const logout = await api("POST", "/auth/logout", {
    token: account.accessToken,
  });

  expectStatus("logout: succeeds", logout, 200);
  expectEqual(
    "logout: reports success",
    asRecord(logout.body)["success"],
    true,
  );
  expectEqual(
    "logout: revokes exactly the current session",
    asRecord(logout.body)["revokedSessions"],
    1,
  );
  expectEqual(
    "logout: one session is left",
    await countActiveSessions(account.userId),
    1,
  );

  const signedOutRow = await prisma.session.findUnique({
    where: { id: account.sessionId },
  });

  expectTrue(
    "logout: keeps the revoked row instead of deleting it",
    signedOutRow !== null && signedOutRow.revokedAt instanceof Date,
  );

  const meWithSignedOutToken = await api("GET", "/auth/me", {
    token: account.accessToken,
  });

  expectError(
    "logout: the signed-out access token stops working",
    meWithSignedOutToken,
    401,
    AUTH_SESSION_INVALID_MESSAGE,
  );

  const meWithOtherSession = await api("GET", "/auth/me", {
    token: second.accessToken,
  });

  expectStatus(
    "logout: the other device stays signed in",
    meWithOtherSession,
    200,
  );

  const secondLogout = await api("POST", "/auth/logout", {
    token: account.accessToken,
  });

  expectError(
    "logout: a signed-out session cannot sign out again",
    secondLogout,
    401,
    AUTH_SESSION_INVALID_MESSAGE,
  );

  const refreshAfterLogout = await api("POST", "/auth/refresh", {
    body: { refreshToken: account.refreshToken },
  });

  expectError(
    "logout: the signed-out refresh token cannot be reused",
    refreshAfterLogout,
    401,
    AUTH_REFRESH_TOKEN_REUSED_MESSAGE,
  );

  const logoutAll = await api("POST", "/auth/logout-all", {
    token: second.accessToken,
  });

  expectStatus("logout-all: succeeds", logoutAll, 200);
  expectEqual(
    "logout-all: reports the sessions it revoked",
    asRecord(logoutAll.body)["revokedSessions"],
    1,
  );
  expectEqual(
    "logout-all: every session of the account is retired",
    await countActiveSessions(account.userId),
    0,
  );

  const meAfterLogoutAll = await api("GET", "/auth/me", {
    token: second.accessToken,
  });

  expectError(
    "logout-all: the last access token stops working",
    meAfterLogoutAll,
    401,
    AUTH_SESSION_INVALID_MESSAGE,
  );

  const logoutUnauthenticated = await api("POST", "/auth/logout");

  expectError(
    "logout: refuses an unauthenticated request",
    logoutUnauthenticated,
    401,
    AUTH_AUTHENTICATION_REQUIRED_MESSAGE,
  );

  const logoutAllUnauthenticated = await api("POST", "/auth/logout-all");

  expectError(
    "logout-all: refuses an unauthenticated request",
    logoutAllUnauthenticated,
    401,
    AUTH_AUTHENTICATION_REQUIRED_MESSAGE,
  );
}

/** Role mapping: the wire spelling on the way out, the enum on the way in. */
async function runRoleMappingChecks(state: SmokeState): Promise<void> {
  console.log("\n--- role mapping ---");

  const account = await registerAccount(state, "role");
  const me = await api("GET", "/auth/me", { token: account.accessToken });

  expectEqual(
    "role: the database USER is reported as the wire role",
    readString(me.body, "role"),
    USER_ROLES.USER,
  );
  expectEqual(
    "role: the row holds the database spelling",
    (await prisma.user.findUnique({ where: { id: account.userId } }))?.role,
    "USER",
  );
  expectEqual(
    "role: the access token was minted with the wire role",
    account.tokenRole,
    USER_ROLES.USER,
  );

  await setUserRole(account.userId, "ADMIN");

  const promoted = await api("GET", "/auth/me", { token: account.accessToken });

  expectStatus("role: /auth/me still answers after a role change", promoted, 200);
  expectEqual(
    "role: the promoted database role is reported as the wire role",
    readString(promoted.body, "role"),
    USER_ROLES.ADMIN,
  );
  expectEqual(
    "role: the role is read from the row, not from the token",
    readClaims(account.accessToken)["role"],
    USER_ROLES.USER,
  );
}

/**
 * The authenticated identity comes from the verified token and nothing else: an
 * `actorId`, `userId` or `authorId` in the query string or the body must not be
 * able to point a guarded route at somebody else's account.
 */
async function runIdentityChecks(state: SmokeState): Promise<void> {
  console.log("\n--- authenticated identity ---");

  const other = await registerAccount(state, "identity-other");
  const caller = await registerAccount(state, "identity-caller");

  const smuggledQuery = `actorId=${other.userId}&userId=${other.userId}&authorId=${other.userId}`;

  const me = await api("GET", `/auth/me?${smuggledQuery}`, {
    token: caller.accessToken,
  });

  expectStatus(
    "identity: /auth/me still answers when identity fields are smuggled in the query",
    me,
    200,
  );
  expectEqual(
    "identity: /auth/me returns the token's account, not the query's",
    readString(me.body, "id"),
    caller.userId,
  );
  expectEqual(
    "identity: /auth/me never returns the smuggled account",
    readString(me.body, "id") === other.userId,
    false,
  );

  expectEqual(
    "identity: the other account starts with one active session",
    await countActiveSessions(other.userId),
    1,
  );

  const logoutAll = await api(
    "POST",
    `/auth/logout-all?${smuggledQuery}`,
    {
      token: caller.accessToken,
      body: {
        actorId: other.userId,
        userId: other.userId,
        authorId: other.userId,
      },
    },
  );

  expectStatus(
    "identity: logout-all answers while a foreign userId is supplied",
    logoutAll,
    200,
  );
  expectEqual(
    "identity: logout-all ignores the supplied userId",
    await countActiveSessions(other.userId),
    1,
  );
  expectEqual(
    "identity: logout-all revokes the caller's own sessions",
    await countActiveSessions(caller.userId),
    0,
  );

  const otherStillSignedIn = await api("GET", "/auth/me", {
    token: other.accessToken,
  });

  expectStatus(
    "identity: the other account is still signed in",
    otherStillSignedIn,
    200,
  );

  const callerSignedOut = await api("GET", "/auth/me", {
    token: caller.accessToken,
  });

  expectError(
    "identity: the caller's own access token is gone",
    callerSignedOut,
    401,
    AUTH_SESSION_INVALID_MESSAGE,
  );
}

/** Suspended, deleted and password-changed accounts. */
async function runAccountStateChecks(state: SmokeState): Promise<void> {
  console.log("\n--- account state ---");

  const suspended = await registerAccount(state, "suspended");
  const suspendedLogin = await loginAccount(suspended.email);

  expectStatus(
    "state: the account signs in before suspension",
    suspendedLogin,
    200,
  );

  const suspendedSession = readSession(suspendedLogin.body, "state: suspended");

  await setUserStatus(suspended.userId, "SUSPENDED");

  const suspendedMe = await api("GET", "/auth/me", {
    token: suspendedSession.accessToken,
  });

  expectError(
    "state: a suspended account cannot use an existing access token",
    suspendedMe,
    403,
    AUTH_ACCOUNT_INACTIVE_MESSAGE,
  );

  const suspendedLoginAgain = await loginAccount(suspended.email);

  expectError(
    "state: a suspended account cannot sign in",
    suspendedLoginAgain,
    403,
    AUTH_ACCOUNT_INACTIVE_MESSAGE,
  );

  const suspendedRefresh = await api("POST", "/auth/refresh", {
    body: { refreshToken: suspendedSession.refreshToken },
  });

  expectError(
    "state: a suspended account cannot rotate a refresh token",
    suspendedRefresh,
    403,
    AUTH_ACCOUNT_INACTIVE_MESSAGE,
  );

  const suspendedWrongPassword = await loginAccount(
    suspended.email,
    "Smoke-Verifier-0000-Zz",
  );

  expectError(
    "state: a suspended account with a wrong password looks like any failed sign-in",
    suspendedWrongPassword,
    401,
    AUTH_INVALID_CREDENTIALS_MESSAGE,
  );

  const deleted = await registerAccount(state, "deleted");

  await setUserStatus(deleted.userId, "DELETED");

  const deletedMe = await api("GET", "/auth/me", {
    token: deleted.accessToken,
  });

  expectError(
    "state: a deleted account cannot use an existing access token",
    deletedMe,
    403,
    AUTH_ACCOUNT_INACTIVE_MESSAGE,
  );

  const deletedLogin = await loginAccount(deleted.email);

  expectError(
    "state: a deleted account cannot sign in",
    deletedLogin,
    403,
    AUTH_ACCOUNT_INACTIVE_MESSAGE,
  );

  const changed = await registerAccount(state, "password-changed");
  const beforeChange = await api("GET", "/auth/me", {
    token: changed.accessToken,
  });

  expectStatus(
    "state: the access token works before the password is marked changed",
    beforeChange,
    200,
  );

  // Standing in for a password change: a real change would also write a new
  // digest, but the guard only needs the timestamp to decide a session is stale.
  await setPasswordUpdatedAt(changed.userId, new Date(Date.now() + 60_000));

  const afterChange = await api("GET", "/auth/me", {
    token: changed.accessToken,
  });

  expectError(
    "state: a password change invalidates access tokens issued before it",
    afterChange,
    401,
    AUTH_SESSION_INVALID_MESSAGE,
  );

  const refreshAfterChange = await api("POST", "/auth/refresh", {
    body: { refreshToken: changed.refreshToken },
  });

  expectError(
    "state: a password change invalidates refresh tokens issued before it",
    refreshAfterChange,
    401,
    AUTH_SESSION_INVALID_MESSAGE,
  );
}

/**
 * Two refreshes with the same refresh token must not both succeed: exactly one
 * request may be handed a successor, the other must be refused, and the account
 * must end up with a single active session, so one token can never be rotated
 * twice.
 *
 * A refusal can surface in one of two ways. Normally the loser reaches the
 * rotation, is told the token was already used, and that replay retires the
 * family. On this repository's local Prisma Postgres dev server the loser can
 * instead fail on an unrelated plain query before it gets there: that server is
 * a request-level proxy, and it desynchronises a pooled connection when a query
 * overlaps an open transaction — `08P01: bind message supplies 3 parameters, but
 * prepared statement "" requires 0`. The desynchronisation is reproducible with
 * the proxy alone, on plain reads, with no authentication code involved. Either
 * way the loser is handed no tokens and performs no rotation, which is what this
 * check is about; the reuse rejection itself is pinned down deterministically by
 * the replay checks above.
 */
async function runConcurrencyChecks(state: SmokeState): Promise<void> {
  console.log("\n--- concurrent refresh ---");

  const account = await registerAccount(state, "concurrent");

  const [first, second] = await Promise.all([
    api("POST", "/auth/refresh", {
      body: { refreshToken: account.refreshToken },
    }),
    api("POST", "/auth/refresh", {
      body: { refreshToken: account.refreshToken },
    }),
  ]);

  const accepted = [first, second].filter((response) => response.status === 200);
  const refused = [first, second].filter((response) => response.status !== 200);

  expectEqual("concurrency: exactly one refresh is accepted", accepted.length, 1);
  expectEqual("concurrency: exactly one refresh is refused", refused.length, 1);

  const winner = first.status === 200 ? first : second;
  const loser = first.status === 200 ? second : first;

  expectTrue(
    "concurrency: the refused request is handed no tokens",
    readString(loser.body, "accessToken") === null &&
      readString(loser.body, "refreshToken") === null,
    { status: loser.status, body: loser.body },
  );
  expectEqual(
    "concurrency: only one successor session was written",
    await countActiveSessions(account.userId),
    1,
  );

  if (loser.status === 401) {
    expectError(
      "concurrency: the refused request is told the token was already used",
      loser,
      401,
      AUTH_REFRESH_TOKEN_REUSED_MESSAGE,
    );
    expectEqual(
      "concurrency: that refusal retires the family",
      await countActiveSessions(account.userId),
      0,
    );

    const winnerRetry = await api("POST", "/auth/refresh", {
      body: { refreshToken: readString(winner.body, "refreshToken") ?? "" },
    });

    expectError(
      "concurrency: the retired family leaves the winner without a usable token",
      winnerRetry,
      401,
      AUTH_REFRESH_TOKEN_REUSED_MESSAGE,
    );
  } else {
    // The refusal came from the transport rather than from the rotation, so
    // nothing was retired: the single rotation the winner performed must have
    // survived untouched, and its token must still be usable.
    const winnerMe = await api("GET", "/auth/me", {
      token: readString(winner.body, "accessToken") ?? "",
    });

    expectStatus(
      "concurrency: the winner keeps a working session when the loser never rotated",
      winnerMe,
      200,
    );
  }
}


/**
 * Reads the budget a response advertises. Draft 7 sends one combined
 * `RateLimit` field (`limit=60, remaining=47, reset=656`) alongside a
 * `RateLimit-Policy` that describes the window (`60;w=900`), which is what the
 * standard settled on; the per-field `X-RateLimit-*` headers are the older,
 * non-standard form and are switched off.
 */
function readRateLimitLimit(headers: Record<string, string>): number | null {
  const match = (headers["ratelimit"] ?? "").match(/limit=(\d+)/);

  return match?.[1] === undefined ? null : Number(match[1]);
}

function readRateLimitRemaining(headers: Record<string, string>): number | null {
  const match = (headers["ratelimit"] ?? "").match(/remaining=(\d+)/);

  return match?.[1] === undefined ? null : Number(match[1]);
}

function readRateLimitWindow(headers: Record<string, string>): number | null {
  const match = (headers["ratelimit-policy"] ?? "").match(/w=(\d+)/);

  return match?.[1] === undefined ? null : Number(match[1]);
}

/**
 * The three credential endpoints carry a rate-limit budget. Exhausting a budget
 * would lock this address out for the rest of the window and break every later
 * run, so the budget is observed through the standard `RateLimit` headers
 * instead; the 429 path itself is verified separately by starting the API with a
 * deliberately tiny limit.
 */
async function runRateLimitChecks(): Promise<void> {
  console.log("\n--- rate limiting ---");

  const register = await api("POST", "/auth/register", {
    body: { email: smokeEmail("primary"), password: VALID_PASSWORD },
  });

  expectEqual(
    "rate limit: registration carries the configured budget",
    readRateLimitLimit(register.headers),
    authConfig.rateLimit.register,
  );
  expectTrue(
    "rate limit: the registration budget has been spent on this run",
    (readRateLimitRemaining(register.headers) ?? 0) <
      authConfig.rateLimit.register,
  );

  const login = await api("POST", "/auth/login", {
    body: { email: smokeEmail("primary"), password: "Smoke-Verifier-0000-Zz" },
  });

  expectEqual(
    "rate limit: sign-in carries the configured budget",
    readRateLimitLimit(login.headers),
    authConfig.rateLimit.login,
  );
  expectTrue(
    "rate limit: the remaining budget is reported",
    readRateLimitRemaining(login.headers) !== null,
  );

  const refresh = await api("POST", "/auth/refresh", {
    body: { refreshToken: randomUUID() },
  });

  expectEqual(
    "rate limit: refresh carries the configured budget",
    readRateLimitLimit(refresh.headers),
    authConfig.rateLimit.refresh,
  );
  expectEqual(
    "rate limit: the window is reported in the policy header",
    readRateLimitWindow(register.headers),
    authConfig.rateLimit.windowSeconds,
  );
}

/**
 * Row counts captured before the run, so the audit can prove nothing was lost.
 *
 * The counts are awaited one at a time rather than issued together: the local
 * Prisma Postgres dev server resets a burst of simultaneous connections, and the
 * existing smoke tests read their baseline sequentially for the same reason.
 */
async function readBaseline(): Promise<BaselineCounts> {
  return {
    users: await prisma.user.count(),
    profiles: await prisma.studentProfile.count(),
    sessions: await prisma.session.count(),
    communities: await prisma.community.count(),
    posts: await prisma.post.count(),
    comments: await prisma.comment.count(),
    connections: await prisma.connection.count(),
    studentSkills: await prisma.studentSkill.count(),
    studentInterests: await prisma.studentInterest.count(),
  };
}

/**
 * Deletes exactly what this run created. Sessions and profiles cascade from the
 * account, so removing the accounts is enough; the second pass catches anything a
 * crashed step left behind, recognised by the run id in its address. An account
 * that was already in the database can never carry that prefix.
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
}

/** Proves the cleanup put every count back exactly where it started. */
async function auditCleanup(baseline: BaselineCounts): Promise<void> {
  console.log("\n--- cleanup audit ---");

  const after = await readBaseline();

  expectEqual(
    "audit: the account count is back to where it started",
    after.users,
    baseline.users,
  );
  expectEqual(
    "audit: the profile count is back to where it started",
    after.profiles,
    baseline.profiles,
  );
  expectEqual(
    "audit: the session count is back to where it started",
    after.sessions,
    baseline.sessions,
  );
  expectEqual(
    "audit: the community count is back to where it started",
    after.communities,
    baseline.communities,
  );
  expectEqual(
    "audit: the post count is back to where it started",
    after.posts,
    baseline.posts,
  );
  expectEqual(
    "audit: the comment count is back to where it started",
    after.comments,
    baseline.comments,
  );
  expectEqual(
    "audit: the connection count is back to where it started",
    after.connections,
    baseline.connections,
  );
  expectEqual(
    "audit: the student-skill count is back to where it started",
    after.studentSkills,
    baseline.studentSkills,
  );
  expectEqual(
    "audit: the student-interest count is back to where it started",
    after.studentInterests,
    baseline.studentInterests,
  );
}

async function main(): Promise<void> {
  console.log(`BridgeEd authentication smoke test :: ${RUN_ID}`);
  console.log(`target ${API_BASE_URL}${API_PREFIX}`);

  const state: SmokeState = { createdUserIds: [] };
  const baseline = await readBaseline();

  try {
    await runRegistrationChecks(state);
    await runRegistrationValidationChecks();
    await runRegistrationRoleChecks();
    await runLoginChecks(state);
    await runGuardChecks(state);
    await runRefreshChecks(state);
    await runLogoutChecks(state);
    await runRoleMappingChecks(state);
    await runIdentityChecks(state);
    await runAccountStateChecks(state);
    await runConcurrencyChecks(state);
    await runRateLimitChecks();
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
