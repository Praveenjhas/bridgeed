import { useCallback, useState } from "react";
import { DEFAULT_PAGE, type UniversitySummary } from "@bridgeed/shared";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import type { LoadStatus } from "@/hooks/useAsyncValue";
import { UNIVERSITIES_PAGE_LIMIT } from "../constants";
import { fetchUniversityDirectory } from "../api/universities.api";

export interface UniversityDirectoryState {
  universities: UniversitySummary[];
  /** Total number of universities the API reports for the current search. */
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
 * The university directory, one page at a time.
 *
 * The endpoint is paged by number rather than by cursor, so the page number is
 * used as the list cursor, exactly like the community and student directories.
 * `search` is part of the loader's identity, so typing a new term restarts the
 * list from page one — the search is answered by the API, not filtered locally,
 * because the directory cannot be assumed to be fully loaded.
 */
export function useUniversityDirectory(
  search: string,
): UniversityDirectoryState {
  const [total, setTotal] = useState<number | null>(null);

  const loadPage = useCallback(
    async (page: number | null, signal: AbortSignal) => {
      const requestedPage = page ?? DEFAULT_PAGE;
      const result = await fetchUniversityDirectory({
        page: requestedPage,
        limit: UNIVERSITIES_PAGE_LIMIT,
        search,
        signal,
      });

      setTotal(result.total);

      return {
        items: result.items,
        nextCursor:
          requestedPage < result.totalPages ? requestedPage + 1 : null,
      };
    },
    [search],
  );

  const list = usePaginatedList<UniversitySummary, number>({ loadPage });

  return {
    universities: list.items,
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
