export const COMMUNITY_MEMBER_ROLES = {
  MEMBER: "member",
  MODERATOR: "moderator",
  OWNER: "owner",
} as const;

export type CommunityMemberRole =
  (typeof COMMUNITY_MEMBER_ROLES)[keyof typeof COMMUNITY_MEMBER_ROLES];

export interface Community {
  id: string;
  name: string;
  description: string;
  category: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityMember {
  communityId: string;
  userId: string;
  role: CommunityMemberRole;
  joinedAt: string;
}
