import { ActivityIndicator, Alert, View } from "react-native";
import {
  COMMUNITY_MEMBERSHIP_STATUSES,
  COMMUNITY_MEMBER_ROLES,
  COMMUNITY_TYPES,
  type CommunityMembership,
  type CommunityType,
} from "@bridgeed/shared";
import { AppText, Badge, Button, InlineError } from "@/components";
import { useTheme } from "@/theme";
import {
  MEMBERSHIP_STATUS_TONES,
  describeMembershipStatus,
  membershipStatusLabel,
} from "../labels";

export interface MembershipActionsProps {
  communityType: CommunityType;
  membership: CommunityMembership | null;
  /** True while the membership of the reader is still being read. */
  isChecking: boolean;
  /** Explains a failed membership read, which blocks every action. */
  readErrorMessage?: string | null;
  onRetryRead?: () => void;
  /** True when the API can still be asked to let the reader in. */
  canRequestJoin: boolean;
  /** True when leaving or cancelling is possible for this membership. */
  canLeave: boolean;
  isActionPending: boolean;
  actionErrorMessage: string | null;
  onDismissActionError: () => void;
  onJoin: () => void;
  onLeave: () => void;
}

/**
 * The membership block of a community: where the reader stands, and the one
 * action that changes it.
 *
 * The button is chosen from the backend's own rules rather than from the screen's
 * optimism: a banned reader is told why, an owner is never offered a leave the
 * API would refuse, and a pending request cannot be sent twice. Leaving asks for
 * confirmation first, because for a public community it is the only destructive
 * action on the screen.
 */
export function MembershipActions({
  communityType,
  membership,
  isChecking,
  readErrorMessage = null,
  onRetryRead,
  canRequestJoin,
  canLeave,
  isActionPending,
  actionErrorMessage,
  onDismissActionError,
  onJoin,
  onLeave,
}: MembershipActionsProps) {
  const { colors, spacing } = useTheme();
  const isPrivate = communityType === COMMUNITY_TYPES.PRIVATE;
  const status = membership?.status ?? null;
  const isPending = status === COMMUNITY_MEMBERSHIP_STATUSES.PENDING;
  const isOwner =
    status === COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE &&
    membership?.role === COMMUNITY_MEMBER_ROLES.OWNER;

  const confirmLeave = () => {
    Alert.alert(
      isPending ? "Cancel join request" : "Leave community",
      isPending
        ? "Your request will be withdrawn. You can ask to join again later."
        : "You will need to join again to read and write posts here.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: isPending ? "Cancel request" : "Leave",
          style: "destructive",
          onPress: onLeave,
        },
      ],
    );
  };

  if (isChecking) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
        }}
      >
        <ActivityIndicator size="small" color={colors.textMuted} />
        <AppText variant="caption" tone="muted">
          Checking your membership
        </AppText>
      </View>
    );
  }

  if (readErrorMessage) {
    return (
      <View style={{ gap: spacing.sm }}>
        <InlineError
          message={readErrorMessage}
          onRetry={onRetryRead}
          retryLabel="Check again"
        />
        <AppText variant="caption" tone="muted">
          Membership actions stay hidden until the app knows where you stand.
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {status ? (
        <Badge
          label={membershipStatusLabel(status)}
          tone={MEMBERSHIP_STATUS_TONES[status]}
        />
      ) : null}

      {status ? (
        <AppText variant="caption" tone="muted">
          {describeMembershipStatus(status, communityType)}
        </AppText>
      ) : null}

      {actionErrorMessage ? (
        <InlineError
          message={actionErrorMessage}
          onDismiss={onDismissActionError}
        />
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          flexWrap: "wrap",
        }}
      >
        {canRequestJoin ? (
          <Button
            label={isPrivate ? "Request to join" : "Join community"}
            icon="log-in-outline"
            loading={isActionPending}
            onPress={onJoin}
          />
        ) : null}

        {canLeave ? (
          <Button
            label={isPending ? "Cancel request" : "Leave"}
            variant="secondary"
            icon="log-out-outline"
            loading={isActionPending}
            onPress={confirmLeave}
          />
        ) : null}

        {isOwner ? (
          <AppText variant="caption" tone="muted">
            You own this community, so you cannot leave it.
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
