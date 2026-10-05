import type {
  CommunityMember,
  CommunityMembership,
  CommunityMembershipDetails,
  CommunityMembershipStatus,
  CommunityMembershipWithCommunity,
  CommunityMemberRole,
  PageWindow,
} from "@bridgeed/shared";
import type {
  CommunityMembershipStatus as CommunityMembershipStatusRecord,
  CommunityMemberRole as CommunityMemberRoleRecord,
} from "../generated/prisma/enums";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";
import { toCommunity } from "./community.repository";

/** Deterministic message used when a student already has a membership row. */
export const DUPLICATE_MEMBERSHIP_MESSAGE =
  "A membership for this community and student already exists";

export const OWNER_MEMBERSHIP_ROLE: CommunityMemberRoleRecord = "OWNER";
export const ACTIVE_MEMBERSHIP_STATUS: CommunityMembershipStatusRecord =
  "ACTIVE";

const roleByDatabaseRole: Record<
  CommunityMemberRoleRecord,
  CommunityMemberRole
> = {
  OWNER: "owner",
  ADMIN: "admin",
  MODERATOR: "moderator",
  MEMBER: "member",
};

const roleToDatabaseRole: Record<
  CommunityMemberRole,
  CommunityMemberRoleRecord
> = {
  owner: "OWNER",
  admin: "ADMIN",
  moderator: "MODERATOR",
  member: "MEMBER",
};

const databaseStatusByStatus: Record<
  CommunityMembershipStatus,
  CommunityMembershipStatusRecord
> = {
  pending: "PENDING",
  active: "ACTIVE",
  rejected: "REJECTED",
  banned: "BANNED",
};

const statusByDatabaseStatus: Record<
  CommunityMembershipStatusRecord,
  CommunityMembershipStatus
> = {
  PENDING: "pending",
  ACTIVE: "active",
  REJECTED: "rejected",
  BANNED: "banned",
};

const membershipColumns = {
  id: true,
  communityId: true,
  userId: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

const memberProfileColumns = {
  userId: true,
  name: true,
  username: true,
  profileImageUrl: true,
} as const;

const communityColumns = {
  id: true,
  name: true,
  slug: true,
  description: true,
  type: true,
  createdById: true,
  coverImageUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface MembershipRecord {
  id: string;
  communityId: string;
  userId: string;
  role: CommunityMemberRoleRecord;
  status: CommunityMembershipStatusRecord;
  createdAt: Date;
  updatedAt: Date;
}

interface MemberProfileRecord {
  userId: string;
  name: string;
  username: string;
  profileImageUrl: string | null;
}

export interface CreateMembershipInput {
  id: string;
  communityId: string;
  userId: string;
  role: CommunityMemberRole;
  status: CommunityMembershipStatus;
}

export function toCommunityMemberRole(
  record: CommunityMemberRoleRecord,
): CommunityMemberRole {
  return roleByDatabaseRole[record];
}

export function toCommunityMembership(
  record: MembershipRecord,
): CommunityMembership {
  return {
    id: record.id,
    communityId: record.communityId,
    userId: record.userId,
    role: roleByDatabaseRole[record.role],
    status: statusByDatabaseStatus[record.status],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toMemberProfile(
  record: MemberProfileRecord,
): CommunityMember["member"] {
  return {
    userId: record.userId,
    name: record.name,
    username: record.username,
    profileImageUrl: record.profileImageUrl,
  };
}

function toCommunityMember(
  record: MembershipRecord & { user: MemberProfileRecord },
): CommunityMember {
  return {
    ...toCommunityMembership(record),
    member: toMemberProfile(record.user),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export class CommunityMembershipRepository {
  async findById(id: string): Promise<CommunityMembership | null> {
    const record = await prisma.communityMembership.findUnique({
      where: {
        id,
      },
      select: membershipColumns,
    });

    return record ? toCommunityMembership(record) : null;
  }

  async findDetailsById(id: string): Promise<CommunityMembershipDetails | null> {
    const record = await prisma.communityMembership.findUnique({
      where: {
        id,
      },
      select: {
        ...membershipColumns,
        community: {
          select: communityColumns,
        },
        user: {
          select: memberProfileColumns,
        },
      },
    });

    if (!record) {
      return null;
    }

    return {
      ...toCommunityMembership(record),
      community: toCommunity(record.community),
      member: toMemberProfile(record.user),
    };
  }

  async findByCommunityAndUser(
    communityId: string,
    userId: string,
  ): Promise<CommunityMembership | null> {
    const record = await prisma.communityMembership.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
      select: membershipColumns,
    });

    return record ? toCommunityMembership(record) : null;
  }

  async create(input: CreateMembershipInput): Promise<CommunityMembership> {
    try {
      const record = await prisma.communityMembership.create({
        data: {
          id: input.id,
          communityId: input.communityId,
          userId: input.userId,
          role: roleToDatabaseRole[input.role],
          status: databaseStatusByStatus[input.status],
        },
        select: membershipColumns,
      });

      return toCommunityMembership(record);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error(DUPLICATE_MEMBERSHIP_MESSAGE);
      }

      throw error;
    }
  }

  async updateStatus(
    id: string,
    status: CommunityMembershipStatus,
  ): Promise<CommunityMembership> {
    const record = await prisma.communityMembership.update({
      where: {
        id,
      },
      data: {
        status: databaseStatusByStatus[status],
      },
      select: membershipColumns,
    });

    return toCommunityMembership(record);
  }

  /**
   * Reuses an existing membership row when a student requests to join again.
   * The role is reset to MEMBER so a previous role can never survive a fresh
   * join request.
   */
  async reopenMembership(
    id: string,
    status: CommunityMembershipStatus,
  ): Promise<CommunityMembership> {
    const record = await prisma.communityMembership.update({
      where: {
        id,
      },
      data: {
        role: roleToDatabaseRole.member,
        status: databaseStatusByStatus[status],
      },
      select: membershipColumns,
    });

    return toCommunityMembership(record);
  }

  async delete(id: string): Promise<number> {
    const result = await prisma.communityMembership.deleteMany({
      where: {
        id,
      },
    });

    return result.count;
  }

  async listByCommunity(
    communityId: string,
    status: CommunityMembershipStatus | null,
    window: PageWindow,
  ): Promise<CommunityMember[]> {
    const records = await prisma.communityMembership.findMany({
      where: {
        communityId,
        ...(status ? { status: databaseStatusByStatus[status] } : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: window.skip,
      take: window.take,
      select: {
        ...membershipColumns,
        user: {
          select: memberProfileColumns,
        },
      },
    });

    return records.map(toCommunityMember);
  }

  async countByCommunity(
    communityId: string,
    status: CommunityMembershipStatus | null,
  ): Promise<number> {
    return prisma.communityMembership.count({
      where: {
        communityId,
        ...(status ? { status: databaseStatusByStatus[status] } : {}),
      },
    });
  }

  async listByUser(
    userId: string,
    status: CommunityMembershipStatus | null,
  ): Promise<CommunityMembershipWithCommunity[]> {
    const records = await prisma.communityMembership.findMany({
      where: {
        userId,
        ...(status ? { status: databaseStatusByStatus[status] } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: {
        ...membershipColumns,
        community: {
          select: communityColumns,
        },
      },
    });

    return records.map((record) => ({
      ...toCommunityMembership(record),
      community: toCommunity(record.community),
    }));
  }
}

