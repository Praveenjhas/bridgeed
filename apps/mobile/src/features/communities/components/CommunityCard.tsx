import { memo } from "react";
import {
  COMMUNITY_MEMBERSHIP_STATUSES,
  COMMUNITY_MEMBER_ROLES,
  type Community,
  type CommunityMembership,
} from "@bridgeed/shared";
import { Badge, CommunityRow } from "@/components";
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
   * Active member count. Only the member listing endpoint reports one, so rows
   * in the directory omit the count rather than showing a guessed number.
   */
  memberCount?: number | null;
  onPress: (community: Community) => void;
}

/**
 * One community in a list.
 *
 * It answers the two questions a student has while browsing: what kind of
 * community this is, and where they stand with it. The membership is only shown
 * when the caller knows it, so the row never claims "Joined" or "Pending" on a
 * guess. It is drawn as an editorial row, with the type and member count as a
 * quiet metadata line rather than a row of badges.
 */
export const CommunityCard = memo(function CommunityCard({
  community,
  membership = null,
  memberCount = null,
  onPress,
}: CommunityCardProps) {
  const typeLabel = communityTypeLabel(community.type);
  const isActive = membership?.status === COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE;
  const showsRole =
    isActive && membership?.role !== COMMUNITY_MEMBER_ROLES.MEMBER;
  const metaParts = [typeLabel];

  if (memberCount !== null) {
    metaParts.push(formatMemberCount(memberCount));
  }

  const labelParts = [
    `${community.name}, ${typeLabel.toLowerCase()} community`,
  ];

  if (membership) {
    labelParts.push(membershipStatusLabel(membership.status));
  }

  if (memberCount !== null) {
    labelParts.push(formatMemberCount(memberCount));
  }

  const trailing =
    membership || showsRole ? (
      <>
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
      </>
    ) : undefined;

  return (
    <CommunityRow
      name={community.name}
      description={community.description}
      meta={metaParts.join(" · ")}
      trailing={trailing}
      onPress={() => onPress(community)}
      accessibilityLabel={labelParts.join(", ")}
      accessibilityHint="Opens the community"
    />
  );
});
