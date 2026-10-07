import { REACTION_TYPES, type PostReaction } from "@bridgeed/shared";
import { apiClient } from "@/services/api";

export interface PostReactionParams {
  postId: string;
  signal?: AbortSignal;
}

/**
 * Adds the signed-in student's like to a post.
 *
 * The reacting account is taken by the API from the bearer token, so nobody can
 * like on another student's behalf. The API stores at most one reaction per post
 * and user, so calling this twice is safe and the response describes the
 * reaction that now exists.
 */
export async function likePost({
  postId,
  signal,
}: PostReactionParams): Promise<PostReaction> {
  return apiClient.post<PostReaction>(
    `/posts/${encodeURIComponent(postId)}/reactions`,
    {
      body: { type: REACTION_TYPES.LIKE },
      signal,
    },
  );
}

/**
 * Removes the signed-in student's like. The endpoint answers 204 with no body,
 * and removing a like that is not there is not an error.
 */
export async function unlikePost({
  postId,
  signal,
}: PostReactionParams): Promise<void> {
  await apiClient.remove<void>(
    `/posts/${encodeURIComponent(postId)}/reactions`,
    { signal },
  );
}
