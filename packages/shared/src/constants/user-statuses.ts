/**
 * Account lifecycle as it travels over the wire. The API stores `ACTIVE`,
 * `SUSPENDED` and `DELETED` (see the Prisma `UserStatus` enum); clients see the
 * lower case spelling, mirroring `USER_ROLES`. The values are the wire contract,
 * so the API maps them to the database enum rather than storing them verbatim.
 */
export const USER_STATUSES = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  DELETED: "deleted",
} as const;

export type UserStatus = (typeof USER_STATUSES)[keyof typeof USER_STATUSES];
