import { USER_ROLES, type UserRole } from "@bridgeed/shared/src/constants/roles";
import { USER_STATUSES } from "@bridgeed/shared/src/constants/user-statuses";
import type {
  AuthenticatedUser,
  AuthSession,
} from "@bridgeed/shared/src/types/auth";
import { authConfig } from "../config/auth";
import { prisma, TRANSACTION_OPTIONS } from "../config/prisma";
import {
  SessionRepository,
  SESSION_NOT_ACTIVE_MESSAGE,
} from "../repositories/session.repository";
import {
  UserRepository,
  type AccountRecord,
} from "../repositories/user.repository";
import { normalizeEmail } from "../utils/email";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  PASSWORD_LENGTH_INVALID_MESSAGE,
  validateRegistrationPassword,
} from "../utils/password-policy";
import {
  USER_EMAIL_INVALID_MESSAGE,
  USER_EMAIL_TAKEN_MESSAGE,
} from "./user.services";
import {
  createSessionFamilyId,
  hashRefreshToken,
  issueRefreshToken,
  signAccessToken,
  type AccessTokenClaims,
  type RefreshToken,
} from "../utils/tokens";

/**
 * The authentication vertical slice: registration, sign-in and the refresh-token
 * lifecycle.
 *
 * Two rules shape everything in this file. The first is that the request never
 * gets to say who it is: a role, a status and an account id are decided here,
 * written here, and later re-read from the database, never taken from a body or
 * a query string. The second is that a caller who has not presented a valid
 * credential learns nothing about an account — the same message covers a wrong
 * password, an address that was never registered and a token that leaked.
 */

/** Raised when an email and password pair does not match an account. */
export const AUTH_INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

/** Raised when a refresh token is unknown, unusable or expired. */
export const AUTH_INVALID_REFRESH_TOKEN_MESSAGE = "Invalid refresh token";

/**
 * Raised when a refresh token that was already rotated is presented a second
 * time. It is deliberately a different message from `AUTH_INVALID_REFRESH_TOKEN`
 * because a client that sees it should stop using its stored token entirely and
 * ask for a password, but the rejection is the same 401 either way.
 */
export const AUTH_REFRESH_TOKEN_REUSED_MESSAGE =
  "Refresh token has already been used";

/** Raised for an account that exists but may not sign in. */
export const AUTH_ACCOUNT_INACTIVE_MESSAGE =
  "This account is not allowed to sign in";

/** Raised when the session behind an otherwise valid access token is gone. */
export const AUTH_SESSION_INVALID_MESSAGE = "Your session is no longer valid";

/** Raised when the account behind an otherwise valid access token is gone. */
export const AUTH_ACCOUNT_MISSING_MESSAGE =
  "Your account is no longer available";

/**
 * What a guarded route is allowed to believe about its caller. It is built only
 * from a verified access token plus the rows it names, and is attached to the
 * request by `requireAuth`.
 */
export interface AuthenticatedContext {
  userId: string;
  role: UserRole;
  sessionId: string;
}

/** Request context shared by the credential endpoints. */
export interface ClientContext {
  /** Recorded on the session so the user can recognise the device later. */
  userAgent?: string | null;
  /** Recorded on the session so the user can recognise the network later. */
  ipAddress?: string | null;
}

export interface RegisterInput extends ClientContext {
  /** Raw client value; rejected rather than passed through when unusable. */
  email: unknown;
  password: unknown;
}

export interface LoginInput extends ClientContext {
  email: unknown;
  password: unknown;
}

export interface RefreshInput {
  refreshToken: unknown;
}

/**
 * Prisma reports a duplicate unique index as `P2002`. Matching on the code
 * rather than importing the error class keeps this working whatever client the
 * repository was handed.
 */
function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** The public identity of an account: no credential material, no session data. */
function toAuthenticatedUser(account: AccountRecord): AuthenticatedUser {
  return {
    id: account.id,
    email: account.email,
    role: account.role,
    status: account.status,
  };
}

/**
 * True when the password changed after the session was created, which makes the
 * session — and any access token that references it — stale. An account with no
 * password timestamp (every row created before authentication existed) never
 * invalidates anything.
 */
function isSessionOlderThanPassword(
  account: AccountRecord,
  session: { createdAt: string },
): boolean {
  if (account.passwordUpdatedAt === null) {
    return false;
  }

  return (
    new Date(account.passwordUpdatedAt).getTime() >
    new Date(session.createdAt).getTime()
  );
}

/** Reads the opaque refresh token, or null when the field is unusable. */
function readRefreshToken(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const token = value.trim();

  return token.length > 0 ? token : null;
}

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  /**
   * Creates an account and signs it in.
   *
   * The role and the status are fixed here rather than read from the request, so
   * registration cannot mint an administrator or a pre-suspended account, and no
   * StudentProfile is created: what a student studies is onboarding's job.
   */
  async register(input: RegisterInput): Promise<AuthSession> {
    const email = normalizeEmail(input.email);

    if (email === null) {
      throw new Error(USER_EMAIL_INVALID_MESSAGE);
    }

    const rawPassword = input.password;

    if (typeof rawPassword !== "string") {
      throw new Error(PASSWORD_LENGTH_INVALID_MESSAGE);
    }

    const passwordError = validateRegistrationPassword(rawPassword, email);

    if (passwordError !== null) {
      throw new Error(passwordError);
    }

    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw new Error(USER_EMAIL_TAKEN_MESSAGE);
    }

    const passwordHash = await hashPassword(rawPassword);
    const now = new Date();
    const account: AuthenticatedUser = {
      id: crypto.randomUUID(),
      email,
      role: USER_ROLES.USER,
      status: USER_STATUSES.ACTIVE,
    };
    const sessionId = crypto.randomUUID();
    const refreshToken = issueRefreshToken({ now });

    try {
      // The account and its first session are one unit of work: a crash between
      // them would otherwise leave a password on an account nobody can sign
      // into, or a session pointing at an account that does not exist.
      await prisma.$transaction(async (transaction) => {
        await this.userRepository.createAccount(
          {
            id: account.id,
            email: account.email,
            role: account.role,
            status: account.status,
            passwordHash,
            passwordUpdatedAt: now,
            createdAt: now,
            updatedAt: now,
          },
          transaction,
        );

        await this.sessionRepository.createSession(
          {
            id: sessionId,
            userId: account.id,
            familyId: createSessionFamilyId(),
            refreshTokenHash: refreshToken.hash,
            expiresAt: refreshToken.expiresAt,
            userAgent: input.userAgent ?? null,
            ipAddress: input.ipAddress ?? null,
          },
          transaction,
        );
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      // The lookup above narrowed the window, but two simultaneous sign-ups for
      // the same address both pass it; the unique index is the real arbiter, and
      // its violation is the same conflict the caller should have seen.
      if (isUniqueConstraintViolation(error)) {
        throw new Error(USER_EMAIL_TAKEN_MESSAGE);
      }

      throw error;
    }

    return this.buildSession(account, sessionId, refreshToken);
  }

  /**
   * Signs an account in and opens a new session.
   *
   * Every credential failure leaves through
   * {@link AUTH_INVALID_CREDENTIALS_MESSAGE}, so this endpoint cannot be used to
   * find out which addresses are registered: `verifyPassword` fails closed and
   * never throws, so an unknown address, a row whose digest cannot be parsed and
   * a row with no digest at all all land on that same rejection.
   */
  async login(input: LoginInput): Promise<AuthSession> {
    const email = normalizeEmail(input.email);
    const password = typeof input.password === "string" ? input.password : "";

    const account =
      email === null
        ? null
        : await this.userRepository.findAccountByEmail(email);

    const passwordMatches =
      account === null
        ? false
        : await verifyPassword(password, account.passwordHash);

    if (account === null || !passwordMatches) {
      throw new Error(AUTH_INVALID_CREDENTIALS_MESSAGE);
    }

    // Only a caller who already proved they know the password learns that the
    // account is suspended or deleted.
    if (account.status !== USER_STATUSES.ACTIVE) {
      throw new Error(AUTH_ACCOUNT_INACTIVE_MESSAGE);
    }

    const now = new Date();
    const sessionId = crypto.randomUUID();
    const refreshToken = issueRefreshToken({ now });

    await this.sessionRepository.createSession({
      id: sessionId,
      userId: account.id,
      // A fresh family per sign-in: signing one device out must not touch
      // another, and a replay on one chain must not sign the others out.
      familyId: createSessionFamilyId(),
      refreshTokenHash: refreshToken.hash,
      expiresAt: refreshToken.expiresAt,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
    });

    return this.buildSession(
      toAuthenticatedUser(account),
      sessionId,
      refreshToken,
    );
  }

  /**
   * Exchanges a refresh token for a new pair.
   *
   * Rotation is one conditional transaction — the presented session is revoked
   * and its successor is written with the same family id — so when two refreshes
   * race with the same token exactly one of them is handed a successor. The
   * other is a replay, and a replay on any token of a family retires the whole
   * family: the copy in the wrong hands cannot be told from the copy in the
   * right ones, so the account is asked to sign in again.
   */
  async refresh(input: RefreshInput): Promise<AuthSession> {
    const token = readRefreshToken(input.refreshToken);

    if (token === null) {
      throw new Error(AUTH_INVALID_REFRESH_TOKEN_MESSAGE);
    }

    const session = await this.sessionRepository.findByRefreshTokenHash(
      hashRefreshToken(token),
    );

    if (session === null) {
      throw new Error(AUTH_INVALID_REFRESH_TOKEN_MESSAGE);
    }

    if (session.revokedAt !== null) {
      await this.sessionRepository.revokeFamily(session.familyId);

      throw new Error(AUTH_REFRESH_TOKEN_REUSED_MESSAGE);
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      throw new Error(AUTH_INVALID_REFRESH_TOKEN_MESSAGE);
    }

    const account = await this.userRepository.findAccountById(session.userId);

    if (account === null) {
      throw new Error(AUTH_INVALID_REFRESH_TOKEN_MESSAGE);
    }

    if (account.status !== USER_STATUSES.ACTIVE) {
      throw new Error(AUTH_ACCOUNT_INACTIVE_MESSAGE);
    }

    // A password change retires every session opened before it, including the
    // one this refresh token belongs to, so a stolen token cannot outlive the
    // password it was issued against.
    if (isSessionOlderThanPassword(account, session)) {
      throw new Error(AUTH_SESSION_INVALID_MESSAGE);
    }

    const now = new Date();
    const nextSessionId = crypto.randomUUID();
    const nextRefreshToken = issueRefreshToken({ now });

    try {
      await this.sessionRepository.rotateSession(
        session.id,
        {
          id: nextSessionId,
          refreshTokenHash: nextRefreshToken.hash,
          expiresAt: nextRefreshToken.expiresAt,
        },
        now,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === SESSION_NOT_ACTIVE_MESSAGE
      ) {
        // Another refresh won the race for this session, so the token in this
        // hand is a replay. Losing the race must not win tokens: the family is
        // retired exactly as it is for any other replay.
        await this.sessionRepository.revokeFamily(session.familyId);

        throw new Error(AUTH_REFRESH_TOKEN_REUSED_MESSAGE);
      }

      throw error;
    }

    return this.buildSession(
      toAuthenticatedUser(account),
      nextSessionId,
      nextRefreshToken,
    );
  }

  /**
   * Signs one session out, reporting how many rows were retired (0 or 1). The
   * row is soft-revoked, never deleted, so where an account has been signed in
   * stays auditable, and signing out an already signed-out session is not an
   * error: the client asked for the state it is already in.
   */
  async logout(sessionId: string): Promise<number> {
    const revoked = await this.sessionRepository.revokeSession(sessionId);

    return revoked ? 1 : 0;
  }

  /**
   * Signs every session of one account out. The account id comes from the
   * verified token, never from the request, so a caller cannot sign somebody
   * else out.
   */
  async logoutAll(userId: string): Promise<number> {
    return this.sessionRepository.revokeAllForUser(userId);
  }

  /** The account identity behind a verified token, for `GET /auth/me`. */
  async getCurrentUser(userId: string): Promise<AuthenticatedUser> {
    const account = await this.userRepository.findAccountById(userId);

    if (account === null) {
      throw new Error(AUTH_ACCOUNT_MISSING_MESSAGE);
    }

    return toAuthenticatedUser(account);
  }

  /**
   * Turns verified access-token claims into the identity a route may trust.
   *
   * The signature is only the first half of the check. The session the token
   * names has to still exist, still be active and still be unexpired; the
   * account has to still exist and be active; and the password must not have
   * changed since the session was created. Everything is re-read from the
   * database, so a session retired a moment ago takes effect immediately rather
   * than whenever the access token happens to expire, and the role comes from the
   * account row rather than from the token, so a role change applies to tokens
   * minted before it.
   */
  async resolveAuthenticatedContext(
    claims: AccessTokenClaims,
  ): Promise<AuthenticatedContext> {
    const session = await this.sessionRepository.findById(claims.sid);

    if (session === null || session.revokedAt !== null) {
      throw new Error(AUTH_SESSION_INVALID_MESSAGE);
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      throw new Error(AUTH_SESSION_INVALID_MESSAGE);
    }

    // Only we can sign a token naming this session, but a token must still never
    // be usable against a session that belongs to a different account.
    if (session.userId !== claims.sub) {
      throw new Error(AUTH_SESSION_INVALID_MESSAGE);
    }

    const account = await this.userRepository.findAccountById(session.userId);

    if (account === null) {
      throw new Error(AUTH_ACCOUNT_MISSING_MESSAGE);
    }

    if (account.status !== USER_STATUSES.ACTIVE) {
      throw new Error(AUTH_ACCOUNT_INACTIVE_MESSAGE);
    }

    if (isSessionOlderThanPassword(account, session)) {
      throw new Error(AUTH_SESSION_INVALID_MESSAGE);
    }

    return {
      userId: account.id,
      role: account.role,
      sessionId: session.id,
    };
  }

  /**
   * Mints the access token that belongs to a session and packages the response.
   * The refresh token is the one already written to the row, returned raw exactly
   * once, here; it was never stored and never will be.
   */
  private buildSession(
    user: AuthenticatedUser,
    sessionId: string,
    refreshToken: RefreshToken,
  ): AuthSession {
    const issuedAt = new Date();
    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role,
      sessionId,
      issuedAt,
    });

    return {
      user,
      accessToken,
      refreshToken: refreshToken.token,
      accessTokenExpiresAt: new Date(
        issuedAt.getTime() + authConfig.accessTokenTtlSeconds * 1000,
      ).toISOString(),
      refreshTokenExpiresAt: refreshToken.expiresAt.toISOString(),
    };
  }
}
