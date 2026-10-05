export { USER_ROLES, type UserRole } from "./constants/roles";

export {
  CONNECTION_STATUSES,
  type ConnectionStatus,
  type Connection,
} from "./types/connection";

export type { User, StudentProfile } from "./types/user";

export type { University } from "./types/university";

export type { Skill } from "./types/skill";

export type { Interest } from "./types/interest";

export {
  COMMUNITY_TYPES,
  COMMUNITY_MEMBER_ROLES,
  COMMUNITY_MANAGER_ROLES,
  type CommunityType,
  type CommunityMemberRole,
  type Community,
} from "./types/community";

export {
  COMMUNITY_MEMBERSHIP_STATUSES,
  type CommunityMembershipStatus,
  type CommunityMembership,
  type CommunityMembershipMemberInfo,
  type CommunityMember,
  type CommunityMembershipWithCommunity,
  type CommunityMembershipDetails,
} from "./types/community-membership";

export {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type Paginated,
  type PageWindow,
} from "./types/pagination";
