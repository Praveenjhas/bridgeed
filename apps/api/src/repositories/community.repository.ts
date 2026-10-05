import type {
  Community,
  CommunityType,
  PageWindow,
} from "@bridgeed/shared";
import type { CommunityType as CommunityTypeRecord } from "../generated/prisma/enums";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";
import {
  ACTIVE_MEMBERSHIP_STATUS,
  OWNER_MEMBERSHIP_ROLE,
} from "./community-membership.repository";

/** Deterministic message used when the globally unique slug is already taken. */
export const COMMUNITY_SLUG_TAKEN_MESSAGE =
  "A community with this slug already exists";

const databaseTypeByType: Record<CommunityType, CommunityTypeRecord> = {
  public: "PUBLIC",
  private: "PRIVATE",
};

const typeByDatabaseType: Record<CommunityTypeRecord, CommunityType> = {
  PUBLIC: "public",
  PRIVATE: "private",
};

interface CommunityRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: CommunityTypeRecord;
  createdById: string;
  coverImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommunityInput {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: CommunityType;
  createdById: string;
  coverImageUrl: string | null;
}

export interface CreateOwnerMembershipInput {
  id: string;
  communityId: string;
  userId: string;
}

export function toCommunity(record: CommunityRecord): Community {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description,
    type: typeByDatabaseType[record.type],
    createdById: record.createdById,
    coverImageUrl: record.coverImageUrl,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export class CommunityRepository {
  async findById(id: string): Promise<Community | null> {
    const record = await prisma.community.findUnique({
      where: {
        id,
      },
    });

    return record ? toCommunity(record) : null;
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const record = await prisma.community.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
      },
    });

    return record !== null;
  }

  /**
   * Creates a community together with its owner membership in a single
   * transaction, so a community can never exist without an owner.
   */
  async createWithOwnerMembership(
    community: CreateCommunityInput,
    ownerMembership: CreateOwnerMembershipInput,
  ): Promise<Community> {
    try {
      const record = await prisma.$transaction(async (transaction) => {
        const createdCommunity = await transaction.community.create({
          data: {
            id: community.id,
            name: community.name,
            slug: community.slug,
            description: community.description,
            type: databaseTypeByType[community.type],
            createdById: community.createdById,
            coverImageUrl: community.coverImageUrl,
          },
        });

        await transaction.communityMembership.create({
          data: {
            id: ownerMembership.id,
            communityId: createdCommunity.id,
            userId: ownerMembership.userId,
            role: OWNER_MEMBERSHIP_ROLE,
            status: ACTIVE_MEMBERSHIP_STATUS,
          },
        });

        return createdCommunity;
      });

      return toCommunity(record);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error(COMMUNITY_SLUG_TAKEN_MESSAGE);
      }

      throw error;
    }
  }

  async findAll(window: PageWindow): Promise<Community[]> {
    const records = await prisma.community.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: window.skip,
      take: window.take,
    });

    return records.map(toCommunity);
  }

  async countAll(): Promise<number> {
    return prisma.community.count();
  }
}
