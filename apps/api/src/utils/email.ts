/**
 * Email handling for the credential layer.
 *
 * An address is stored, compared and looked up in exactly one canonical form so
 * that `Student@Example.com ` and `student@example.com` cannot become two
 * accounts. Existing rows are deliberately left alone: this only governs what
 * the authentication layer writes and queries from now on.
 */

/** Longest address the standards allow, so one request cannot store an unbounded one. */
const MAXIMUM_EMAIL_LENGTH = 254;

/**
 * Deliberately conservative: a non-empty local part, one `@`, no whitespace and
 * a dotted domain. Whether an address can actually receive mail is proven by a
 * verification message, not by a pattern.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Trims and lowercases an email address, or returns `null` when the input is
 * empty or cannot be an address. Callers treat `null` as a client error rather
 * than passing a value through to the database.
 */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0 || normalized.length > MAXIMUM_EMAIL_LENGTH) {
    return null;
  }

  if (!EMAIL_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}
