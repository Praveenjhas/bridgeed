import type { PostDetails } from "@bridgeed/shared";
import { apiClient } from "@/services/api";

export interface FetchPostParams {
  postId: string;
  signal?: AbortSignal;
}

/**
 * Reads a single post with its author, community and engagement counts.
 *
 * The reader is the signed-in account, taken by the API from the bearer token,
 * so no actor id is sent. The API answers 403 when that account is not a member
 * of the community the post belongs to, and 404 when the post is missing or
 * deleted. Both messages are already user facing, so callers show them as they
 * are.
 */
export async function fetchPostById({
  postId,
  signal,
}: FetchPostParams): Promise<PostDetails> {
  return apiClient.get<PostDetails>(`/posts/${encodeURIComponent(postId)}`, {
    signal,
  });
}
