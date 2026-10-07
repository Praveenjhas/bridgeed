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
  /**
   * Optional academic context. Every community created before the academic graph
   * leaves these null; the three are independent so a community can anchor to a
   * university, a programme and/or a subject.
   */
  universityId: string | null;
  programId: string | null;
  subjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The academic context of a community, resolved to names so a screen can render
 * "IIT Mandi · B.Tech Mechanical Engineering · Thermodynamics" without a read
 * per entity. Each part is null when the community does not name it.
 */
export interface CommunityAcademicContext {
  university: { id: string; name: string; slug: string } | null;
  program: { id: string; name: string } | null;
  subject: { id: string; name: string } | null;
}

/** A community together with its resolved academic context. */
export interface CommunityDetail extends Community {
  academicContext: CommunityAcademicContext;
}
