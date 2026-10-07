export { USER_ROLES, type UserRole } from "./constants/roles";

export {
  USER_STATUSES,
  type UserStatus,
} from "./constants/user-statuses";

export {
  type AuthenticatedUser,
  type AuthSession,
  type RegisterRequest,
  type LoginRequest,
  type RefreshRequest,
  type LogoutResponse,
  type CurrentUserResponse,
} from "./types/auth";

export {
  CONNECTION_STATUSES,
  type ConnectionStatus,
  type Connection,
} from "./types/connection";

export type {
  User,
  StudentProfile,
  StudentProfileDetails,
} from "./types/user";

export type { University } from "./types/university";

export {
  SEARCH_TYPES,
  SEARCH_TYPE_VALUES,
  SEARCH_DEFAULT_CATEGORY_LIMIT,
  type SearchType,
  type UniversitySearchResult,
  type ProgramSearchResult,
  type SubjectSearchResult,
  type CommunitySearchResult,
  type StudentSearchResult,
  type SearchResult,
  type SearchResultGroups,
  type SearchResultCounts,
  type SearchPagination,
  type SearchResponse,
} from "./types/search";

export type {
  Subject,
  Program,
  ProgramDetail,
  UniversitySummary,
  UniversityDetail,
} from "./types/academic";

export type { Skill } from "./types/skill";

export type { Interest } from "./types/interest";

export {
  COMMUNITY_TYPES,
  COMMUNITY_MEMBER_ROLES,
  COMMUNITY_MANAGER_ROLES,
  type CommunityType,
  type CommunityMemberRole,
  type Community,
  type CommunityAcademicContext,
  type CommunityDetail,
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
  POST_TYPES,
  type PostType,
  type ContentAuthor,
  type Post,
  type PostWithAuthor,
  type PostListItem,
  type PostDetails,
} from "./types/post";

export {
  FEED_DEFAULT_LIMIT,
  FEED_MAX_LIMIT,
  FEED_REASON_CODES,
  type FeedReasonCode,
  type FeedItem,
  type FeedPage,
} from "./types/feed";

export {
  type Comment,
  type CommentWithAuthor,
  type CommentListItem,
  type CommentPostSummary,
  type CommentDetails,
} from "./types/comment";

export {
  REACTION_TYPES,
  type ReactionType,
  type PostReaction,
  type CommentReaction,
} from "./types/reaction";

export {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type Paginated,
  type PageWindow,
} from "./types/pagination";
