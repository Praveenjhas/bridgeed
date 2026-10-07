import { useCallback, useState } from "react";
import { DEFAULT_PAGE, type StudentProfile } from "@bridgeed/shared";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import type { LoadStatus } from "@/hooks/useAsyncValue";
import { STUDENT_DIRECTORY_PAGE_LIMIT } from "../constants";
import { fetchStudentDirectory } from "../api/students.api";

/**
 * A directory row: a student profile plus the key a paginated list needs.
 *
 * A student is identified by its `userId`, not by an `id`, so the profile is
 * carried through with an added `id` equal to it. That lets the shared
 * paginated-list hook de-duplicate pages by identity without a second field on
 * the API contract.
 */
export interface DirectoryStudent extends StudentProfile {
  id: string;
}

export interface StudentDirectoryState {
  students: DirectoryStudent[];
  /** Total number of students the API reports, excluding the reader. */
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
 * The student directory, one page at a time.
 *
 * The endpoint is paged by number rather than by cursor, so the page number is
 * used as the list cursor, exactly like the community directory. Nothing is
 * fetched before the app knows which student it is acting as, because the reader
 * is the identity the directory excludes.
 */
export function useStudentDirectory(
  actorId: string | null,
): StudentDirectoryState {
  const [total, setTotal] = useState<number | null>(null);

  const loadPage = useCallback(
    async (page: number | null, signal: AbortSignal) => {
      if (!actorId) {
        return { items: [] as DirectoryStudent[], nextCursor: null };
      }

      const requestedPage = page ?? DEFAULT_PAGE;
      const result = await fetchStudentDirectory({
        page: requestedPage,
        limit: STUDENT_DIRECTORY_PAGE_LIMIT,
        signal,
      });

      setTotal(result.total);

      return {
        items: result.items.map(
          (profile): DirectoryStudent => ({ ...profile, id: profile.userId }),
        ),
        nextCursor:
          requestedPage < result.totalPages ? requestedPage + 1 : null,
      };
    },
    [actorId],
  );

  const list = usePaginatedList<DirectoryStudent, number>({
    loadPage,
    enabled: actorId !== null,
  });

  return {
    students: list.items,
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
