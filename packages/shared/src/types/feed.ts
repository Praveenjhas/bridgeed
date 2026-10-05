import type { PostDetails } from "./post";

/** Page size used when the client does not send `limit`. */
export const FEED_DEFAULT_LIMIT = 20;

/** Hard upper bound for `limit`, so a feed request stays a bounded read. */
export const FEED_MAX_LIMIT = 50;

/**
 * Why a post was allowed into the feed, or why its score moved. Codes are
 * stable, lower case identifiers so clients can map them onto copy, and the
 * list is kept deterministic (always emitted in this order).
 */
export const FEED_REASON_CODES = {
  AUTHORED_BY_ME: "authored_by_me",
  ALREADY_ENGAGED: "already_engaged",
  FROM_CONNECTION: "from_connection",
  SHARED_SKILL: "shared_skill",
  SHARED_INTEREST: "shared_interest",
  IN_MY_COMMUNITY: "in_my_community",
  POPULAR: "popular",
  RECENT: "recent",
} as const;

export type FeedReasonCode =
  (typeof FEED_REASON_CODES)[keyof typeof FEED_REASON_CODES];

/**
 * A ranked feed entry. It carries the same payload as a post detail, plus the
 * ranking metadata needed to explain and render the entry.
 */
export interface FeedItem extends PostDetails {
  /** Final ranking score, rounded for transport only. */
  score: number;
  /** One based position of the item inside this page. */
  rank: number;
  reasons: FeedReasonCode[];
  /** True when the author is an accepted connection of the actor. */
  fromConnection: boolean;
  /** True when the actor already reacted to this post. */
  hasReacted: boolean;
  /** True when the actor already commented on this post. */
  hasCommented: boolean;
}

/**
 * One page of a ranked feed. The feed is cursor based rather than offset based,
 * because scores move as engagement changes.
 */
export interface FeedPage {
  items: FeedItem[];
  /** Opaque cursor for the next page, or null when the feed is exhausted. */
  nextCursor: string | null;
  /** Generation timestamp, so clients can reason about freshness. */
  generatedAt: string;
  /** Number of deduplicated candidates that were ranked for this request. */
  candidatesConsidered: number;
}
