import type { Community } from "./community";

/**
 * What a post is.
 *
 * BridgeEd is an education-only network, so a post is not a generic message: it
 * declares which kind of academic content it carries. The type lives on the one
 * Post entity rather than in a table per kind, so the social graph — author,
 * community, comments, reactions — stays single and shared.
 */
export const POST_TYPES = {
  DISCUSSION: "discussion",
  QUESTION: "question",
  RESOURCE: "resource",
  ACHIEVEMENT: "achievement",
  RESEARCH: "research",
  ANNOUNCEMENT: "announcement",
  OPPORTUNITY: "opportunity",
} as const;

export type PostType = (typeof POST_TYPES)[keyof typeof POST_TYPES];

/**
 * Every supported type, in the order the composer offers them and the order a
 * type filter lists them, so a client never writes the set out again.
 */
export const POST_TYPE_VALUES: readonly PostType[] = [
  POST_TYPES.DISCUSSION,
  POST_TYPES.QUESTION,
  POST_TYPES.RESOURCE,
  POST_TYPES.ACHIEVEMENT,
  POST_TYPES.RESEARCH,
  POST_TYPES.ANNOUNCEMENT,
  POST_TYPES.OPPORTUNITY,
];

/** How the type is named wherever it is shown. */
export const POST_TYPE_LABELS: Record<PostType, string> = {
  [POST_TYPES.DISCUSSION]: "Discussion",
  [POST_TYPES.QUESTION]: "Question",
  [POST_TYPES.RESOURCE]: "Resource",
  [POST_TYPES.ACHIEVEMENT]: "Achievement",
  [POST_TYPES.RESEARCH]: "Research",
  [POST_TYPES.ANNOUNCEMENT]: "Announcement",
  [POST_TYPES.OPPORTUNITY]: "Opportunity",
};

/** One line telling a student when to choose the type. */
export const POST_TYPE_DESCRIPTIONS: Record<PostType, string> = {
  [POST_TYPES.DISCUSSION]: "Share an academic thought or start a conversation.",
  [POST_TYPES.QUESTION]: "Ask other students for help or perspective.",
  [POST_TYPES.RESOURCE]: "Share something useful for learning.",
  [POST_TYPES.ACHIEVEMENT]: "Share an academic accomplishment.",
  [POST_TYPES.RESEARCH]: "Share research, papers, or research progress.",
  [POST_TYPES.ANNOUNCEMENT]: "Share an academic or community announcement.",
  [POST_TYPES.OPPORTUNITY]: "Share an academic opportunity.",
};

/**
 * The type a post gets when the client does not choose one.
 *
 * It is what keeps every post written before types existed both valid and
 * readable: the migration maps those rows onto this same value.
 */
export const DEFAULT_POST_TYPE: PostType = POST_TYPES.DISCUSSION;

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
