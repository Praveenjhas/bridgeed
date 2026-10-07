import { useCallback, useState } from "react";
import {
  DEFAULT_PAGE,
  type CommunityMember,
  type CommunityMembershipStatus,
} from "@bridgeed/shared";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import type { LoadStatus } from "@/hooks/useAsyncValue";
import { MEMBERS_PAGE_LIMIT } from "../constants";
import { fetchCommunityMembers } from "../api/memberships.api";

export interface UseCommunityMembersOptions {
  /** Status to list. Omitted lists active members, as the API defaults to. */
  status?: CommunityMembershipStatus | null;
  pageSize?: number;
  /**
   * Keeps the request off until the reader is allowed to see the roster, which
   * matters for a private community they are not a member of.
   */
  enabled?: boolean;
}

export interface CommunityMembersState {
  members: CommunityMember[];
  /** Total the API reports for this status, or null before the first read. */
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
 * The member list of one community, for one membership status.
 *
 * The same hook serves the members screen and the owner/admin join request list,
 * because both are the same paged endpoint with a different status filter.
 */
export function useCommunityMembers(
  communityId: string | null,
  {
    status: membershipStatus = null,
    pageSize = MEMBERS_PAGE_LIMIT,
    enabled = true,
  }: UseCommunityMembersOptions = {},
): CommunityMembersState {
  const [total, setTotal] = useState<number | null>(null);

  const loadPage = useCallback(
    async (page: number | null, signal: AbortSignal) => {
      if (!communityId) {
        return { items: [] as CommunityMember[], nextCursor: null };
      }

      const requestedPage = page ?? DEFAULT_PAGE;
      const result = await fetchCommunityMembers({
        communityId,
        status: membershipStatus,
        page: requestedPage,
        limit: pageSize,
        signal,
      });

      setTotal(result.total);

      return {
        items: result.items,
        nextCursor:
          requestedPage < result.totalPages ? requestedPage + 1 : null,
      };
    },
    [communityId, membershipStatus, pageSize],
  );

  const list = usePaginatedList<CommunityMember, number>({
    loadPage,
    enabled: enabled && communityId !== null,
  });

  return {
    members: list.items,
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
