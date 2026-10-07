import { rateLimit, type RateLimitRequestHandler } from "express-rate-limit";
import { authConfig } from "../config/auth";

/**
 * Rate limiting for the credential endpoints.
 *
 * Only `POST /auth/register`, `POST /auth/login` and `POST /auth/refresh` are
 * limited. They are the three routes where an unauthenticated caller can spend
 * real work — a scrypt derivation or a token rotation — so they are also the
 * three that a brute-force attempt has to hammer. Nothing global is added: the
 * existing content endpoints keep their current behaviour.
 */

/** Body sent when a client exceeds its budget. */
export const RATE_LIMIT_EXCEEDED_MESSAGE =
  "Too many requests; please try again later";

/**
 * Builds one limiter. The client address is the key, which is what the
 * underlying store already does correctly for both IPv4 and IPv6, so the
 * default key generator is left in place.
 */
function createAuthRateLimiter(limit: number): RateLimitRequestHandler {
  return rateLimit({
    windowMs: authConfig.rateLimit.windowSeconds * 1000,
    limit,
    // `RateLimit-*` headers let a well-behaved client back off before it is
    // refused, and let the smoke test observe the configured budget without
    // having to exhaust it. Draft 7 is requested explicitly rather than left to
    // the `true` default, whose meaning has changed between major versions.
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: RATE_LIMIT_EXCEEDED_MESSAGE },
  });
}

/** Guards account creation against bulk sign-up. */
export const registerRateLimiter = createAuthRateLimiter(
  authConfig.rateLimit.register,
);

/** Guards password guessing against a single address. */
export const loginRateLimiter = createAuthRateLimiter(
  authConfig.rateLimit.login,
);

/**
 * Deliberately the loosest of the three: a client with several devices
 * legitimately rotates often, so this only stops a runaway loop.
 */
export const refreshRateLimiter = createAuthRateLimiter(
  authConfig.rateLimit.refresh,
);
