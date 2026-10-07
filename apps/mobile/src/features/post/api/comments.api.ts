import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  type Comment,
  type CommentListItem,
  type Paginated,
} from "@bridgeed/shared";
import { apiClient } from "@/services/api";

export interface FetchPostCommentsParams {
  postId: string;
  /** The student reading the comments: the API checks membership for this id. */
  actorId: string;
  /** One based page number, matching the API's paged endpoints. */
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Reads one page of a post's comments, oldest first, as served by the API.
 *
 * Unlike the feed, comments are paged by number, because a comment thread grows
 * from the end and page numbers stay meaningful.
 */
export async function fetchPostComments({
  postId,
  actorId,
  page = DEFAULT_PAGE,
  limit = DEFAULT_PAGE_SIZE,
  signal,
}: FetchPostCommentsParams): Promise<Paginated<CommentListItem>> {
  return apiClient.get<Paginated<CommentListItem>>(
    `/posts/${encodeURIComponent(postId)}/comments`,
    { query: { actorId, page, limit }, signal },
  );
}

export interface CreateCommentParams {
  postId: string;
  /** Author of the comment. */
  actorId: string;
  content: string;
  signal?: AbortSignal;
}

/**
 * Posts a comment on a post.
 *
 * Membership, ownership and content rules all live in the API, so this function
 * only trims the input enough to avoid sending whitespace, and surfaces whatever
 * the API rejects with.
 */
export async function createPostComment({
  postId,
  actorId,
  content,
  signal,
}: CreateCommentParams): Promise<Comment> {
  return apiClient.post<Comment>(
    `/posts/${encodeURIComponent(postId)}/comments`,
    {
      body: { actorId, content },
      signal,
    },
  );
}
