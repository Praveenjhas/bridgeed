import type { Response } from "express";
import {
  mapCommunityDomainError,
  type MappedHttpError,
} from "./community-errors";
import { REACTION_ALREADY_EXISTS_MESSAGE } from "../repositories/post-reaction.repository";
import {
  COMMENT_AUTHOR_REQUIRED_MESSAGE,
  COMMENT_CONTENT_INVALID_MESSAGE,
  COMMENT_CONTENT_REQUIRED_MESSAGE,
  COMMENT_CONTENT_TOO_LONG_MESSAGE,
  COMMENT_DELETED_MESSAGE,
  COMMENT_DELETE_FORBIDDEN_MESSAGE,
  COMMENT_EDIT_FORBIDDEN_MESSAGE,
  COMMENT_NOT_FOUND_MESSAGE,
} from "../services/comment.service";
import {
  POST_AUTHOR_REQUIRED_MESSAGE,
  POST_CONTENT_INVALID_MESSAGE,
  POST_CONTENT_REQUIRED_MESSAGE,
  POST_CONTENT_TOO_LONG_MESSAGE,
  POST_DELETED_MESSAGE,
  POST_DELETE_FORBIDDEN_MESSAGE,
  POST_EDIT_FORBIDDEN_MESSAGE,
  POST_NOT_FOUND_MESSAGE,
  POST_TYPE_INVALID_MESSAGE,
} from "../services/post.service";
import {
  REACTION_NOT_FOUND_MESSAGE,
  REACTION_TYPE_INVALID_MESSAGE,
  REACTION_USER_REQUIRED_MESSAGE,
} from "../services/reaction.service";
import {
  FEED_ACTOR_REQUIRED_MESSAGE,
  FEED_CURSOR_INVALID_MESSAGE,
  FEED_LIMIT_INVALID_MESSAGE,
} from "../services/feed.service";

/** Maps the post domain errors raised by the service layer onto HTTP errors. */
export function mapPostDomainError(error: unknown): MappedHttpError | null {
  const message = error instanceof Error ? error.message : undefined;

  switch (message) {
    case POST_NOT_FOUND_MESSAGE:
      return { status: 404, error: message };

    case POST_EDIT_FORBIDDEN_MESSAGE:
    case POST_DELETE_FORBIDDEN_MESSAGE:
      return { status: 403, error: message };

    case POST_AUTHOR_REQUIRED_MESSAGE:
    case POST_CONTENT_INVALID_MESSAGE:
    case POST_CONTENT_REQUIRED_MESSAGE:
    case POST_CONTENT_TOO_LONG_MESSAGE:
    case POST_TYPE_INVALID_MESSAGE:
      return { status: 400, error: message };

    case POST_DELETED_MESSAGE:
      return { status: 409, error: message };

    default:
      return null;
  }
}

/** Maps the comment domain errors raised by the service layer onto HTTP errors. */
export function mapCommentDomainError(error: unknown): MappedHttpError | null {
  const message = error instanceof Error ? error.message : undefined;

  switch (message) {
    case COMMENT_NOT_FOUND_MESSAGE:
      return { status: 404, error: message };

    case COMMENT_EDIT_FORBIDDEN_MESSAGE:
    case COMMENT_DELETE_FORBIDDEN_MESSAGE:
      return { status: 403, error: message };

    case COMMENT_AUTHOR_REQUIRED_MESSAGE:
    case COMMENT_CONTENT_INVALID_MESSAGE:
    case COMMENT_CONTENT_REQUIRED_MESSAGE:
    case COMMENT_CONTENT_TOO_LONG_MESSAGE:
      return { status: 400, error: message };

    case COMMENT_DELETED_MESSAGE:
      return { status: 409, error: message };

    default:
      return null;
  }
}

/** Maps the reaction domain errors raised by the service layer onto HTTP errors. */
export function mapReactionDomainError(error: unknown): MappedHttpError | null {
  const message = error instanceof Error ? error.message : undefined;

  switch (message) {
    case REACTION_NOT_FOUND_MESSAGE:
      return { status: 404, error: message };

    case REACTION_USER_REQUIRED_MESSAGE:
    case REACTION_TYPE_INVALID_MESSAGE:
      return { status: 400, error: message };

    case REACTION_ALREADY_EXISTS_MESSAGE:
      return { status: 409, error: message };

    default:
      return null;
  }
}

/**
 * Maps the feed domain errors raised by the service layer onto HTTP errors.
 * A feed cursor that this API did not issue, or a limit that is not a positive
 * integer, is a client error rather than a server one.
 */
export function mapFeedDomainError(error: unknown): MappedHttpError | null {
  const message = error instanceof Error ? error.message : undefined;

  switch (message) {
    case FEED_ACTOR_REQUIRED_MESSAGE:
    case FEED_LIMIT_INVALID_MESSAGE:
    case FEED_CURSOR_INVALID_MESSAGE:
      return { status: 400, error: message };

    default:
      return null;
  }
}

/**
 * Resolves a content domain error, reusing the community mapping for the
 * membership and profile rules that posts, comments and reactions share.
 */
export function mapContentDomainError(error: unknown): MappedHttpError | null {
  return (
    mapPostDomainError(error) ??
    mapCommentDomainError(error) ??
    mapReactionDomainError(error) ??
    mapFeedDomainError(error) ??
    mapCommunityDomainError(error)
  );
}

/**
 * Sends a mapped content error, and reports anything unmapped as a server
 * error so raw database errors are never leaked to clients.
 */
export function sendContentError(error: unknown, res: Response): void {
  const mapped = mapContentDomainError(error);

  if (mapped) {
    res.status(mapped.status).json({ error: mapped.error });
    return;
  }

  console.error(error);

  res.status(500).json({
    error: "Internal server error",
  });
}
