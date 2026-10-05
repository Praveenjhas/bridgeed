import type { ContentAuthor } from "./post";

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** A comment enriched with the public author information. */
export interface CommentWithAuthor extends Comment {
  author: ContentAuthor;
}

/** A comment as returned by post comment listings, including counts. */
export interface CommentListItem extends CommentWithAuthor {
  likeCount: number;
}

/**
 * Minimal post reference returned with a comment. It intentionally exposes no
 * post content, so a comment can never leak a deleted post.
 */
export interface CommentPostSummary {
  id: string;
  communityId: string;
  authorId: string;
}

/** A comment enriched with author, post reference and engagement counts. */
export interface CommentDetails extends CommentWithAuthor {
  post: CommentPostSummary;
  likeCount: number;
}
