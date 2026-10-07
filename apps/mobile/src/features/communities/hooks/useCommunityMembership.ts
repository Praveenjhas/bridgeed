import { useCallback, useMemo, useState } from "react";
import {
  COMMUNITY_MANAGER_ROLES,
  COMMUNITY_MEMBERSHIP_STATUSES,
  COMMUNITY_MEMBER_ROLES,
  type CommunityMembership,
} from "@bridgeed/shared";
import { ApiError } from "@/services/api";
import { toUserMessage } from "@/utils/errors";
import type { LoadStatus } from "@/hooks/useAsyncValue";
import { joinCommunity, leaveCommunity } from "../api/memberships.api";
import { useCommunityMemberships } from "./useCommunityMemberships";

export interface CommunityMembershipState {
  /** The acting student's membership row, or null when there is none. */
  membership: CommunityMembership | null;
  status: LoadStatus;
  errorMessage: string | null;
  isRefreshing: boolean;
  refresh: () => void;
  /** Active member: the only state in which posts are readable and writable. */
  isMember: boolean;
  isPending: boolean;
  isRejected: boolean;
  isBanned: boolean;
  isOwner: boolean;
  /** Active owner or admin, so the member list can offer join decisions. */
  canManageMembers: boolean;
  /** True when asking to join is a state the API can still reach. */
  canRequestJoin: boolean;
  /** False for banned, rejected and owner memberships, which the API refuses. */
  canLeave: boolean;
  isActionPending: boolean;
  actionErrorMessage: string | null;
  dismissActionError: () => void;
  /** Joins or requests to join. Resolves true when the API accepted it. */
  join: () => Promise<boolean>;
  /** Leaves the community, or withdraws a pending request. */
  leave: () => Promise<boolean>;
}

/**
 * The acting student's membership of one community, plus the two actions that
 * change it.
 *
 * The state always comes from `GET /student-profiles/:userId/communities` rather
 * than from the request the app just sent, so a conflict (for example "you are
 * already an active member") corrects the screen instead of being argued with.
 * Every derived flag is expressed here, so a button is never rendered for an
 * action the API would refuse.
 */
export function useCommunityMembership(
  communityId: string | null,
  actorId: string | null,
): CommunityMembershipState {
  const memberships = useCommunityMemberships(actorId);
  const { membershipFor, refresh } = memberships;
  const [isActionPending, setIsActionPending] = useState(false);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null,
  );

  const membership = useMemo(
    () => (communityId ? membershipFor(communityId) : null),
    [communityId, membershipFor],
  );

  const isMember = membership?.status === COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE;
  const isPending =
    membership?.status === COMMUNITY_MEMBERSHIP_STATUSES.PENDING;
  const isRejected =
    membership?.status === COMMUNITY_MEMBERSHIP_STATUSES.REJECTED;
  const isBanned = membership?.status === COMMUNITY_MEMBERSHIP_STATUSES.BANNED;
  const isOwner = membership?.role === COMMUNITY_MEMBER_ROLES.OWNER;
  const canManageMembers =
    isMember && COMMUNITY_MANAGER_ROLES.includes(membership?.role ?? "member");
  // Asking again is only meaningful when the API can still change this row: an
  // absent membership starts one, a rejected one is reopened, while a ban, a
  // pending request and an active membership are all conflicts.
  const canRequestJoin = !membership || isRejected;
  // Leaving covers active members and pending requests. The owner can never
  // leave their own community, and a ban or a rejection has nothing to leave.
  const canLeave =
    membership !== null && !isBanned && !isRejected && !(isMember && isOwner);

  const runAction = useCallback(
    async (action: (signal: AbortSignal) => Promise<unknown>) => {
      if (isActionPending) {
        return false;
      }

      const controller = new AbortController();
      setIsActionPending(true);
      setActionErrorMessage(null);

      try {
        await action(controller.signal);
        refresh();
        return true;
      } catch (error) {
        setActionErrorMessage(toUserMessage(error));

        // A conflict means the membership the screen was showing is out of
        // date, so the list is re-read and the UI stops offering the action.
        if (error instanceof ApiError && error.status === 409) {
          refresh();
        }

        return false;
      } finally {
        setIsActionPending(false);
      }
    },
    [isActionPending, refresh],
  );

  const join = useCallback(async () => {
    if (!communityId || !actorId) {
      return false;
    }

    return runAction((signal) =>
      joinCommunity({ communityId, userId: actorId, signal }),
    );
  }, [actorId, communityId, runAction]);

  const leave = useCallback(async () => {
    if (!communityId || !actorId || !canLeave) {
      return false;
    }

    return runAction((signal) =>
      leaveCommunity({ communityId, actorId, signal }),
    );
  }, [actorId, canLeave, communityId, runAction]);

  const dismissActionError = useCallback(() => {
    setActionErrorMessage(null);
  }, []);

  return {
    membership,
    status: memberships.status,
    errorMessage: memberships.errorMessage,
    isRefreshing: memberships.isRefreshing,
    refresh,
    isMember,
    isPending,
    isRejected,
    isBanned,
    isOwner,
    canManageMembers,
    canRequestJoin,
    canLeave,
    isActionPending,
    actionErrorMessage,
    dismissActionError,
    join,
    leave,
  };
}
