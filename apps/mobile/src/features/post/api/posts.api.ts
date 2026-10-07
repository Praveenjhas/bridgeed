import type { PostDetails } from "@bridgeed/shared";
import { apiClient } from "@/services/api";

export interface FetchPostParams {
  postId: string;
  /** The student reading the post: the API checks membership for this id. */
  actorId: string;
  signal?: AbortSignal;
}

/**
 * Reads a single post with its author, community and engagement counts.
 *
 * The API answers 403 when the actor is not a member of the community the post
 * belongs to, and 404 when the post is missing or deleted. Both messages are
 * already user facing, so callers show them as they are.
 */
export async function fetchPostById({
  postId,
  actorId,
  signal,
}: FetchPostParams): Promise<PostDetails> {
  return apiClient.get<PostDetails>(`/posts/${encodeURIComponent(postId)}`, {
    query: { actorId },
    signal,
  });
}
