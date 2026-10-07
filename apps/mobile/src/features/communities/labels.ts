import {
  COMMUNITY_MEMBERSHIP_STATUSES,
  COMMUNITY_MEMBER_ROLES,
  COMMUNITY_TYPES,
  type CommunityMemberRole,
  type CommunityMembershipStatus,
  type CommunityType,
} from "@bridgeed/shared";
import type { BadgeTone } from "@/components";

/**
 * Copy and colors for the community vocabulary.
 *
 * Every user facing string for a community type, membership status or member
 * role lives here, so the API enum values never reach a screen and the wording
 * stays consistent between the list, the detail screen and the member list.
 */

export const COMMUNITY_TYPE_LABELS: Record<CommunityType, string> = {
  [COMMUNITY_TYPES.PUBLIC]: "Public",
  [COMMUNITY_TYPES.PRIVATE]: "Private",
};

export const COMMUNITY_TYPE_TONES: Record<CommunityType, BadgeTone> = {
  [COMMUNITY_TYPES.PUBLIC]: "accent",
  [COMMUNITY_TYPES.PRIVATE]: "neutral",
};

/**
 * One sentence explaining what choosing a type means for a creator.
 *
 * The create form shows these beside each option so a student picks with the
 * consequence in view: a public group is joinable at once, a private one puts an
 * owner or an admin in front of every request.
 */
export const COMMUNITY_TYPE_DESCRIPTIONS: Record<CommunityType, string> = {
  [COMMUNITY_TYPES.PUBLIC]:
    "Anyone can find it in the directory and join straight away.",
  [COMMUNITY_TYPES.PRIVATE]:
    "It shows up in the directory, but an owner or an admin approves each request to join.",
};

export const MEMBERSHIP_STATUS_LABELS: Record<
  CommunityMembershipStatus,
  string
> = {
  [COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE]: "Joined",
  [COMMUNITY_MEMBERSHIP_STATUSES.PENDING]: "Pending",
  [COMMUNITY_MEMBERSHIP_STATUSES.REJECTED]: "Declined",
  [COMMUNITY_MEMBERSHIP_STATUSES.BANNED]: "Banned",
};

export const MEMBERSHIP_STATUS_TONES: Record<
  CommunityMembershipStatus,
  BadgeTone
> = {
  [COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE]: "success",
  [COMMUNITY_MEMBERSHIP_STATUSES.PENDING]: "warning",
  [COMMUNITY_MEMBERSHIP_STATUSES.REJECTED]: "danger",
  [COMMUNITY_MEMBERSHIP_STATUSES.BANNED]: "danger",
};

export const MEMBER_ROLE_LABELS: Record<CommunityMemberRole, string> = {
  [COMMUNITY_MEMBER_ROLES.OWNER]: "Owner",
  [COMMUNITY_MEMBER_ROLES.ADMIN]: "Admin",
  [COMMUNITY_MEMBER_ROLES.MODERATOR]: "Moderator",
  [COMMUNITY_MEMBER_ROLES.MEMBER]: "Member",
};

/** Role tone: only the roles that can manage a community stand out. */
export function roleTone(role: CommunityMemberRole): BadgeTone {
  return role === COMMUNITY_MEMBER_ROLES.MEMBER ||
    role === COMMUNITY_MEMBER_ROLES.MODERATOR
    ? "neutral"
    : "accent";
}

export function communityTypeLabel(type: CommunityType): string {
  return COMMUNITY_TYPE_LABELS[type] ?? "Community";
}

export function membershipStatusLabel(
  status: CommunityMembershipStatus,
): string {
  return MEMBERSHIP_STATUS_LABELS[status] ?? "Membership";
}

export function memberRoleLabel(role: CommunityMemberRole): string {
  return MEMBER_ROLE_LABELS[role] ?? "Member";
}

/** `1 member` / `12 members`. */
export function formatMemberCount(count: number): string {
  return `${count} ${count === 1 ? "member" : "members"}`;
}

/** `1 post` / `12 posts`. */
export function formatPostCount(count: number): string {
  return `${count} ${count === 1 ? "post" : "posts"}`;
}

/**
 * One sentence that explains what a membership status means for the reader.
 *
 * Screens use it instead of a bare badge so a student never has to guess why a
 * button is missing: a pending request, a rejection and a ban all look similar
 * until they are described.
 */
export function describeMembershipStatus(
  status: CommunityMembershipStatus,
  type: CommunityType,
): string {
  const isPrivate = type === COMMUNITY_TYPES.PRIVATE;

  switch (status) {
    case COMMUNITY_MEMBERSHIP_STATUSES.PENDING:
      return "An owner or an admin has to approve your request before you can read and write posts here.";
    case COMMUNITY_MEMBERSHIP_STATUSES.REJECTED:
      return isPrivate
        ? "Your request was declined. You can ask again and an owner or an admin will review the new request."
        : "Your request was declined. You can ask to join again.";
    case COMMUNITY_MEMBERSHIP_STATUSES.BANNED:
      return "You cannot join this community. Contact an owner or an admin if you think this is a mistake.";
    case COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE:
      return "You are a member of this community.";
    default:
      return "";
  }
}
