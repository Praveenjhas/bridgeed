import type { Request } from "express";

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function readRouteParam(req: Request, name: string): string | null {
  const value = req.params[name];

  return isNonEmptyString(value) ? value : null;
}

/**
 * Legacy acting student, supplied explicitly by the client.
 *
 * This is the pre-authentication contract the live smoke suites still exercise:
 * the actor arrives in the payload or the query string, using the same
 * precedence as the community endpoints, with content endpoints sending
 * `authorId` and reactions sending `userId`. It is only ever reached through
 * `readCurrentActorId`, which prefers the authenticated account first, so an
 * authenticated caller can never make it name somebody else.
 */
export function readActorId(req: Request): string | null {
  const { actorId, userId, authorId } = (req.body ?? {}) as {
    actorId?: unknown;
    userId?: unknown;
    authorId?: unknown;
  };

  if (isNonEmptyString(actorId)) {
    return actorId;
  }

  if (isNonEmptyString(userId)) {
    return userId;
  }

  if (isNonEmptyString(authorId)) {
    return authorId;
  }

  const queryActorId =
    req.query.actorId ?? req.query.userId ?? req.query.authorId;

  return isNonEmptyString(queryActorId) ? queryActorId : null;
}

/**
 * Resolves the acting account for a social request, preferring the
 * authenticated identity.
 *
 * When the request passed through `requireAuth` or `optionalAuth` with a token,
 * `req.auth` was produced by verifying that token, so its `userId` is the actor
 * and no client supplied `actorId`, `userId` or `authorId` can override it. Only
 * an unauthenticated request reaches the legacy explicit actor above, which is
 * the shape the live smoke suites still send.
 */
export function readCurrentActorId(req: Request): string | null {
  return req.auth?.userId ?? readActorId(req);
}

export function readPagination(req: Request): PaginationQuery | null {
  const page = readPositiveInteger(req.query.page);
  const limit = readPositiveInteger(req.query.limit);

  if (page === null || limit === null) {
    return null;
  }

  return { page, limit };
}

/**
 * Reads the feed `limit`: undefined when the client sent none, null when the
 * value is not a positive integer. The controller turns null into the same 400
 * the paged listings return for an invalid `page` or `limit`.
 */
export function readFeedLimit(req: Request): number | undefined | null {
  return readPositiveInteger(req.query.limit);
}

/**
 * Reads the feed `cursor`: undefined when absent, null when present but empty
 * or repeated. The value itself is opaque, so it is only decoded by the feed
 * service, which owns the 400 for a cursor this API did not issue.
 */
export function readFeedCursor(req: Request): string | undefined | null {
  const value = req.query.cursor;

  if (value === undefined) {
    return undefined;
  }

  return isNonEmptyString(value) ? value.trim() : null;
}

function readPositiveInteger(value: unknown): number | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !/^[0-9]+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number.parseInt(value.trim(), 10);

  return parsed > 0 ? parsed : null;
}
