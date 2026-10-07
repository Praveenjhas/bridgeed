import { useCallback, useState } from "react";
import { toUserMessage } from "@/utils/errors";
import {
  approveMembership,
  rejectMembership,
  type MembershipDecision,
} from "../api/memberships.api";

export interface MembershipRequestActionsState {
  /** Approves or rejects one pending request. Ignores a repeat tap. */
  decide: (membershipId: string, decision: MembershipDecision) => void;
  /** Requests whose decision is currently in flight. */
  pendingMembershipIds: ReadonlySet<string>;
  actionErrorMessage: string | null;
  dismissActionError: () => void;
}

export interface UseMembershipRequestActionsOptions {
  actorId: string | null;
  /**
   * Called after the API accepted a decision. Must be referentially stable,
   * because it is a dependency of the returned callback.
   */
  onDecided: () => void;
}

/**
 * Approving and rejecting join requests.
 *
 * A row only disappears from the list once the API has accepted the decision and
 * the request list has been re-read, so the screen never shows an approval that
 * did not happen. Repeats are dropped while a decision is in flight, which is
 * what stops a double tap from deciding the same request twice.
 */
export function useMembershipRequestActions({
  actorId,
  onDecided,
}: UseMembershipRequestActionsOptions): MembershipRequestActionsState {
  const [pendingMembershipIds, setPendingMembershipIds] = useState<
    ReadonlySet<string>
  >(() => new Set<string>());
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null,
  );

  const decide = useCallback(
    (membershipId: string, decision: MembershipDecision) => {
      if (!actorId || pendingMembershipIds.has(membershipId)) {
        return;
      }

      setActionErrorMessage(null);
      setPendingMembershipIds((current) => new Set(current).add(membershipId));

      const request =
        decision === "approve"
          ? approveMembership({ membershipId, actorId })
          : rejectMembership({ membershipId, actorId });

      void request
        .then(() => {
          onDecided();
        })
        .catch((error: unknown) => {
          setActionErrorMessage(toUserMessage(error));
        })
        .finally(() => {
          setPendingMembershipIds((current) => {
            const next = new Set(current);
            next.delete(membershipId);
            return next;
          });
        });
    },
    [actorId, onDecided, pendingMembershipIds],
  );

  const dismissActionError = useCallback(() => {
    setActionErrorMessage(null);
  }, []);

  return {
    decide,
    pendingMembershipIds,
    actionErrorMessage,
    dismissActionError,
  };
}
