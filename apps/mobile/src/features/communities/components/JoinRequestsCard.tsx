import { View } from "react-native";
import type { CommunityMember } from "@bridgeed/shared";
import {
  AppText,
  Button,
  Card,
  Divider,
  InlineError,
  LoadingState,
  SectionHeading,
} from "@/components";
import { useTheme } from "@/theme";
import type { LoadStatus } from "@/hooks/useAsyncValue";
import type { MembershipDecision } from "../api/memberships.api";
import { MemberRow } from "./MemberRow";

export interface JoinRequestsCardProps {
  requests: CommunityMember[];
  total: number | null;
  status: LoadStatus;
  errorMessage: string | null;
  isLoadingMore: boolean;
  hasMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  /** Requests whose decision is currently in flight. */
  pendingMembershipIds: ReadonlySet<string>;
  actionErrorMessage: string | null;
  onDismissActionError: () => void;
  onDecide: (membershipId: string, decision: MembershipDecision) => void;
}

/**
 * Pending join requests, for owners and admins.
 *
 * It is the other half of the membership lifecycle: a private community only
 * becomes reachable for a student once somebody here approves them, so the
 * decision lives in the app rather than only in the database. A request stays on
 * screen until the API confirms the decision, and repeats are ignored while one
 * is in flight.
 */
export function JoinRequestsCard({
  requests,
  total,
  status,
  errorMessage,
  isLoadingMore,
  hasMore,
  onRefresh,
  onLoadMore,
  pendingMembershipIds,
  actionErrorMessage,
  onDismissActionError,
  onDecide,
}: JoinRequestsCardProps) {
  const { spacing } = useTheme();
  const isFirstLoad = status === "loading" && requests.length === 0;

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <SectionHeading
          title="Join requests"
          hint={
            total === null
              ? "Students waiting for a decision"
              : `${total} waiting for a decision`
          }
        />

        {actionErrorMessage ? (
          <InlineError
            message={actionErrorMessage}
            onDismiss={onDismissActionError}
          />
        ) : null}

        {isFirstLoad ? (
          // The card sits inside a header, so the state is kept compact instead
          // of taking the whole screen.
          <LoadingState label="Loading join requests" style={{ flex: 0 }} />
        ) : null}

        {errorMessage && requests.length === 0 ? (
          <InlineError
            message={errorMessage}
            onRetry={onRefresh}
            retryLabel="Try again"
          />
        ) : null}

        {status === "ready" && requests.length === 0 ? (
          <AppText variant="caption" tone="muted">
            Nobody is waiting to join right now.
          </AppText>
        ) : null}

        {requests.map((request, index) => (
          <View key={request.id} style={{ gap: spacing.md }}>
            {index > 0 ? <Divider /> : null}
            <MemberRow
              member={request}
              action={
                <>
                  <Button
                    label="Approve"
                    size="sm"
                    icon="checkmark"
                    loading={pendingMembershipIds.has(request.id)}
                    disabled={pendingMembershipIds.has(request.id)}
                    onPress={() => onDecide(request.id, "approve")}
                  />
                  <Button
                    label="Decline"
                    size="sm"
                    variant="destructive"
                    disabled={pendingMembershipIds.has(request.id)}
                    onPress={() => onDecide(request.id, "reject")}
                  />
                </>
              }
            />
          </View>
        ))}

        {hasMore ? (
          <Button
            label="Load more requests"
            variant="secondary"
            size="sm"
            fullWidth
            loading={isLoadingMore}
            onPress={onLoadMore}
          />
        ) : null}
      </View>
    </Card>
  );
}
