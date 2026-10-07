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
 * Loads one post, with no loading at all until the post is known and a session
 * exists.
 *
 * The id comes from the route and the reader is read by the API from the bearer
 * token, so `actorId` only gates whether there is a session to read with; it is
 * never sent. `enabled` keeps the hook from firing a request that is guaranteed
 * to fail.
 */
export function usePostDetails(
  postId: string | null,
  actorId: string | null,
): PostDetailsState {
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!postId || !actorId) {
        throw new Error("A post and a session are both required.");
      }

      return fetchPostById({ postId, signal });
    },
    [actorId, postId],
  );

  const { data, status, errorMessage, isRefreshing, refresh } = useAsyncValue(
    load,
    Boolean(postId && actorId),
  );

  return { post: data, status, errorMessage, isRefreshing, refresh };
}
