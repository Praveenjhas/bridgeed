export const REACTION_TYPES = {
  LIKE: "like",
} as const;

export type ReactionType =
  (typeof REACTION_TYPES)[keyof typeof REACTION_TYPES];

export interface PostReaction {
  id: string;
  postId: string;
  userId: string;
  type: ReactionType;
  createdAt: string;
}

export interface CommentReaction {
  id: string;
  commentId: string;
  userId: string;
  type: ReactionType;
  createdAt: string;
}
