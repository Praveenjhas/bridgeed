import "dotenv/config";

/**
 * Signing key used when AUTH_JWT_SECRET is not configured. It is a published
 * constant, so a token signed with it is worthless to anyone who has read this
 * repository; it exists only so the API can be started without configuring
 * anything. Production refuses to start without a real secret, and the secret is
 * never logged.
 */
const DEVELOPMENT_JWT_SECRET =
  "bridgeed-local-development-jwt-secret-do-not-use-in-production";

/** Below this length an HS256 secret can be brute forced offline from a token. */
const MINIMUM_JWT_SECRET_LENGTH = 32;

/** scrypt cost exponent: the N stored in each hash is 2^exponent (15 => 32768). */
const DEFAULT_SCRYPT_COST_EXPONENT = 15;

/**
 * Range the cost is allowed to take. The floor keeps a misconfigured
 * environment from silently weakening every stored password; the ceiling keeps
 * a typo from making a single derivation exhaust the process memory.
 */
const MINIMUM_SCRYPT_COST_EXPONENT = 10;
const MAXIMUM_SCRYPT_COST_EXPONENT = 20;

/** 15 minutes, short enough that a leaked access token ages out quickly. */
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** 30 days, the window a student stays signed in without re-entering a password. */
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** 256 bits of entropy for an opaque refresh token. */
const DEFAULT_REFRESH_TOKEN_BYTES = 32;

/**
 * Length of the rate-limit window applied to the credential endpoints, in
 * seconds. Fifteen minutes is long enough that a slow guessing attempt never
 * escapes the budget and short enough that a legitimate client that tripped a
 * limit is not locked out for the rest of the day.
 */
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

/**
 * Requests allowed per address per window. These are development-friendly
 * defaults — generous enough that a person cannot hit them by signing in from a
 * handful of devices or by running the auth smoke test twice in a row, tight
 * enough that scripted guessing is not free. A deployment that wants stricter
 * numbers sets the `AUTH_RATE_LIMIT_*` variables.
 */
const DEFAULT_RATE_LIMIT_REGISTER = 60;
const DEFAULT_RATE_LIMIT_LOGIN = 60;
const DEFAULT_RATE_LIMIT_REFRESH = 240;

export interface PasswordHashingConfig {
  /** scrypt cost parameter N. */
  cost: number;
  /** scrypt block size r. */
  blockSize: number;
  /** scrypt parallelisation p. */
  parallelization: number;
  /** Length in bytes of the derived key that is stored. */
  keyLength: number;
  /** Length in bytes of the random salt generated per password. */
  saltBytes: number;
  /**
   * Memory ceiling Node enforces on scrypt. Set to twice the 128 * N * r
   * working set one derivation needs, which is the smallest value that cannot
   * reject a legitimate hash while still bounding what one request can allocate.
   */
  maxmem: number;
}

export interface AuthRateLimitConfig {
  /** Length of the window every credential endpoint's budget resets on. */
  windowSeconds: number;
  /** Sign-ups allowed per address per window. */
  register: number;
  /** Sign-in attempts allowed per address per window. */
  login: number;
  /** Token rotations allowed per address per window. */
  refresh: number;
}

export interface AuthConfig {
  /** HS256 signing key for access tokens. */
  jwtSecret: string;
  /** `iss` claim, so a token minted by another service is not accepted here. */
  jwtIssuer: string;
  /** `aud` claim. */
  jwtAudience: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  refreshTokenBytes: number;
  password: PasswordHashingConfig;
  /** Budget for the credential endpoints, which are the unauthenticated ones. */
  rateLimit: AuthRateLimitConfig;
}

function readString(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, received "${raw}"`);
  }

  return parsed;
}

/** Production is the only environment that must never fall back to a published key. */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Resolves the signing key. A configured secret is used once it is long enough;
 * without one, production refuses to start and every other environment uses the
 * published development key, so a misconfigured deployment fails loudly instead
 * of quietly signing tokens anybody could forge.
 */
function readJwtSecret(): string {
  const configured = process.env.AUTH_JWT_SECRET?.trim();

  if (configured) {
    if (configured.length < MINIMUM_JWT_SECRET_LENGTH) {
      throw new Error(
        `AUTH_JWT_SECRET must be at least ${MINIMUM_JWT_SECRET_LENGTH} characters`,
      );
    }

    return configured;
  }

  if (isProduction()) {
    throw new Error("AUTH_JWT_SECRET must be set in production");
  }

  return DEVELOPMENT_JWT_SECRET;
}

function readPasswordHashingConfig(): PasswordHashingConfig {
  const costExponent = readPositiveInteger(
    "AUTH_SCRYPT_COST_EXPONENT",
    DEFAULT_SCRYPT_COST_EXPONENT,
  );

  if (
    costExponent < MINIMUM_SCRYPT_COST_EXPONENT ||
    costExponent > MAXIMUM_SCRYPT_COST_EXPONENT
  ) {
    throw new Error(
      `AUTH_SCRYPT_COST_EXPONENT must be between ${MINIMUM_SCRYPT_COST_EXPONENT} and ${MAXIMUM_SCRYPT_COST_EXPONENT}, received "${costExponent}"`,
    );
  }

  const cost = 2 ** costExponent;
  const blockSize = readPositiveInteger("AUTH_SCRYPT_BLOCK_SIZE", 8);

  return {
    cost,
    blockSize,
    parallelization: readPositiveInteger("AUTH_SCRYPT_PARALLELIZATION", 1),
    keyLength: readPositiveInteger("AUTH_SCRYPT_KEY_LENGTH", 64),
    saltBytes: readPositiveInteger("AUTH_SCRYPT_SALT_BYTES", 16),
    maxmem: 256 * cost * blockSize,
  };
}

function readRateLimitConfig(): AuthRateLimitConfig {
  return {
    windowSeconds: readPositiveInteger(
      "AUTH_RATE_LIMIT_WINDOW_SECONDS",
      DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
    ),
    register: readPositiveInteger(
      "AUTH_RATE_LIMIT_REGISTER",
      DEFAULT_RATE_LIMIT_REGISTER,
    ),
    login: readPositiveInteger("AUTH_RATE_LIMIT_LOGIN", DEFAULT_RATE_LIMIT_LOGIN),
    refresh: readPositiveInteger(
      "AUTH_RATE_LIMIT_REFRESH",
      DEFAULT_RATE_LIMIT_REFRESH,
    ),
  };
}

export const authConfig: AuthConfig = {
  jwtSecret: readJwtSecret(),
  jwtIssuer: readString("AUTH_JWT_ISSUER", "bridgeed-api"),
  jwtAudience: readString("AUTH_JWT_AUDIENCE", "bridgeed-app"),
  accessTokenTtlSeconds: readPositiveInteger(
    "AUTH_ACCESS_TOKEN_TTL_SECONDS",
    DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
  ),
  refreshTokenTtlSeconds: readPositiveInteger(
    "AUTH_REFRESH_TOKEN_TTL_SECONDS",
    DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
  ),
  refreshTokenBytes: readPositiveInteger(
    "AUTH_REFRESH_TOKEN_BYTES",
    DEFAULT_REFRESH_TOKEN_BYTES,
  ),
  password: readPasswordHashingConfig(),
  rateLimit: readRateLimitConfig(),
};
