import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  type CommunityMember,
  type CommunityMembership,
  type CommunityMembershipStatus,
  type CommunityMembershipWithCommunity,
  type Paginated,
} from "@bridgeed/shared";
import { apiClient } from "@/services/api";

export interface FetchStudentMembershipsParams {
  /** The student whose memberships are read. */
  userId: string;
  /** Optional status filter; omitted means every status is returned. */
  status?: CommunityMembershipStatus;
  signal?: AbortSignal;
}

/**
 * Reads every community membership of one student, each with its community.
 *
 * This is the only endpoint that reports a student's own membership state, so it
 * is what every membership badge, button and gate in the app is derived from.
 * Requesting it without a status filter returns active, pending, rejected and
 * banned rows, which is exactly what the UI needs to explain a state instead of
 * only showing what is fine.
 */
export async function fetchStudentMemberships({
  userId,
  status,
  signal,
}: FetchStudentMembershipsParams): Promise<CommunityMembershipWithCommunity[]> {
  return apiClient.get<CommunityMembershipWithCommunity[]>(
    `/student-profiles/${encodeURIComponent(userId)}/communities`,
    { query: { status }, signal },
  );
}

export interface JoinCommunityParams {
  communityId: string;
  /** The student joining. This route reads `userId` rather than `actorId`. */
  userId: string;
  signal?: AbortSignal;
}

/**
 * Joins a community, or asks to join it.
 *
 * The API decides which of the two happens from the community type, and it owns
 * every rule around that: a public community activates the membership, a private
 * one creates a pending request, a ban cannot be bypassed and an existing active
 * membership or pending request is rejected as a conflict rather than duplicated.
 */
export async function joinCommunity({
  communityId,
  userId,
  signal,
}: JoinCommunityParams): Promise<CommunityMembership> {
  return apiClient.post<CommunityMembership>(
    `/communities/${encodeURIComponent(communityId)}/join`,
    { body: { userId }, signal },
  );
}

export interface LeaveCommunityParams {
  communityId: string;
  /** The student leaving, or cancelling their own pending request. */
  actorId: string;
  signal?: AbortSignal;
}

/**
 * Removes the actor's own membership.
 *
 * It covers two intents with one call: an active member leaves the community,
 * and a student with a pending request withdraws it. The API refuses to let an
 * owner leave their own community, so the UI keeps that button away rather than
 * offering an action that cannot succeed.
 */
export async function leaveCommunity({
  communityId,
  actorId,
  signal,
}: LeaveCommunityParams): Promise<void> {
  await apiClient.remove<void>(
    `/communities/${encodeURIComponent(communityId)}/membership`,
    { query: { actorId }, signal },
  );
}

export interface FetchCommunityMembersParams {
  communityId: string;
  /**
   * Membership status to list. The API defaults to active members, so pending
   * and banned rows are only returned when they are asked for explicitly.
   */
  status?: CommunityMembershipStatus | null;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Reads one page of a community's members, oldest membership first.
 *
 * The response also carries `total`, which is the only member count the API
 * exposes; the community listings themselves report none.
 */
export async function fetchCommunityMembers({
  communityId,
  status = null,
  page = DEFAULT_PAGE,
  limit = DEFAULT_PAGE_SIZE,
  signal,
}: FetchCommunityMembersParams): Promise<Paginated<CommunityMember>> {
  return apiClient.get<Paginated<CommunityMember>>(
    `/communities/${encodeURIComponent(communityId)}/members`,
    { query: { status, page, limit }, signal },
  );
}

export type MembershipDecision = "approve" | "reject";

export interface DecideMembershipParams {
  /** Id of the membership row the request belongs to, not the student id. */
  membershipId: string;
  /** The owner or admin deciding. */
  actorId: string;
  signal?: AbortSignal;
}

/** Approves a pending join request. The API allows owners and admins only. */
export async function approveMembership({
  membershipId,
  actorId,
  signal,
}: DecideMembershipParams): Promise<CommunityMembership> {
  return apiClient.patch<CommunityMembership>(
    `/community-memberships/${encodeURIComponent(membershipId)}/approve`,
    { body: { actorId }, signal },
  );
}

/** Rejects a pending join request. The API allows owners and admins only. */
export async function rejectMembership({
  membershipId,
  actorId,
  signal,
}: DecideMembershipParams): Promise<CommunityMembership> {
  return apiClient.patch<CommunityMembership>(
    `/community-memberships/${encodeURIComponent(membershipId)}/reject`,
    { body: { actorId }, signal },
  );
}
