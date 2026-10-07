import { useCallback } from "react";
import type { CommunityMembershipWithCommunity } from "@bridgeed/shared";
import { useAsyncValue, type LoadStatus } from "@/hooks/useAsyncValue";
import { fetchStudentMemberships } from "../api/memberships.api";

export interface CommunityMembershipsState {
  memberships: CommunityMembershipWithCommunity[];
  status: LoadStatus;
  errorMessage: string | null;
  isRefreshing: boolean;
  refresh: () => void;
  /** The membership row for one community, or null when there is none. */
  membershipFor: (
    communityId: string,
  ) => CommunityMembershipWithCommunity | null;
}

/**
 * Every community membership of the acting student, in one read.
 *
 * The API has no per community membership endpoint, so this list is the single
 * source of membership truth. Requesting it without a status filter returns the
 * pending, rejected and banned rows too, which is what lets a screen explain a
 * state instead of silently hiding the community.
 */
export function useCommunityMemberships(
  actorId: string | null,
): CommunityMembershipsState {
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!actorId) {
        throw new Error("A student is required to read memberships.");
      }

      return fetchStudentMemberships({ userId: actorId, signal });
    },
    [actorId],
  );

  const { data, status, errorMessage, isRefreshing, refresh } = useAsyncValue(
    load,
    Boolean(actorId),
  );

  const memberships = data ?? [];

  const membershipFor = useCallback(
    (communityId: string) =>
      memberships.find(
        (membership) => membership.communityId === communityId,
      ) ?? null,
    [memberships],
  );

  return {
    memberships,
    status,
    errorMessage,
    isRefreshing,
    refresh,
    membershipFor,
  };
}
