/**
 * Password rules the sign-up form mirrors from the API's `RegisterRequest`
 * contract (`packages/shared/src/types/auth.ts`).
 *
 * The client checks them so a typo is caught before a round trip; the API
 * remains the authority and validates the same bounds again.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
