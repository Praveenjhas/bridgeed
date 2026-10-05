export const COMMUNITY_TYPES = {
  PUBLIC: "public",
  PRIVATE: "private",
} as const;

export type CommunityType =
  (typeof COMMUNITY_TYPES)[keyof typeof COMMUNITY_TYPES];

export const COMMUNITY_MEMBER_ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MODERATOR: "moderator",
  MEMBER: "member",
} as const;

export type CommunityMemberRole =
  (typeof COMMUNITY_MEMBER_ROLES)[keyof typeof COMMUNITY_MEMBER_ROLES];

/** Membership roles that are allowed to manage members and join requests. */
export const COMMUNITY_MANAGER_ROLES: readonly CommunityMemberRole[] = [
  COMMUNITY_MEMBER_ROLES.OWNER,
  COMMUNITY_MEMBER_ROLES.ADMIN,
];

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: CommunityType;
  createdById: string;
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
