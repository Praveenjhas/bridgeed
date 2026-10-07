import { REACTION_TYPES, type PostReaction } from "@bridgeed/shared";
import { apiClient } from "@/services/api";

export interface PostReactionParams {
  postId: string;
  /** The student performing the reaction. */
  actorId: string;
  signal?: AbortSignal;
}

/**
 * Adds the actor's like to a post.
 *
 * The API stores at most one reaction per post and user, so calling this twice
 * is safe and the response describes the reaction that now exists.
 */
export async function likePost({
  postId,
  actorId,
  signal,
}: PostReactionParams): Promise<PostReaction> {
  return apiClient.post<PostReaction>(
    `/posts/${encodeURIComponent(postId)}/reactions`,
    {
      body: { actorId, type: REACTION_TYPES.LIKE },
      signal,
    },
  );
}

/**
 * Removes the actor's like. The endpoint answers 204 with no body, and removing
 * a like that is not there is not an error.
 */
export async function unlikePost({
  postId,
  actorId,
  signal,
}: PostReactionParams): Promise<void> {
  await apiClient.remove<void>(
    `/posts/${encodeURIComponent(postId)}/reactions`,
    {
      query: { actorId },
      signal,
    },
  );
}
