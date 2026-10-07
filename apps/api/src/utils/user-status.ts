import {
  USER_STATUSES,
  type UserStatus as WireUserStatus,
} from "@bridgeed/shared/src/constants/user-statuses";
import type { UserStatus as DatabaseUserStatus } from "../generated/prisma/enums";

/**
 * The single bridge between the two account-status vocabularies, mirroring
 * `roles.ts`.
 *
 * Prisma stores `ACTIVE`/`SUSPENDED`/`DELETED`; the API and the app speak
 * `active`/`suspended`/`deleted` (see `@bridgeed/shared`). Every repository,
 * service and guard translates through this module, so a status can never be
 * spelled one way in one place and another way somewhere else.
 *
 * Both maps are keyed by the full enum/union on purpose: widening either
 * vocabulary stops compiling until the new value has been decided here.
 */

const WIRE_STATUS_BY_DATABASE_STATUS: Record<
  DatabaseUserStatus,
  WireUserStatus
> = {
  ACTIVE: USER_STATUSES.ACTIVE,
  SUSPENDED: USER_STATUSES.SUSPENDED,
  DELETED: USER_STATUSES.DELETED,
};

const DATABASE_STATUS_BY_WIRE_STATUS: Record<
  WireUserStatus,
  DatabaseUserStatus
> = {
  [USER_STATUSES.ACTIVE]: "ACTIVE",
  [USER_STATUSES.SUSPENDED]: "SUSPENDED",
  [USER_STATUSES.DELETED]: "DELETED",
};

/** The database enum in the vocabulary the API and the app speak. */
export function toWireStatus(status: DatabaseUserStatus): WireUserStatus {
  return WIRE_STATUS_BY_DATABASE_STATUS[status];
}

/** The wire vocabulary mapped back to the database enum. */
export function toDatabaseStatus(status: WireUserStatus): DatabaseUserStatus {
  return DATABASE_STATUS_BY_WIRE_STATUS[status];
}
