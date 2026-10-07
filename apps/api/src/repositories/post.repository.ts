import {
  POST_TYPES,
  type PageWindow,
  type Post,
  type PostDetails,
  type PostListItem,
  type PostType,
} from "@bridgeed/shared";
import type { PostType as PostTypeRecord } from "../generated/prisma/enums";
import { prisma } from "../config/prisma";
import { toCommunity } from "./community.repository";

/**
 * The database stores the type in upper case and the wire contract uses lower
 * case, so every direction goes through one explicit table instead of a
 * `toUpperCase()` that would silently accept a value nobody defined.
 */
const typeByDatabaseType: Record<PostTypeRecord, PostType> = {
  DISCUSSION: POST_TYPES.DISCUSSION,
  QUESTION: POST_TYPES.QUESTION,
  RESOURCE: POST_TYPES.RESOURCE,
  ACHIEVEMENT: POST_TYPES.ACHIEVEMENT,
  RESEARCH: POST_TYPES.RESEARCH,
  ANNOUNCEMENT: POST_TYPES.ANNOUNCEMENT,
  OPPORTUNITY: POST_TYPES.OPPORTUNITY,
};

const typeToDatabaseType: Record<PostType, PostTypeRecord> = {
  [POST_TYPES.DISCUSSION]: "DISCUSSION",
  [POST_TYPES.QUESTION]: "QUESTION",
  [POST_TYPES.RESOURCE]: "RESOURCE",
  [POST_TYPES.ACHIEVEMENT]: "ACHIEVEMENT",
  [POST_TYPES.RESEARCH]: "RESEARCH",
  [POST_TYPES.ANNOUNCEMENT]: "ANNOUNCEMENT",
  [POST_TYPES.OPPORTUNITY]: "OPPORTUNITY",
};

/** Only public profile columns are selected for content authors. */
const authorColumns = {
  userId: true,
  name: true,
  username: true,
  profileImageUrl: true,
} as const;

const postColumns = {
  id: true,
  authorId: true,
  communityId: true,
  content: true,
  type: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

interface AuthorRecord {
  userId: string;
  name: string;
  username: string;
  profileImageUrl: string | null;
}

interface PostRecord {
  id: string;
  authorId: string;
  communityId: string;
  content: string;
  type: PostTypeRecord;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreatePostInput {
  id: string;
  authorId: string;
  communityId: string;
  content: string;
  type: PostType;
}

export function toPost(record: PostRecord): Post {
  return {
    id: record.id,
    authorId: record.authorId,
    communityId: record.communityId,
    content: record.content,
    type: toPostType(record.type),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
  };
}

/**
 * The wire value of a stored post type.
 *
 * It is exported because a post summary embedded in another response (a comment
 * carries a minimal post reference) must resolve the type the same way, and a
 * second copy of the table would be a second place to forget.
 */
export function toPostType(record: PostTypeRecord): PostType {
  return typeByDatabaseType[record];
}

function toAuthor(record: AuthorRecord): PostListItem["author"] {
  return {
    userId: record.userId,
    name: record.name,
    username: record.username,
    profileImageUrl: record.profileImageUrl,
  };
}

/**
 * Counts are produced by the database through filtered relation counts, so a
 * listing never loads comment or reaction rows just to count them.
 */
export class PostRepository {
  async findById(id: string): Promise<Post | null> {
    const record = await prisma.post.findUnique({
      where: {
        id,
      },
      select: postColumns,
    });

    return record ? toPost(record) : null;
  }

  async create(input: CreatePostInput): Promise<Post> {
    const record = await prisma.post.create({
      data: {
        id: input.id,
        authorId: input.authorId,
        communityId: input.communityId,
        content: input.content,
        type: typeToDatabaseType[input.type],
      },
      select: postColumns,
    });

    return toPost(record);
  }

  async updateContent(id: string, content: string): Promise<Post> {
    const record = await prisma.post.update({
      where: {
        id,
      },
      data: {
        content,
      },
      select: postColumns,
    });

    return toPost(record);
  }

  async softDelete(id: string, deletedAt: Date): Promise<Post> {
    const record = await prisma.post.update({
      where: {
        id,
      },
      data: {
        deletedAt,
      },
      select: postColumns,
    });

    return toPost(record);
  }

  /**
   * One page of a community's posts, newest first.
   *
   * `type` narrows the listing to a single kind of content. It is applied
   * alongside the community and soft-delete filters, so ordering, the page
   * window and the engagement counts are untouched: a filtered page is the same
   * page of a smaller set rather than a different query shape. The index the
   * listing already uses (`[communityId, deletedAt]`) keeps serving it, because
   * a community's posts are bounded — the type is a cheap filter on top, not
   * something that needs an index of its own.
   */
  async listByCommunity(
    communityId: string,
    window: PageWindow,
    type?: PostType,
  ): Promise<PostListItem[]> {
    const records = await prisma.post.findMany({
      where: {
        communityId,
        deletedAt: null,
        ...(type ? { type: typeToDatabaseType[type] } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: window.skip,
      take: window.take,
      select: {
        ...postColumns,
        author: {
          select: authorColumns,
        },
        _count: {
          select: {
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
          },
        },
      },
    });

    return records.map((record) => ({
      ...toPost(record),
      author: toAuthor(record.author),
      commentCount: record._count.comments,
      likeCount: record._count.reactions,
    }));
  }

  /**
   * How many posts the community holds. `type` counts the same filtered set the
   * listing reads, so a filtered page always reports its own total and the page
   * count cannot disagree with the items.
   */
  async countByCommunity(
    communityId: string,
    type?: PostType,
  ): Promise<number> {
    return prisma.post.count({
      where: {
        communityId,
        deletedAt: null,
        ...(type ? { type: typeToDatabaseType[type] } : {}),
      },
    });
  }

  /**
   * Batched variant of `findDetailsById`, used by the feed to hydrate only the
   * Top-K posts it selected. One query materializes the whole page instead of
   * one detail lookup per item, and deleted posts are never returned.
   */
  async findDetailsByIds(ids: string[]): Promise<PostDetails[]> {
    if (ids.length === 0) {
      return [];
    }

    const records = await prisma.post.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
      },
      select: {
        ...postColumns,
        author: {
          select: authorColumns,
        },
        community: true,
        _count: {
          select: {
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
          },
        },
      },
    });

    return records.map((record) => ({
      ...toPost(record),
      author: toAuthor(record.author),
      community: toCommunity(record.community),
      commentCount: record._count.comments,
      likeCount: record._count.reactions,
    }));
  }

  async findDetailsById(id: string): Promise<PostDetails | null> {
    const record = await prisma.post.findUnique({
      where: {
        id,
      },
      select: {
        ...postColumns,
        author: {
          select: authorColumns,
        },
        community: true,
        _count: {
          select: {
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
          },
        },
      },
    });

    if (!record) {
      return null;
    }

    return {
      ...toPost(record),
      author: toAuthor(record.author),
      community: toCommunity(record.community),
      commentCount: record._count.comments,
      likeCount: record._count.reactions,
    };
  }
}
