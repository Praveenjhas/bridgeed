/**
 * Account roles. Authorisation only tells ordinary users apart from platform
 * administrators: whether somebody is a student, a mentor or an educator is
 * profile data (StudentProfile), not an account role. The values are lowercase
 * because they travel over the wire; the API maps them to the database enum.
 */
export const USER_ROLES = {
  USER: "user",
  ADMIN: "admin",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
