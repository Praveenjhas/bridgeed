import { useCallback } from "react";
import type { Community } from "@bridgeed/shared";
import { useAsyncValue, type LoadStatus } from "@/hooks/useAsyncValue";
import { fetchCommunity } from "../api/communities.api";

export interface CommunityState {
  community: Community | null;
  status: LoadStatus;
  errorMessage: string | null;
  isRefreshing: boolean;
  refresh: () => void;
}

/**
 * Loads one community.
 *
 * The id comes from the route, so `enabled` keeps the hook quiet until the route
 * actually carries one. The API's own messages are kept: a missing community
 * answers "Community not found", which is already what a reader needs to see.
 */
export function useCommunity(communityId: string | null): CommunityState {
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!communityId) {
        throw new Error("A community is required.");
      }

      return fetchCommunity({ communityId, signal });
    },
    [communityId],
  );

  const { data, status, errorMessage, isRefreshing, refresh } = useAsyncValue(
    load,
    Boolean(communityId),
  );

  return { community: data, status, errorMessage, isRefreshing, refresh };
}
