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
 * Reads the acting student from the request. Until authentication exists the
 * actor is supplied explicitly, either in the payload or in the query string,
 * using the same precedence as the community endpoints. Content endpoints use
 * `authorId` while reactions use `userId`, so both are accepted.
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

export function readPagination(req: Request): PaginationQuery | null {
  const page = readPositiveInteger(req.query.page);
  const limit = readPositiveInteger(req.query.limit);

  if (page === null || limit === null) {
    return null;
  }

  return { page, limit };
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
