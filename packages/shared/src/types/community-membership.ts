import type { Community, CommunityMemberRole } from "./community";

export const COMMUNITY_MEMBERSHIP_STATUSES = {
  PENDING: "pending",
  ACTIVE: "active",
  REJECTED: "rejected",
  BANNED: "banned",
} as const;

export type CommunityMembershipStatus =
  (typeof COMMUNITY_MEMBERSHIP_STATUSES)[keyof typeof COMMUNITY_MEMBERSHIP_STATUSES];

export interface CommunityMembership {
  id: string;
  communityId: string;
  userId: string;
  role: CommunityMemberRole;
  status: CommunityMembershipStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Public subset of a member's profile. Never exposes account level data such
 * as email, so membership responses stay safe to share with other students.
 */
export interface CommunityMembershipMemberInfo {
  userId: string;
  name: string;
  username: string;
  profileImageUrl: string | null;
}

/** A membership enriched with the member's public profile information. */
export interface CommunityMember extends CommunityMembership {
  member: CommunityMembershipMemberInfo;
}

/** A membership enriched with the community it belongs to. */
export interface CommunityMembershipWithCommunity extends CommunityMembership {
  community: Community;
}

/** A membership enriched with both the member and the community information. */
export interface CommunityMembershipDetails
  extends CommunityMembershipWithCommunity {
  member: CommunityMembershipMemberInfo;
}
