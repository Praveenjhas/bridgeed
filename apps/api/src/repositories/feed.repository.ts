import type { CommunityMemberRole } from "@bridgeed/shared";
import { prisma } from "../config/prisma";
import {
  ACTIVE_MEMBERSHIP_STATUS,
  toCommunityMemberRole,
} from "./community-membership.repository";

/** Only the columns needed to score a candidate are ever read. */
const candidateColumns = {
  id: true,
  authorId: true,
  communityId: true,
  createdAt: true,
} as const;

/**
 * Counts come from filtered relation counts, exactly like the post listings, so
 * scoring never loads comment or reaction rows just to count them.
 */
const candidateCountColumns = {
  comments: {
    where: {
      deletedAt: null,
    },
  },
  reactions: {
    where: {
      type: "LIKE",
    },
  },
} as const;

/** A lightweight candidate post, before scoring and hydration. */
export interface FeedCandidateRecord {
  id: string;
  authorId: string;
  communityId: string;
  createdAt: Date;
  commentCount: number;
  likeCount: number;
}

/** An ACTIVE membership of the actor, used for tier and visibility. */
export interface FeedCommunityRole {
  communityId: string;
  role: CommunityMemberRole;
}

/** How many skills and interests a candidate author shares with the actor. */
export interface FeedTopicOverlapRecord {
  studentId: string;
  sharedSkillCount: number;
  sharedInterestCount: number;
}

/** The posts of the current candidate set the actor already engaged with. */
export interface FeedEngagementRecord {
  reactedPostIds: string[];
  commentedPostIds: string[];
}

export interface FindCandidatePostsParams {
  communityIds: string[];
  authorIds?: string[];
  excludedAuthorIds: string[];
  since: Date;
  limit: number;
}

export interface FindTopicAuthorIdsParams {
  skillIds: string[];
  interestIds: string[];
  excludedUserIds: string[];
  limit: number;
}

export interface CountSharedTopicsParams {
  studentIds: string[];
  skillIds: string[];
  interestIds: string[];
}

export class FeedRepository {
  /**
   * The visibility filter of the feed: only communities where the actor has an
   * ACTIVE membership can contribute candidates, so a private community can
   * never leak into the feed as a side effect of ranking.
   */
  async findActiveCommunityRoles(userId: string): Promise<FeedCommunityRole[]> {
    const records = await prisma.communityMembership.findMany({
      where: {
        userId,
        status: ACTIVE_MEMBERSHIP_STATUS,
      },
      orderBy: [{ communityId: "asc" }],
      select: {
        communityId: true,
        role: true,
      },
    });

    return records.map((record) => ({
      communityId: record.communityId,
      role: toCommunityMemberRole(record.role),
    }));
  }

  /**
   * One bounded candidate sweep over the communities the actor may read. Every
   * caller supplies an explicit `take`, so the candidate set stays bounded even
   * when a community holds a large history.
   */
  async findCandidatePosts(
    params: FindCandidatePostsParams,
  ): Promise<FeedCandidateRecord[]> {
    if (params.communityIds.length === 0) {
      return [];
    }

    if (params.authorIds !== undefined && params.authorIds.length === 0) {
      return [];
    }

    const records = await prisma.post.findMany({
      where: {
        communityId: { in: params.communityIds },
        deletedAt: null,
        createdAt: { gte: params.since },
        ...(params.authorIds === undefined
          ? {}
          : { authorId: { in: params.authorIds } }),
        ...(params.excludedAuthorIds.length === 0
          ? {}
          : { NOT: { authorId: { in: params.excludedAuthorIds } } }),
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: params.limit,
      select: {
        ...candidateColumns,
        _count: {
          select: candidateCountColumns,
        },
      },
    });

    return records.map((record) => ({
      id: record.id,
      authorId: record.authorId,
      communityId: record.communityId,
      createdAt: record.createdAt,
      commentCount: record._count.comments,
      likeCount: record._count.reactions,
    }));
  }

  /**
   * Discovers a bounded set of students who share at least one skill or
   * interest with the actor. Only ids are read, and each topic table read is
   * capped, so topic affinity can never turn into a full scan of all students.
   */
  async findTopicAuthorIds(
    params: FindTopicAuthorIdsParams,
  ): Promise<string[]> {
    if (params.limit <= 0) {
      return [];
    }

    const [skillRows, interestRows] = await Promise.all([
      params.skillIds.length === 0
        ? []
        : prisma.studentSkill.findMany({
            where: { skillId: { in: params.skillIds } },
            orderBy: [{ studentId: "asc" }],
            take: params.limit,
            select: { studentId: true },
          }),
      params.interestIds.length === 0
        ? []
        : prisma.studentInterest.findMany({
            where: { interestId: { in: params.interestIds } },
            orderBy: [{ studentId: "asc" }],
            take: params.limit,
            select: { studentId: true },
          }),
    ]);

    const excluded = new Set(params.excludedUserIds);
    const authorIds: string[] = [];
    const seen = new Set<string>();

    for (const row of [...skillRows, ...interestRows]) {
      // Deduplicated with a Set so a student matching on both tables, or on
      // several skills, is still considered exactly once.
      if (seen.has(row.studentId) || excluded.has(row.studentId)) {
        continue;
      }

      seen.add(row.studentId);
      authorIds.push(row.studentId);
    }

    return authorIds.slice(0, params.limit);
  }

  /**
   * Counts, per candidate author and in two grouped queries, how many skills
   * and interests they share with the actor. Grouping in the database keeps the
   * topic signal O(1) queries instead of one query per author.
   */
  async countSharedTopics(
    params: CountSharedTopicsParams,
  ): Promise<FeedTopicOverlapRecord[]> {
    if (params.studentIds.length === 0) {
      return [];
    }

    const [skillRows, interestRows] = await Promise.all([
      params.skillIds.length === 0
        ? []
        : prisma.studentSkill.groupBy({
            by: ["studentId"],
            where: {
              studentId: { in: params.studentIds },
              skillId: { in: params.skillIds },
            },
            _count: { _all: true },
          }),
      params.interestIds.length === 0
        ? []
        : prisma.studentInterest.groupBy({
            by: ["studentId"],
            where: {
              studentId: { in: params.studentIds },
              interestId: { in: params.interestIds },
            },
            _count: { _all: true },
          }),
    ]);

    const overlapsByStudentId = new Map<string, FeedTopicOverlapRecord>();

    for (const studentId of params.studentIds) {
      overlapsByStudentId.set(studentId, {
        studentId,
        sharedSkillCount: 0,
        sharedInterestCount: 0,
      });
    }

    for (const row of skillRows) {
      const overlap = overlapsByStudentId.get(row.studentId);

      if (overlap) {
        overlap.sharedSkillCount = row._count._all;
      }
    }

    for (const row of interestRows) {
      const overlap = overlapsByStudentId.get(row.studentId);

      if (overlap) {
        overlap.sharedInterestCount = row._count._all;
      }
    }

    return [...overlapsByStudentId.values()];
  }

  /**
   * Reads which of the candidate posts the actor already reacted to or
   * commented on. Both lists come from one query each, scoped to the candidate
   * ids, so the fatigue signal needs no per post lookup.
   */
  async findActedPostIds(params: {
    userId: string;
    postIds: string[];
  }): Promise<FeedEngagementRecord> {
    if (params.postIds.length === 0) {
      return { reactedPostIds: [], commentedPostIds: [] };
    }

    const [reactions, comments] = await Promise.all([
      prisma.postReaction.findMany({
        where: {
          userId: params.userId,
          postId: { in: params.postIds },
        },
        select: { postId: true },
      }),
      prisma.comment.findMany({
        where: {
          authorId: params.userId,
          postId: { in: params.postIds },
          deletedAt: null,
        },
        select: { postId: true },
      }),
    ]);

    return {
      reactedPostIds: [
        ...new Set(reactions.map((reaction) => reaction.postId)),
      ],
      commentedPostIds: [
        ...new Set(comments.map((comment) => comment.postId)),
      ],
    };
  }
}
