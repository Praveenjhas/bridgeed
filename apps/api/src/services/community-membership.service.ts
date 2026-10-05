import {
  COMMUNITY_MANAGER_ROLES,
  COMMUNITY_MEMBER_ROLES,
  COMMUNITY_MEMBERSHIP_STATUSES,
  COMMUNITY_TYPES,
  type Community,
  type CommunityMember,
  type CommunityMembership,
  type CommunityMembershipDetails,
  type CommunityMembershipStatus,
  type CommunityMembershipWithCommunity,
  type CommunityType,
  type Paginated,
} from "@bridgeed/shared";
import { CommunityMembershipRepository } from "../repositories/community-membership.repository";
import { CommunityService } from "./community.service";
import {
  normalizeLimit,
  normalizePage,
  toPageWindow,
  toPaginated,
} from "../utils/pagination";

export const COMMUNITY_MEMBERSHIP_NOT_FOUND_MESSAGE =
  "Community membership not found";
export const COMMUNITY_MEMBERSHIP_USER_REQUIRED_MESSAGE =
  "userId is required";
export const BANNED_FROM_COMMUNITY_MESSAGE =
  "You are banned from this community";
export const ALREADY_ACTIVE_MEMBER_MESSAGE =
  "You are already an active member of this community";
export const JOIN_REQUEST_ALREADY_PENDING_MESSAGE =
  "A join request for this community is already pending";
export const OWNER_CANNOT_LEAVE_MESSAGE =
  "The community owner cannot leave the community";
export const NOT_ACTIVE_MEMBER_MESSAGE =
  "You are not an active member of this community";
export const MANAGE_MEMBERS_FORBIDDEN_MESSAGE =
  "Only community owners and admins can manage memberships";
export const ONLY_PENDING_REQUEST_CAN_BE_APPROVED_MESSAGE =
  "Only pending membership requests can be approved";
export const ONLY_PENDING_REQUEST_CAN_BE_REJECTED_MESSAGE =
  "Only pending membership requests can be rejected";

export interface ListMembersQuery {
  status?: CommunityMembershipStatus | null;
  page?: number;
  limit?: number;
}

export interface ListPaginationQuery {
  page?: number;
  limit?: number;
}

export class CommunityMembershipService {
  constructor(
    private readonly communityMembershipRepository: CommunityMembershipRepository,
    private readonly communityService: CommunityService,
  ) {}

  /**
   * Joins a community. Public communities activate the membership right away,
   * private communities create a pending request. Rejected students may ask
   * again, banned or active students may not.
   */
  async joinCommunity(
    communityId: string,
    userId: string,
  ): Promise<CommunityMembership> {
    const community = await this.communityService.requireCommunity(communityId);

    await this.communityService.ensureStudentProfileExists(userId);

    const existingMembership =
      await this.communityMembershipRepository.findByCommunityAndUser(
        communityId,
        userId,
      );

    if (existingMembership) {
      switch (existingMembership.status) {
        case COMMUNITY_MEMBERSHIP_STATUSES.BANNED:
          throw new Error(BANNED_FROM_COMMUNITY_MESSAGE);
        case COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE:
          throw new Error(ALREADY_ACTIVE_MEMBER_MESSAGE);
        case COMMUNITY_MEMBERSHIP_STATUSES.PENDING:
          throw new Error(JOIN_REQUEST_ALREADY_PENDING_MESSAGE);
        case COMMUNITY_MEMBERSHIP_STATUSES.REJECTED:
          // A rejection is not permanent: reuse the existing row instead of
          // violating the unique (communityId, userId) constraint.
          return this.communityMembershipRepository.reopenMembership(
            existingMembership.id,
            this.initialStatusForCommunity(community),
          );
      }
    }

    return this.communityMembershipRepository.create({
      id: crypto.randomUUID(),
      communityId,
      userId,
      role: COMMUNITY_MEMBER_ROLES.MEMBER,
      status: this.initialStatusForCommunity(community),
    });
  }

  /**
   * Removes the actor's own membership. Active members leave the community,
   * students with a pending request cancel their own request. The owner can
   * never leave and other members cannot be removed through this operation.
   */
  async leaveCommunity(communityId: string, actorId: string): Promise<void> {
    await this.communityService.requireCommunity(communityId);

    const membership =
      await this.communityMembershipRepository.findByCommunityAndUser(
        communityId,
        actorId,
      );

    if (!membership) {
      throw new Error(COMMUNITY_MEMBERSHIP_NOT_FOUND_MESSAGE);
    }

    if (membership.status === COMMUNITY_MEMBERSHIP_STATUSES.BANNED) {
      throw new Error(BANNED_FROM_COMMUNITY_MESSAGE);
    }

    if (membership.status === COMMUNITY_MEMBERSHIP_STATUSES.REJECTED) {
      throw new Error(NOT_ACTIVE_MEMBER_MESSAGE);
    }

    if (
      membership.status === COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE &&
      membership.role === COMMUNITY_MEMBER_ROLES.OWNER
    ) {
      throw new Error(OWNER_CANNOT_LEAVE_MESSAGE);
    }

    const deletedCount = await this.communityMembershipRepository.delete(
      membership.id,
    );

    if (deletedCount === 0) {
      throw new Error(COMMUNITY_MEMBERSHIP_NOT_FOUND_MESSAGE);
    }
  }

  async getMembershipById(
    membershipId: string,
  ): Promise<CommunityMembershipDetails> {
    const membership =
      await this.communityMembershipRepository.findDetailsById(membershipId);

    if (!membership) {
      throw new Error(COMMUNITY_MEMBERSHIP_NOT_FOUND_MESSAGE);
    }

    return membership;
  }

  /**
   * Lists the members of a community. Without an explicit status filter only
   * active members are returned so pending or banned memberships are never
   * exposed accidentally.
   */
  async listCommunityMembers(
    communityId: string,
    query: ListMembersQuery,
  ): Promise<Paginated<CommunityMember>> {
    await this.communityService.requireCommunity(communityId);

    const page = normalizePage(query.page);
    const limit = normalizeLimit(query.limit);
    const status = query.status ?? COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE;

    const [items, total] = await Promise.all([
      this.communityMembershipRepository.listByCommunity(
        communityId,
        status,
        toPageWindow(page, limit),
      ),
      this.communityMembershipRepository.countByCommunity(communityId, status),
    ]);

    return toPaginated(items, page, limit, total);
  }

  /** Lists pending join requests. Only owners and admins may read them. */
  async listMembershipRequests(
    communityId: string,
    actorId: string,
    query: ListPaginationQuery,
  ): Promise<Paginated<CommunityMember>> {
    await this.communityService.requireCommunity(communityId);

    await this.requireMembershipManager(communityId, actorId);

    const page = normalizePage(query.page);
    const limit = normalizeLimit(query.limit);
    const status = COMMUNITY_MEMBERSHIP_STATUSES.PENDING;

    const [items, total] = await Promise.all([
      this.communityMembershipRepository.listByCommunity(
        communityId,
        status,
        toPageWindow(page, limit),
      ),
      this.communityMembershipRepository.countByCommunity(communityId, status),
    ]);

    return toPaginated(items, page, limit, total);
  }

  async approveMembership(
    membershipId: string,
    actorId: string,
  ): Promise<CommunityMembership> {
    const membership = await this.requireMembership(membershipId);

    await this.requireMembershipManager(membership.communityId, actorId);

    if (membership.status !== COMMUNITY_MEMBERSHIP_STATUSES.PENDING) {
      throw new Error(ONLY_PENDING_REQUEST_CAN_BE_APPROVED_MESSAGE);
    }

    return this.communityMembershipRepository.updateStatus(
      membershipId,
      COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
    );
  }

  async rejectMembership(
    membershipId: string,
    actorId: string,
  ): Promise<CommunityMembership> {
    const membership = await this.requireMembership(membershipId);

    await this.requireMembershipManager(membership.communityId, actorId);

    if (membership.status !== COMMUNITY_MEMBERSHIP_STATUSES.PENDING) {
      throw new Error(ONLY_PENDING_REQUEST_CAN_BE_REJECTED_MESSAGE);
    }

    return this.communityMembershipRepository.updateStatus(
      membershipId,
      COMMUNITY_MEMBERSHIP_STATUSES.REJECTED,
    );
  }

  /** Lists the communities a student is a member of. */
  async getStudentCommunities(
    userId: string,
    status?: CommunityMembershipStatus | null,
  ): Promise<CommunityMembershipWithCommunity[]> {
    await this.communityService.ensureStudentProfileExists(userId);

    return this.communityMembershipRepository.listByUser(
      userId,
      status ?? null,
    );
  }

  /**
   * Authorization source for every content operation (posts, comments and
   * reactions). The membership is always read from the database, so a client
   * can never claim a role or a status it does not really have. Pending,
   * rejected, banned and absent memberships are rejected with one single
   * deterministic error.
   */
  async requireActiveMembership(
    communityId: string,
    userId: string,
  ): Promise<CommunityMembership> {
    const membership =
      await this.communityMembershipRepository.findByCommunityAndUser(
        communityId,
        userId,
      );

    if (
      !membership ||
      membership.status !== COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE
    ) {
      throw new Error(NOT_ACTIVE_MEMBER_MESSAGE);
    }

    return membership;
  }

  private async requireMembership(
    membershipId: string,
  ): Promise<CommunityMembership> {
    const membership =
      await this.communityMembershipRepository.findById(membershipId);

    if (!membership) {
      throw new Error(COMMUNITY_MEMBERSHIP_NOT_FOUND_MESSAGE);
    }

    return membership;
  }

  /**
   * Authorization is always derived from the database, never from the request
   * payload, so a client cannot claim a role it does not have.
   */
  private async requireMembershipManager(
    communityId: string,
    actorId: string,
  ): Promise<CommunityMembership> {
    const actorMembership =
      await this.communityMembershipRepository.findByCommunityAndUser(
        communityId,
        actorId,
      );

    const canManage =
      actorMembership !== null &&
      actorMembership.status === COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE &&
      COMMUNITY_MANAGER_ROLES.includes(actorMembership.role);

    if (!canManage) {
      throw new Error(MANAGE_MEMBERS_FORBIDDEN_MESSAGE);
    }

    return actorMembership;
  }

  private initialStatusForCommunity(
    community: Community,
  ): CommunityMembershipStatus {
    return community.type === COMMUNITY_TYPES.PRIVATE
      ? COMMUNITY_MEMBERSHIP_STATUSES.PENDING
      : COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE;
  }
}
