import type { CommentReaction, ReactionType } from "@bridgeed/shared";
import type { ReactionType as ReactionTypeRecord } from "../generated/prisma/enums";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";
import { REACTION_ALREADY_EXISTS_MESSAGE } from "./post-reaction.repository";

const typeByDatabaseType: Record<ReactionTypeRecord, ReactionType> = {
  LIKE: "like",
};

const typeToDatabaseType: Record<ReactionType, ReactionTypeRecord> = {
  like: "LIKE",
};

const reactionColumns = {
  id: true,
  commentId: true,
  userId: true,
  type: true,
  createdAt: true,
} as const;

interface CommentReactionRecord {
  id: string;
  commentId: string;
  userId: string;
  type: ReactionTypeRecord;
  createdAt: Date;
}

export interface CreateCommentReactionInput {
  id: string;
  commentId: string;
  userId: string;
  type: ReactionType;
}

export function toCommentReaction(
  record: CommentReactionRecord,
): CommentReaction {
  return {
    id: record.id,
    commentId: record.commentId,
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

export class CommentReactionRepository {
  async findByCommentAndUser(
    commentId: string,
    userId: string,
  ): Promise<CommentReaction | null> {
    const record = await prisma.commentReaction.findUnique({
      where: {
        commentId_userId_type: {
          commentId,
          userId,
          type: typeToDatabaseType.like,
        },
      },
      select: reactionColumns,
    });

    return record ? toCommentReaction(record) : null;
  }

  async create(input: CreateCommentReactionInput): Promise<CommentReaction> {
    try {
      const record = await prisma.commentReaction.create({
        data: {
          id: input.id,
          commentId: input.commentId,
          userId: input.userId,
          type: typeToDatabaseType[input.type],
        },
        select: reactionColumns,
      });

      return toCommentReaction(record);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error(REACTION_ALREADY_EXISTS_MESSAGE);
      }

      throw error;
    }
  }

  /** Removes the current reaction of a student, returning how many rows went away. */
  async delete(commentId: string, userId: string): Promise<number> {
    const result = await prisma.commentReaction.deleteMany({
      where: {
        commentId,
        userId,
        type: typeToDatabaseType.like,
      },
    });

    return result.count;
  }

  async countByComment(commentId: string): Promise<number> {
    return prisma.commentReaction.count({
      where: {
        commentId,
        type: typeToDatabaseType.like,
      },
    });
  }
}
