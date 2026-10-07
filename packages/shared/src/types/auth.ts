import type { UserRole } from "../constants/roles";
import type { UserStatus } from "../constants/user-statuses";

/**
 * The signed-in account as the API describes it: exactly the public identity
 * fields, plus the lifecycle status. Credential material (`passwordHash`) and
 * session internals (`refreshTokenHash`, `familyId`) are never part of it.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

/** Body of `POST /auth/register`. */
export interface RegisterRequest {
  email: string;
  /** At least 12 and at most 128 characters. */
  password: string;
}

/** Body of `POST /auth/login`. */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Body of `POST /auth/refresh`. The refresh token is opaque to the client, so it
 * is passed back exactly as it was received.
 */
export interface RefreshRequest {
  refreshToken: string;
}

/**
 * The result of registering, signing in or refreshing: the account plus a fresh
 * pair of tokens.
 *
 * `accessToken` is a short-lived stateless HS256 JWT and is sent as
 * `Authorization: Bearer <token>`. `refreshToken` is an opaque secret that is
 * exchanged at `/auth/refresh` for a new pair; only its SHA-256 digest is ever
 * stored, so it cannot be recovered from the server.
 */
export interface AuthSession {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
  /** Instant the access token stops being accepted, as ISO-8601. */
  accessTokenExpiresAt: string;
  /** Instant the refresh token stops being accepted, as ISO-8601. */
  refreshTokenExpiresAt: string;
}

/** Response of `POST /auth/logout` and `POST /auth/logout-all`. */
export interface LogoutResponse {
  /** Always true: signing out an already signed-out session is not an error. */
  success: boolean;
  /** How many active sessions this call retired. */
  revokedSessions: number;
}

/** Response of `GET /auth/me`. */
export type CurrentUserResponse = AuthenticatedUser;
