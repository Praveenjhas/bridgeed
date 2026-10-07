import type { NextFunction, Request, Response } from "express";
import { SessionRepository } from "../repositories/session.repository";
import { UserRepository } from "../repositories/user.repository";
import {
  AuthService,
  type AuthenticatedContext,
} from "../services/auth.service";
import { sendAuthError } from "../utils/auth-errors";
import {
  TokenError,
  verifyAccessToken,
  type AccessTokenClaims,
} from "../utils/tokens";

/**
 * The boundary between "somebody sent a request" and "this request is
 * authenticated".
 *
 * Everything a route is allowed to know about its caller is produced here and
 * nowhere else: the access token is verified, the session and account it names
 * are re-read from the database, and the result is attached to the request. A
 * route that reads `req.auth` therefore cannot be influenced by a body field, a
 * query string or an `actorId`.
 */

const authService = new AuthService(
  new UserRepository(),
  new SessionRepository(),
);

/** Sent when a request carries no usable access token. */
export const AUTH_AUTHENTICATION_REQUIRED_MESSAGE =
  "Authentication is required";

/**
 * Raised when a guarded route reads the authenticated context without the guard
 * having run. That is a routing mistake rather than a client error, so it is
 * reported as a server error instead of being mistaken for a bad credential.
 */
export const AUTH_CONTEXT_MISSING_MESSAGE =
  "Authenticated context is not available";

/**
 * Reads `Authorization: Bearer <token>`. Returns null for a missing header, a
 * different scheme, an empty credential or a header with extra fields, so only
 * a well-formed bearer token is ever handed to the verifier.
 */
function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;

  if (typeof header !== "string") {
    return null;
  }

  const segments = header.trim().split(" ");
  const scheme = segments[0];
  const credentials = segments[1];

  if (
    segments.length !== 2 ||
    scheme === undefined ||
    credentials === undefined ||
    scheme.toLowerCase() !== "bearer"
  ) {
    return null;
  }

  const token = credentials.trim();

  return token.length > 0 ? token : null;
}

/**
 * Verifies the access token and resolves it to a live session and account,
 * rejecting the request unless every check passes. On success it sets
 * `req.auth` and hands over to the route.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = readBearerToken(req);

  if (token === null) {
    res.status(401).json({ error: AUTH_AUTHENTICATION_REQUIRED_MESSAGE });
    return;
  }

  let claims: AccessTokenClaims;

  try {
    claims = verifyAccessToken(token);
  } catch (error) {
    if (!(error instanceof TokenError)) {
      console.error(error);

      res.status(500).json({ error: "Internal server error" });
      return;
    }

    // A token that is malformed, signed with the wrong key, signed with the
    // wrong algorithm, issued by another service, addressed to another audience
    // or expired is simply not a credential. Which of those it was is never
    // reported, so the endpoint cannot be used to probe the token format.
    res.status(401).json({ error: AUTH_AUTHENTICATION_REQUIRED_MESSAGE });
    return;
  }

  try {
    req.auth = await authService.resolveAuthenticatedContext(claims);

    next();
  } catch (error) {
    sendAuthError(error, res);
  }
}

/**
 * Reads the authenticated context a guarded route depends on. A missing value
 * means the route was mounted without `requireAuth`, which is a programming
 * error and surfaces as a 500 rather than as a silent `undefined`.
 */
export function requireAuthContext(req: Request): AuthenticatedContext {
  if (!req.auth) {
    throw new Error(AUTH_CONTEXT_MISSING_MESSAGE);
  }

  return req.auth;
}
