import type { PostReaction, ReactionType } from "@bridgeed/shared";
import type { ReactionType as ReactionTypeRecord } from "../generated/prisma/enums";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";

/** Deterministic message used when a student has already reacted this way. */
export const REACTION_ALREADY_EXISTS_MESSAGE = "This reaction already exists";

const typeByDatabaseType: Record<ReactionTypeRecord, ReactionType> = {
  LIKE: "like",
};

const typeToDatabaseType: Record<ReactionType, ReactionTypeRecord> = {
  like: "LIKE",
};

const reactionColumns = {
  id: true,
  postId: true,
  userId: true,
  type: true,
  createdAt: true,
} as const;

interface PostReactionRecord {
  id: string;
  postId: string;
  userId: string;
  type: ReactionTypeRecord;
  createdAt: Date;
}

export interface CreatePostReactionInput {
  id: string;
  postId: string;
  userId: string;
  type: ReactionType;
}

export function toPostReaction(record: PostReactionRecord): PostReaction {
  return {
    id: record.id,
    postId: record.postId,
    userId: record.userId,
    type: typeByDatabaseType[record.type],
    createdAt: record.createdAt.toISOString(),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export class PostReactionRepository {
  async findByPostAndUser(
    postId: string,
    userId: string,
  ): Promise<PostReaction | null> {
    const record = await prisma.postReaction.findUnique({
      where: {
        postId_userId_type: {
          postId,
          userId,
          type: typeToDatabaseType.like,
        },
      },
      select: reactionColumns,
    });

    return record ? toPostReaction(record) : null;
  }

  async create(input: CreatePostReactionInput): Promise<PostReaction> {
    try {
      const record = await prisma.postReaction.create({
        data: {
          id: input.id,
          postId: input.postId,
          userId: input.userId,
          type: typeToDatabaseType[input.type],
        },
        select: reactionColumns,
      });

      return toPostReaction(record);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error(REACTION_ALREADY_EXISTS_MESSAGE);
      }

      throw error;
    }
  }

  /** Removes the current reaction of a student, returning how many rows went away. */
  async delete(postId: string, userId: string): Promise<number> {
    const result = await prisma.postReaction.deleteMany({
      where: {
        postId,
        userId,
        type: typeToDatabaseType.like,
      },
    });

    return result.count;
  }

  async countByPost(postId: string): Promise<number> {
    return prisma.postReaction.count({
      where: {
        postId,
        type: typeToDatabaseType.like,
      },
    });
  }
}
