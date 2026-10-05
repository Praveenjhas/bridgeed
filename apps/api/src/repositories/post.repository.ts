import type {
  PageWindow,
  Post,
  PostDetails,
  PostListItem,
  PostType,
} from "@bridgeed/shared";
import type { PostType as PostTypeRecord } from "../generated/prisma/enums";
import { prisma } from "../config/prisma";
import { toCommunity } from "./community.repository";

const typeByDatabaseType: Record<PostTypeRecord, PostType> = {
  TEXT: "text",
};

const typeToDatabaseType: Record<PostType, PostTypeRecord> = {
  text: "TEXT",
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
    type: typeByDatabaseType[record.type],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
  };
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

  async listByCommunity(
    communityId: string,
    window: PageWindow,
  ): Promise<PostListItem[]> {
    const records = await prisma.post.findMany({
      where: {
        communityId,
        deletedAt: null,
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

  async countByCommunity(communityId: string): Promise<number> {
    return prisma.post.count({
      where: {
        communityId,
        deletedAt: null,
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
