import type { Community } from "./community";

export const POST_TYPES = {
  TEXT: "text",
} as const;

export type PostType = (typeof POST_TYPES)[keyof typeof POST_TYPES];

/**
 * Public subset of a content author's profile. Shared by posts, comments and
 * reactions so none of them can expose account level data such as email.
 */
export interface ContentAuthor {
  userId: string;
  name: string;
  username: string;
  profileImageUrl: string | null;
}

export interface Post {
  id: string;
  authorId: string;
  communityId: string;
  content: string;
  type: PostType;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** A post enriched with the public author information. */
export interface PostWithAuthor extends Post {
  author: ContentAuthor;
}

/** A post as returned by community post listings, including counts. */
export interface PostListItem extends PostWithAuthor {
  commentCount: number;
  likeCount: number;
}

/** A post enriched with author, community and engagement counts. */
export interface PostDetails extends PostWithAuthor {
  community: Community;
  commentCount: number;
  likeCount: number;
}
