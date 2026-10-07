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
  /** One based page number, matching the API's paged endpoints. */
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Reads one page of a post's comments, oldest first, as served by the API.
 *
 * The reader is the signed-in account, taken by the API from the bearer token,
 * so no actor id is sent. Unlike the feed, comments are paged by number, because
 * a comment thread grows from the end and page numbers stay meaningful.
 */
export async function fetchPostComments({
  postId,
  page = DEFAULT_PAGE,
  limit = DEFAULT_PAGE_SIZE,
  signal,
}: FetchPostCommentsParams): Promise<Paginated<CommentListItem>> {
  return apiClient.get<Paginated<CommentListItem>>(
    `/posts/${encodeURIComponent(postId)}/comments`,
    { query: { page, limit }, signal },
  );
}

export interface CreateCommentParams {
  postId: string;
  content: string;
  signal?: AbortSignal;
}

/**
 * Posts a comment on a post.
 *
 * The author is the signed-in account, taken by the API from the bearer token,
 * so the body carries only the content. Membership, ownership and content rules
 * all live in the API, so this function only trims the input enough to avoid
 * sending whitespace, and surfaces whatever the API rejects with.
 */
export async function createPostComment({
  postId,
  content,
  signal,
}: CreateCommentParams): Promise<Comment> {
  return apiClient.post<Comment>(
    `/posts/${encodeURIComponent(postId)}/comments`,
    {
      body: { content },
      signal,
    },
  );
}
