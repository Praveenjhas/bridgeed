import { memo } from "react";
import { StyleSheet, View } from "react-native";
import {
  COMMUNITY_MEMBERSHIP_STATUSES,
  COMMUNITY_MEMBER_ROLES,
  type Community,
  type CommunityMembership,
} from "@bridgeed/shared";
import { AppText, Badge, Card, Icon } from "@/components";
import { useTheme } from "@/theme";
import {
  COMMUNITY_TYPE_TONES,
  MEMBERSHIP_STATUS_TONES,
  communityTypeLabel,
  formatMemberCount,
  memberRoleLabel,
  membershipStatusLabel,
  roleTone,
} from "../labels";

export interface CommunityCardProps {
  community: Community;
  /** The reader's membership, when the screen knows it. */
  membership?: CommunityMembership | null;
  /**
   * Active member count. Only the member listing endpoint reports one, so cards
   * in the directory omit the count rather than showing a guessed number.
   */
  memberCount?: number | null;
  onPress: (community: Community) => void;
}

/**
 * One community in a list.
 *
 * The card answers the two questions a student has while browsing: what kind of
 * community this is, and where they stand with it. The membership is only shown
 * when the caller knows it, so a card never claims "Joined" or "Pending" on a
 * guess.
 */
export const CommunityCard = memo(function CommunityCard({
  community,
  membership = null,
  memberCount = null,
  onPress,
}: CommunityCardProps) {
  const { layout, spacing } = useTheme();
  const typeLabel = communityTypeLabel(community.type);
  const isActive = membership?.status === COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE;
  const showsRole =
    isActive && membership?.role !== COMMUNITY_MEMBER_ROLES.MEMBER;
  const labelParts = [
    `${community.name}, ${typeLabel.toLowerCase()} community`,
  ];

  if (membership) {
    labelParts.push(membershipStatusLabel(membership.status));
  }

  if (memberCount !== null) {
    labelParts.push(formatMemberCount(memberCount));
  }

  return (
    <Card
      onPress={() => onPress(community)}
      accessibilityLabel={labelParts.join(", ")}
      accessibilityHint="Opens the community"
    >
      <View style={{ gap: spacing.sm }}>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <AppText variant="heading" style={styles.title} numberOfLines={2}>
            {community.name}
          </AppText>
          <Badge
            label={typeLabel}
            tone={COMMUNITY_TYPE_TONES[community.type]}
          />
        </View>

        {community.description ? (
          <AppText variant="body" tone="secondary" numberOfLines={3}>
            {community.description}
          </AppText>
        ) : null}

        <View style={[styles.row, { gap: spacing.sm }]}>
          {membership ? (
            <Badge
              label={membershipStatusLabel(membership.status)}
              tone={MEMBERSHIP_STATUS_TONES[membership.status]}
            />
          ) : null}
          {showsRole && membership ? (
            <Badge
              label={memberRoleLabel(membership.role)}
              tone={roleTone(membership.role)}
            />
          ) : null}
          {memberCount !== null ? (
            <AppText variant="caption" tone="muted">
              {formatMemberCount(memberCount)}
            </AppText>
          ) : null}
          <View style={styles.spacer} />
          <Icon name="chevron-forward" size={16} tone="textDisabled" />
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    flex: 1,
  },
  spacer: {
    flex: 1,
  },
});
