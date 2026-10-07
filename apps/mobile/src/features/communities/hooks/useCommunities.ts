import { useCallback, useState } from "react";
import { DEFAULT_PAGE, type Community } from "@bridgeed/shared";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import type { LoadStatus } from "@/hooks/useAsyncValue";
import { COMMUNITIES_PAGE_LIMIT } from "../constants";
import { fetchCommunities } from "../api/communities.api";

export interface CommunitiesState {
  communities: Community[];
  /** Total number of communities the API reports. */
  total: number | null;
  status: LoadStatus;
  errorMessage: string | null;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  refresh: () => void;
  loadMore: () => void;
}

/**
 * The community directory, one page at a time.
 *
 * The endpoint is paged by number rather than by cursor, so the page number is
 * used as the list cursor: communities are created rarely enough that a page
 * boundary stays meaningful between requests. Nothing is fetched before the app
 * knows which student it is acting as, because the screen that uses this list
 * pairs it with that student's memberships.
 */
export function useCommunities(actorId: string | null): CommunitiesState {
  const [total, setTotal] = useState<number | null>(null);

  const loadPage = useCallback(
    async (page: number | null, signal: AbortSignal) => {
      if (!actorId) {
        return { items: [] as Community[], nextCursor: null };
      }

      const requestedPage = page ?? DEFAULT_PAGE;
      const result = await fetchCommunities({
        page: requestedPage,
        limit: COMMUNITIES_PAGE_LIMIT,
        signal,
      });

      setTotal(result.total);

      return {
        items: result.items,
        nextCursor:
          requestedPage < result.totalPages ? requestedPage + 1 : null,
      };
    },
    [actorId],
  );

  const list = usePaginatedList<Community, number>({
    loadPage,
    enabled: actorId !== null,
  });

  return {
    communities: list.items,
    total,
    status: list.status,
    errorMessage: list.errorMessage,
    isRefreshing: list.isRefreshing,
    isLoadingMore: list.isLoadingMore,
    hasMore: list.hasMore,
    refresh: list.refresh,
    loadMore: list.loadMore,
  };
}
