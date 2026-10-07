/**
 * Registration password rules.
 *
 * The only hard requirement is length: a password's strength comes from its
 * length and unpredictability, not from forcing punctuation. On top of that
 * length check two things are refused that are pure downgrades rather than
 * policy: the password being the account's own email address, and the password
 * being one of a small set of passwords so widely tried that they are worth
 * nothing. Nothing here rehashes, trims or otherwise alters the secret itself —
 * spaces are legitimate, so the value is compared trimmed but stored verbatim.
 */

/** Below this, offline brute force becomes cheap even against a good hash. */
export const PASSWORD_MINIMUM_LENGTH = 12;

/**
 * Upper bound on what a sign-up may submit. scrypt cost is fixed by its
 * parameters, so a longer password buys no extra strength; the limit only stops
 * an unbounded string being pushed through the KDF.
 */
export const PASSWORD_MAXIMUM_LENGTH = 128;

/** `messages` the controller maps to 400. */
export const PASSWORD_LENGTH_INVALID_MESSAGE = `Password must be between ${PASSWORD_MINIMUM_LENGTH} and ${PASSWORD_MAXIMUM_LENGTH} characters`;
export const PASSWORD_MATCHES_EMAIL_MESSAGE =
  "Password must not be your email address";
export const PASSWORD_TOO_COMMON_MESSAGE =
  "Password is too common; choose something less predictable";

/**
 * Deterministic blocklist, matched case-insensitively against the trimmed
 * password. It is deliberately tiny and static: it exists to refuse the handful
 * of passwords that appear at the top of every credential-stuffing list, not to
 * grade password quality. Short entries are kept even though the length rule
 * already refuses them, so the list still reads as what it is.
 */
const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "password1234",
  "password12345",
  "passwordpassword",
  "passw0rd1234",
  "passw0rd12345",
  "p@ssw0rd1234",
  "123456789012",
  "1234567890123",
  "12345678901234",
  "012345678901",
  "0123456789012",
  "111111111111",
  "000000000000",
  "222222222222",
  "123123123123",
  "121212121212",
  "qwertyuiop12",
  "qwertyuiop123",
  "qwerty123456",
  "qwertyuiopas",
  "1qaz2wsx3edc",
  "qazwsxedc123",
  "asdfghjkl123",
  "zxcvbnm12345",
  "letmein12345",
  "letmein123456",
  "iloveyou1234",
  "iloveyou12345",
  "welcome1234",
  "welcome12345",
  "welcome123456",
  "adminadmin12",
  "adminadmin123",
  "admin1234567",
  "administrator",
  "changeme1234",
  "changeme123456",
  "changemenow1",
  "trustno1trustno1",
  "abc123456789",
  "abcd12345678",
  "monkey123456",
  "dragon123456",
  "football1234",
  "baseball1234",
  "sunshine1234",
  "princess1234",
  "superman1234",
  "starwars1234",
  "testtest1234",
  "testpassword",
  "testtesttest",
  "secret123456",
  "secretsecret",
  "bridgeed1234",
  "bridgeed123456",
  "bridgeedlocal",
]);

/** True when a value is one of the widely tried passwords above. */
export function isCommonPassword(value: string): boolean {
  return COMMON_PASSWORDS.has(value.trim().toLowerCase());
}

/**
 * Checks a sign-up password against the policy and returns the reason it was
 * refused, or `null` when it is acceptable. `normalizedEmail` must already be in
 * the canonical form, so padding and casing cannot be used to smuggle the
 * address past the comparison.
 */
export function validateRegistrationPassword(
  value: unknown,
  normalizedEmail: string,
): string | null {
  if (
    typeof value !== "string" ||
    value.length < PASSWORD_MINIMUM_LENGTH ||
    value.length > PASSWORD_MAXIMUM_LENGTH
  ) {
    return PASSWORD_LENGTH_INVALID_MESSAGE;
  }

  const folded = value.trim().toLowerCase();

  if (folded === normalizedEmail) {
    return PASSWORD_MATCHES_EMAIL_MESSAGE;
  }

  if (COMMON_PASSWORDS.has(folded)) {
    return PASSWORD_TOO_COMMON_MESSAGE;
  }

  return null;
}
