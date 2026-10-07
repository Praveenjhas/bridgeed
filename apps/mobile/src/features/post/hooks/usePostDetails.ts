import { useCallback } from "react";
import type { PostDetails } from "@bridgeed/shared";
import { useAsyncValue, type LoadStatus } from "@/hooks/useAsyncValue";
import { fetchPostById } from "../api/posts.api";

export interface PostDetailsState {
  post: PostDetails | null;
  status: LoadStatus;
  errorMessage: string | null;
  isRefreshing: boolean;
  refresh: () => void;
}

/**
 * Loads one post, with no loading at all until both ids are known.
 *
 * The id comes from the route and the actor from configuration, so `enabled`
 * keeps the hook from firing a request that is guaranteed to fail.
 */
export function usePostDetails(
  postId: string | null,
  actorId: string | null,
): PostDetailsState {
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!postId || !actorId) {
        throw new Error("A post and an actor are both required.");
      }

      return fetchPostById({ postId, actorId, signal });
    },
    [actorId, postId],
  );

  const { data, status, errorMessage, isRefreshing, refresh } = useAsyncValue(
    load,
    Boolean(postId && actorId),
  );

  return { post: data, status, errorMessage, isRefreshing, refresh };
}
