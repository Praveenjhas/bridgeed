export {
  COMMUNITIES_PAGE_LIMIT,
  COMMUNITY_POSTS_PAGE_LIMIT,
  MAX_COMMUNITY_DESCRIPTION_LENGTH,
  MAX_COMMUNITY_NAME_LENGTH,
  MAX_COMMUNITY_SLUG_LENGTH,
  MAX_POST_CONTENT_LENGTH,
  MEMBERS_PAGE_LIMIT,
  MEMBERS_PREVIEW_AVATARS,
  MEMBERS_PREVIEW_LIMIT,
} from "./constants";

export {
  COMMUNITY_TYPE_DESCRIPTIONS,
  COMMUNITY_TYPE_LABELS,
  COMMUNITY_TYPE_TONES,
  MEMBERSHIP_STATUS_LABELS,
  MEMBERSHIP_STATUS_TONES,
  MEMBER_ROLE_LABELS,
  communityTypeLabel,
  describeMembershipStatus,
  formatMemberCount,
  formatPostCount,
  memberRoleLabel,
  membershipStatusLabel,
  roleTone,
} from "./labels";

export {
  fetchCommunities,
  fetchCommunity,
  createCommunity,
  type CreateCommunityParams,
  type FetchCommunitiesParams,
  type FetchCommunityParams,
} from "./api/communities.api";
export {
  subscribeToCommunitiesRefresh,
  notifyCommunitiesRefresh,
} from "./communities-refresh";
export {
  approveMembership,
  fetchCommunityMembers,
  fetchStudentMemberships,
  joinCommunity,
  leaveCommunity,
  rejectMembership,
  type DecideMembershipParams,
  type FetchCommunityMembersParams,
  type FetchStudentMembershipsParams,
  type JoinCommunityParams,
  type LeaveCommunityParams,
  type MembershipDecision,
} from "./api/memberships.api";
export {
  createCommunityPost,
  fetchCommunityPosts,
  type CreateCommunityPostParams,
  type FetchCommunityPostsParams,
} from "./api/communityPosts.api";

export { useCommunities, type CommunitiesState } from "./hooks/useCommunities";
export { useCommunity, type CommunityState } from "./hooks/useCommunity";
export {
  useCreateCommunity,
  slugifyCommunityName,
  type CreateCommunityState,
} from "./hooks/useCreateCommunity";
export {
  useCommunityMembers,
  type CommunityMembersState,
  type UseCommunityMembersOptions,
} from "./hooks/useCommunityMembers";
export {
  useCommunityMembership,
  type CommunityMembershipState,
} from "./hooks/useCommunityMembership";
export {
  useCommunityMemberships,
  type CommunityMembershipsState,
} from "./hooks/useCommunityMemberships";
export {
  useCommunityPosts,
  type CommunityPostsState,
} from "./hooks/useCommunityPosts";
export {
  useMembershipRequestActions,
  type MembershipRequestActionsState,
  type UseMembershipRequestActionsOptions,
} from "./hooks/useMembershipRequestActions";

export {
  CommunityCard,
  type CommunityCardProps,
} from "./components/CommunityCard";
export {
  CommunityMembersPreview,
  type CommunityMembersPreviewProps,
} from "./components/CommunityMembersPreview";
export {
  CommunityPostComposer,
  type CommunityPostComposerProps,
} from "./components/CommunityPostComposer";
export {
  CommunityTypePicker,
  type CommunityTypePickerProps,
} from "./components/CommunityTypePicker";
export {
  JoinRequestsCard,
  type JoinRequestsCardProps,
} from "./components/JoinRequestsCard";
export { MemberRow, type MemberRowProps } from "./components/MemberRow";
export {
  MembershipActions,
  type MembershipActionsProps,
} from "./components/MembershipActions";
