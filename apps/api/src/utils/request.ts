import type { Request } from "express";
import {
  POST_TYPE_VALUES,
  SEARCH_TYPE_VALUES,
  type PostType,
  type SearchType,
} from "@bridgeed/shared";

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

/**
 * Reads a `search` query value: undefined when absent, null when present but not
 * a single string, and otherwise the trimmed term. An empty term is kept as `""`
 * and simply means "no search", which is cheaper than treating it as an error.
 */
export function readSearchQuery(req: Request): string | undefined | null {
  const { search } = req.query;

  if (search === undefined) {
    return undefined;
  }

  return typeof search === "string" ? search.trim() : null;
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
 * Reads the `q` of a search request: undefined when absent, null when present but
 * not a single string (a repeated `?q=a&q=b` arrives as an array), and otherwise
 * the trimmed term. A term that was only whitespace is kept as `""`, because
 * "you sent nothing" is a different answer from "you sent no request at all" and
 * only the controller can say which response that deserves.
 */
export function readSearchTerm(req: Request): string | undefined | null {
  const { q } = req.query;

  if (q === undefined) {
    return undefined;
  }

  return typeof q === "string" ? q.trim() : null;
}

/**
 * Reads the optional `type` of a search request: undefined when absent, null when
 * present but not one of `SEARCH_TYPE_VALUES` (which includes a repeated value,
 * an empty value and an unknown one), and otherwise the narrowed type.
 */
export function readSearchType(req: Request): SearchType | undefined | null {
  const { type } = req.query;

  if (type === undefined) {
    return undefined;
  }

  if (typeof type !== "string") {
    return null;
  }

  const candidate = type.trim();

  return SEARCH_TYPE_VALUES.find((value) => value === candidate) ?? null;
}

/**
 * Reads the optional `type` of a community post listing.
 *
 * `undefined` when the client sent none, `null` when the value is not a single
 * string or not one of the canonical post types, and otherwise the narrowed type.
 * The controller turns `null` into a 400, so an unknown filter is refused rather
 * than silently ignored — a client that asks for "questions" and receives every
 * post would look like it worked.
 */
export function readPostType(req: Request): PostType | undefined | null {
  const { type } = req.query;

  if (type === undefined) {
    return undefined;
  }

  if (typeof type !== "string") {
    return null;
  }

  const candidate = type.trim().toLowerCase();

  return POST_TYPE_VALUES.find((value) => value === candidate) ?? null;
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
