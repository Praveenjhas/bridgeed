import {
  USER_ROLES,
  type UserRole as WireUserRole,
} from "@bridgeed/shared/src/constants/roles";
import type { UserRole as DatabaseUserRole } from "../generated/prisma/enums";

/**
 * The single bridge between the two role vocabularies.
 *
 * Prisma stores `USER`/`ADMIN`; the API, the tokens and the app speak
 * `user`/`admin` (see `@bridgeed/shared`). Every repository, service and token
 * helper translates through this module, so a role can never be spelled one way
 * in one place and another way somewhere else.
 *
 * Both maps are keyed by the full enum/union on purpose: widening either
 * vocabulary stops compiling until the new value has been decided here.
 */

const WIRE_ROLE_BY_DATABASE_ROLE: Record<DatabaseUserRole, WireUserRole> = {
  USER: USER_ROLES.USER,
  ADMIN: USER_ROLES.ADMIN,
};

const DATABASE_ROLE_BY_WIRE_ROLE: Record<WireUserRole, DatabaseUserRole> = {
  [USER_ROLES.USER]: "USER",
  [USER_ROLES.ADMIN]: "ADMIN",
};

/** Every wire role, read from the shared vocabulary so a new one cannot be missed. */
const WIRE_ROLES: readonly string[] = Object.values(USER_ROLES);

/** Database spelling of the ordinary account. */
export const DATABASE_ROLE_USER: DatabaseUserRole = "USER";

/** Database spelling of the platform administrator. */
export const DATABASE_ROLE_ADMIN: DatabaseUserRole = "ADMIN";

/** The database enum in the vocabulary the API and the app speak. */
export function toWireRole(role: DatabaseUserRole): WireUserRole {
  return WIRE_ROLE_BY_DATABASE_ROLE[role];
}

/** The wire vocabulary mapped back to the database enum. */
export function toDatabaseRole(role: WireUserRole): DatabaseUserRole {
  return DATABASE_ROLE_BY_WIRE_ROLE[role];
}

/** True when an untrusted value is one of the roles this API knows. */
export function isWireRole(value: unknown): value is WireUserRole {
  return typeof value === "string" && WIRE_ROLES.includes(value);
}

/**
 * Reads a role a client asked for, returning `null` when the value is not a
 * role at all. Both spellings are accepted — `admin` and `ADMIN` mean the same
 * thing — because the legacy user endpoint and the existing smoke tests send
 * the database wording.
 */
export function parseRequestedRole(value: unknown): WireUserRole | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return isWireRole(normalized) ? normalized : null;
}
