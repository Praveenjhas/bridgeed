export const USER_ROLES = {
  STUDENT: "student",
  MENTOR: "mentor",
  EDUCATOR: "educator",
  ADMIN: "admin",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
