import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { UserRole } from "@bridgeed/shared/src/constants/roles";
import { authConfig } from "../config/auth";
import { isWireRole } from "./roles";

/** The only JWS algorithm this service signs, and the only one it accepts. */
export const ACCESS_TOKEN_ALGORITHM = "HS256";

const ACCESS_TOKEN_TYPE = "JWT";

/** `header.payload.signature`. */
const ACCESS_TOKEN_SEGMENT_COUNT = 3;

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export type TokenErrorCode =
  | "malformed-token"
  | "unsupported-algorithm"
  | "invalid-signature"
  | "invalid-claims"
  | "expired"
  | "not-yet-valid";

/** Raised whenever an access token is rejected, with the reason why. */
export class TokenError extends Error {
  readonly code: TokenErrorCode;

  constructor(code: TokenErrorCode, message: string) {
    super(message);
    this.name = "TokenError";
    this.code = code;
  }
}

export interface AccessTokenClaims {
  /** Account id the token was issued for. */
  sub: string;
  /** Authorisation role, copied at issue time. */
  role: UserRole;
  /** Session the token belongs to, so revoking the session invalidates it. */
  sid: string;
  /** Issued at, in seconds since the epoch. */
  iat: number;
  /** Expires at, in seconds since the epoch. */
  exp: number;
  /** `iss`, so a token minted by another service is not accepted here. */
  iss: string;
  /** `aud`. */
  aud: string;
  /** Unique token id, so one token can be traced or denied individually. */
  jti: string;
}

export interface SignAccessTokenInput {
  userId: string;
  role: UserRole;
  sessionId: string;
  /** Overrides the configured lifetime; tests use it to mint expired tokens. */
  ttlSeconds?: number;
  /** Overrides the issue time; tests use it to travel in time. */
  issuedAt?: Date;
}

export interface VerifyAccessTokenOptions {
  /** Skew tolerated on `exp` and `iat`, in seconds. */
  clockToleranceSeconds?: number;
  /** Injected clock, so expiry can be tested without waiting. */
  now?: Date;
}

function encodeSegment(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function sign(signingInput: string): string {
  return createHmac("sha256", authConfig.jwtSecret)
    .update(signingInput, "utf8")
    .digest("base64url");
}

function decodeSegment(segment: string): unknown {
  if (!BASE64URL_PATTERN.test(segment)) {
    throw new TokenError("malformed-token", "Token segment is not base64url");
  }

  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch {
    throw new TokenError("malformed-token", "Token segment is not valid JSON");
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TokenError("malformed-token", "Token segment is not a JSON object");
  }

  return value as Record<string, unknown>;
}

/**
 * Mints a short-lived access token. Access tokens are stateless: the signature
 * is the only proof they came from us, so anything that has to be revocable
 * (signing out, a stolen device) hangs off the `sid` claim instead.
 */
export function signAccessToken(input: SignAccessTokenInput): string {
  const issuedAt = input.issuedAt ?? new Date();
  const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);
  const ttlSeconds = input.ttlSeconds ?? authConfig.accessTokenTtlSeconds;

  const claims: AccessTokenClaims = {
    sub: input.userId,
    role: input.role,
    sid: input.sessionId,
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + ttlSeconds,
    iss: authConfig.jwtIssuer,
    aud: authConfig.jwtAudience,
    jti: randomUUID(),
  };

  const signingInput = `${encodeSegment({
    alg: ACCESS_TOKEN_ALGORITHM,
    typ: ACCESS_TOKEN_TYPE,
  })}.${encodeSegment(claims)}`;

  return `${signingInput}.${sign(signingInput)}`;
}

/**
 * Verifies an access token and returns its claims, throwing a TokenError with a
 * machine-readable code so callers can map a rejection to a response without
 * matching on messages. The signature is checked before the payload is parsed
 * as claims, so nothing inside it is trusted until it is proven to be ours.
 */
export function verifyAccessToken(
  token: string,
  options: VerifyAccessTokenOptions = {},
): AccessTokenClaims {
  const segments = token.split(".");

  if (segments.length !== ACCESS_TOKEN_SEGMENT_COUNT) {
    throw new TokenError(
      "malformed-token",
      "Access token must have three segments",
    );
  }

  const headerSegment = segments[0];
  const claimsSegment = segments[1];
  const signatureSegment = segments[2];

  if (!headerSegment || !claimsSegment || !signatureSegment) {
    throw new TokenError(
      "malformed-token",
      "Access token must have three segments",
    );
  }

  const header = asRecord(decodeSegment(headerSegment));

  if (header["alg"] !== ACCESS_TOKEN_ALGORITHM) {
    throw new TokenError(
      "unsupported-algorithm",
      `Access token must be signed with ${ACCESS_TOKEN_ALGORITHM}`,
    );
  }

  if (header["typ"] !== ACCESS_TOKEN_TYPE) {
    throw new TokenError(
      "malformed-token",
      `Access token must declare the ${ACCESS_TOKEN_TYPE} type`,
    );
  }

  const expectedSignature = Buffer.from(
    sign(`${headerSegment}.${claimsSegment}`),
    "base64url",
  );
  const receivedSignature = Buffer.from(signatureSegment, "base64url");

  if (
    !BASE64URL_PATTERN.test(signatureSegment) ||
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    throw new TokenError(
      "invalid-signature",
      "Access token signature does not match",
    );
  }

  const claims = asRecord(decodeSegment(claimsSegment));
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const tolerance = options.clockToleranceSeconds ?? 0;

  const subject = claims["sub"];
  const role = claims["role"];
  const sessionId = claims["sid"];
  const issuedAt = claims["iat"];
  const expiresAt = claims["exp"];
  const issuer = claims["iss"];
  const audience = claims["aud"];
  const tokenId = claims["jti"];

  if (
    typeof subject !== "string" ||
    subject.length === 0 ||
    typeof sessionId !== "string" ||
    sessionId.length === 0 ||
    typeof tokenId !== "string" ||
    tokenId.length === 0 ||
    typeof issuedAt !== "number" ||
    typeof expiresAt !== "number" ||
    typeof issuer !== "string" ||
    typeof audience !== "string" ||
    typeof role !== "string" ||
    !isWireRole(role)
  ) {
    throw new TokenError("invalid-claims", "Access token claims are incomplete");
  }

  if (issuer !== authConfig.jwtIssuer || audience !== authConfig.jwtAudience) {
    throw new TokenError(
      "invalid-claims",
      "Access token was issued for a different service",
    );
  }

  if (nowSeconds > expiresAt + tolerance) {
    throw new TokenError("expired", "Access token has expired");
  }

  if (issuedAt - tolerance > nowSeconds) {
    throw new TokenError("not-yet-valid", "Access token was issued in the future");
  }

  return {
    sub: subject,
    role,
    sid: sessionId,
    iat: issuedAt,
    exp: expiresAt,
    iss: issuer,
    aud: audience,
    jti: tokenId,
  };
}

export interface RefreshToken {
  /** The opaque secret handed to the client. It is never stored. */
  token: string;
  /** SHA-256 digest of `token`, which is what the Session row keeps. */
  hash: string;
  /** Expiry derived from the configured refresh lifetime. */
  expiresAt: Date;
}

export interface IssueRefreshTokenOptions {
  /** Overrides the configured lifetime; tests use it to mint expired tokens. */
  ttlSeconds?: number;
  /** Overrides the issue time. */
  now?: Date;
}

/** Creates a fresh refresh token together with the digest to persist. */
export function issueRefreshToken(
  options: IssueRefreshTokenOptions = {},
): RefreshToken {
  const now = options.now ?? new Date();
  const ttlSeconds = options.ttlSeconds ?? authConfig.refreshTokenTtlSeconds;
  const token = randomBytes(authConfig.refreshTokenBytes).toString("base64url");

  return {
    token,
    hash: hashRefreshToken(token),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
  };
}

/**
 * SHA-256 is enough here because the token is 256 bits of entropy: brute
 * forcing the digest means brute forcing the token itself, so a slow KDF would
 * only add latency to every refresh.
 */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Compares a presented refresh token with a stored digest without leaking,
 * through timing, how much of the digest matched.
 */
export function refreshTokenMatches(token: string, storedHash: string): boolean {
  const received = Buffer.from(hashRefreshToken(token), "utf8");
  const expected = Buffer.from(storedHash, "utf8");

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

/**
 * Identifier shared by every refresh token descended from one sign-in. A
 * rotation keeps the family id, which is what lets the API revoke the whole
 * chain when a revoked token is presented a second time.
 */
export function createSessionFamilyId(): string {
  return randomUUID();
}
