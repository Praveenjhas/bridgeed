import type {
  Comment,
  CommentDetails,
  CommentListItem,
  PageWindow,
} from "@bridgeed/shared";
import { prisma } from "../config/prisma";

/** Only public profile columns are selected for content authors. */
const authorColumns = {
  userId: true,
  name: true,
  username: true,
  profileImageUrl: true,
} as const;

const commentColumns = {
  id: true,
  postId: true,
  authorId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

/** Post columns returned with a comment: never the post content itself. */
const postSummaryColumns = {
  id: true,
  communityId: true,
  authorId: true,
} as const;

interface AuthorRecord {
  userId: string;
  name: string;
  username: string;
  profileImageUrl: string | null;
}

interface CommentRecord {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface PostSummaryRecord {
  id: string;
  communityId: string;
  authorId: string;
}

/**
 * The community of a comment is always resolved through its post, so a comment
 * can never authorize against a community it does not really belong to.
 */
export interface CommentCommunityLookup {
  commentId: string;
  postId: string;
  communityId: string;
}

export interface CreateCommentInput {
  id: string;
  postId: string;
  authorId: string;
  content: string;
}

export function toComment(record: CommentRecord): Comment {
  return {
    id: record.id,
    postId: record.postId,
    authorId: record.authorId,
    content: record.content,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
  };
}

function toAuthor(record: AuthorRecord): CommentListItem["author"] {
  return {
    userId: record.userId,
    name: record.name,
    username: record.username,
    profileImageUrl: record.profileImageUrl,
  };
}

function toPostSummary(record: PostSummaryRecord): CommentDetails["post"] {
  return {
    id: record.id,
    communityId: record.communityId,
    authorId: record.authorId,
  };
}

export class CommentRepository {
  async findById(id: string): Promise<Comment | null> {
    const record = await prisma.comment.findUnique({
      where: {
        id,
      },
      select: commentColumns,
    });

    return record ? toComment(record) : null;
  }

  /** Resolves the owning community of a comment through its post. */
  async findCommunityLookupById(
    id: string,
  ): Promise<CommentCommunityLookup | null> {
    const record = await prisma.comment.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        postId: true,
        post: {
          select: {
            communityId: true,
          },
        },
      },
    });

    if (!record) {
      return null;
    }

    return {
      commentId: record.id,
      postId: record.postId,
      communityId: record.post.communityId,
    };
  }

  async create(input: CreateCommentInput): Promise<Comment> {
    const record = await prisma.comment.create({
      data: {
        id: input.id,
        postId: input.postId,
        authorId: input.authorId,
        content: input.content,
      },
      select: commentColumns,
    });

    return toComment(record);
  }

  async updateContent(id: string, content: string): Promise<Comment> {
    const record = await prisma.comment.update({
      where: {
        id,
      },
      data: {
        content,
      },
      select: commentColumns,
    });

    return toComment(record);
  }

  async softDelete(id: string, deletedAt: Date): Promise<Comment> {
    const record = await prisma.comment.update({
      where: {
        id,
      },
      data: {
        deletedAt,
      },
      select: commentColumns,
    });

    return toComment(record);
  }

  async listByPost(
    postId: string,
    window: PageWindow,
  ): Promise<CommentListItem[]> {
    const records = await prisma.comment.findMany({
      where: {
        postId,
        deletedAt: null,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: window.skip,
      take: window.take,
      select: {
        ...commentColumns,
        author: {
          select: authorColumns,
        },
        _count: {
          select: {
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
      ...toComment(record),
      author: toAuthor(record.author),
      likeCount: record._count.reactions,
    }));
  }

  async countByPost(postId: string): Promise<number> {
    return prisma.comment.count({
      where: {
        postId,
        deletedAt: null,
      },
    });
  }

  async findDetailsById(id: string): Promise<CommentDetails | null> {
    const record = await prisma.comment.findUnique({
      where: {
        id,
      },
      select: {
        ...commentColumns,
        author: {
          select: authorColumns,
        },
        post: {
          select: postSummaryColumns,
        },
        _count: {
          select: {
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
      ...toComment(record),
      author: toAuthor(record.author),
      post: toPostSummary(record.post),
      likeCount: record._count.reactions,
    };
  }
}
