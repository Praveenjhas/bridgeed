import type { Response } from "express";
import type { MappedHttpError } from "./community-errors";
import {
  PASSWORD_LENGTH_INVALID_MESSAGE,
  PASSWORD_MATCHES_EMAIL_MESSAGE,
  PASSWORD_TOO_COMMON_MESSAGE,
} from "./password-policy";
import {
  AUTH_ACCOUNT_INACTIVE_MESSAGE,
  AUTH_ACCOUNT_MISSING_MESSAGE,
  AUTH_INVALID_CREDENTIALS_MESSAGE,
  AUTH_INVALID_REFRESH_TOKEN_MESSAGE,
  AUTH_REFRESH_TOKEN_REUSED_MESSAGE,
  AUTH_SESSION_INVALID_MESSAGE,
} from "../services/auth.service";
import {
  USER_EMAIL_INVALID_MESSAGE,
  USER_EMAIL_TAKEN_MESSAGE,
} from "../services/user.services";

/**
 * Maps the authentication domain errors raised by the service layer onto HTTP
 * errors, following the same shape as `mapPostDomainError` and friends.
 *
 * Returning null means the error is unexpected and should be reported as a
 * server error, so a database failure or a bug can never be mistaken for a
 * deliberate rejection. Nothing here reproduces an internal message: e.g. the
 * `SESSION_NOT_ACTIVE` text raised by the session repository is never sent to a
 * client, because the service translates it into a stable auth message first.
 */
export function mapAuthDomainError(error: unknown): MappedHttpError | null {
  const message = error instanceof Error ? error.message : undefined;

  switch (message) {
    // Every credential failure looks the same from outside: the client cannot
    // tell a wrong password from a deleted account from a token that was
    // already rotated.
    case AUTH_INVALID_CREDENTIALS_MESSAGE:
    case AUTH_INVALID_REFRESH_TOKEN_MESSAGE:
    case AUTH_REFRESH_TOKEN_REUSED_MESSAGE:
    case AUTH_SESSION_INVALID_MESSAGE:
    case AUTH_ACCOUNT_MISSING_MESSAGE:
      return { status: 401, error: message };

    // Suspension and soft deletion are authorisation failures, not credential
    // ones, and are only reported once the password has been verified.
    case AUTH_ACCOUNT_INACTIVE_MESSAGE:
      return { status: 403, error: message };

    case USER_EMAIL_TAKEN_MESSAGE:
      return { status: 409, error: message };

    case USER_EMAIL_INVALID_MESSAGE:
    case PASSWORD_LENGTH_INVALID_MESSAGE:
    case PASSWORD_MATCHES_EMAIL_MESSAGE:
    case PASSWORD_TOO_COMMON_MESSAGE:
      return { status: 400, error: message };

    default:
      return null;
  }
}

/**
 * Sends a mapped auth error, and reports anything unmapped as a server error so
 * raw database errors and stack traces are never leaked to clients.
 */
export function sendAuthError(error: unknown, res: Response): void {
  const mapped = mapAuthDomainError(error);

  if (mapped) {
    res.status(mapped.status).json({ error: mapped.error });
    return;
  }

  console.error(error);

  res.status(500).json({
    error: "Internal server error",
  });
}
