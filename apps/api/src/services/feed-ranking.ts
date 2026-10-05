import {
  COMMUNITY_MEMBER_ROLES,
  FEED_REASON_CODES,
  type CommunityMemberRole,
  type FeedReasonCode,
} from "@bridgeed/shared";

/**
 * Ranking weights. The feed is a deterministic, explainable heuristic: every
 * weight below is a named constant so the ranking can be re-tuned and asserted
 * without touching the scoring code.
 */
export const FEED_WEIGHTS = {
  RECENCY: 0.36,
  ENGAGEMENT: 0.22,
  CONNECTION: 0.18,
  TOPIC: 0.14,
  COMMUNITY_TIER: 0.1,
  AUTHORED_BY_ME_PENALTY: 0.15,
  ALREADY_ENGAGED_PENALTY: 0.25,
} as const;

/** Hours after which a post keeps half of its recency score (exp decay). */
export const FEED_RECENCY_HALF_LIFE_HOURS = 72;

/** A comment is worth three likes when measuring engagement. */
export const FEED_ENGAGEMENT_COMMENT_WEIGHT = 3;

/** Weighted interactions that saturate the engagement signal. */
export const FEED_ENGAGEMENT_SCALE = 40;

/** Shared skills count more than shared interests inside the topic signal. */
export const FEED_TOPIC_SKILL_WEIGHT = 0.6;
export const FEED_TOPIC_INTEREST_WEIGHT = 0.4;

/** Shared topic matches that saturate the topic signal. */
export const FEED_TOPIC_SCALE = 5;

export const FEED_CONNECTION_ACCEPTED_SCORE = 1;
export const FEED_CONNECTION_PENDING_SCORE = 0.35;

export const FEED_COMMUNITY_TIER_SCORES: Record<CommunityMemberRole, number> = {
  [COMMUNITY_MEMBER_ROLES.OWNER]: 1,
  [COMMUNITY_MEMBER_ROLES.ADMIN]: 1,
  [COMMUNITY_MEMBER_ROLES.MODERATOR]: 0.8,
  [COMMUNITY_MEMBER_ROLES.MEMBER]: 0.6,
};

/** Poster age below which the `recent` reason is attached. */
export const FEED_RECENT_REASON_HOURS = 24;

/** Weighted interactions above which the `popular` reason is attached. */
export const FEED_POPULAR_ENGAGEMENT_THRESHOLD = 10;

/**
 * Tolerance used when a cursor score is compared with a freshly computed score.
 *
 * The score is anchored to a reference time that travels inside the cursor, so
 * a post's score is recomputed from identical inputs on every page of one
 * pagination sequence and the comparison is effectively exact. The tolerance is
 * therefore only a guard against floating point noise: every real signal change
 * (a new like, a comment, a one microsecond newer `createdAt`) is orders of
 * magnitude larger.
 */
export const FEED_SCORE_EPSILON = 1e-12;

/** Relationship between the actor and a post author, as far as feeds care. */
export type FeedConnectionStatus = "accepted" | "pending" | null;

/** Everything the scoring formula needs about one candidate post. */
export interface FeedScoreSignals {
  ageHours: number;
  commentCount: number;
  likeCount: number;
  connectionStatus: FeedConnectionStatus;
  sharedSkillCount: number;
  sharedInterestCount: number;
  communityTier: CommunityMemberRole;
  authoredByMe: boolean;
  alreadyEngaged: boolean;
}

/** The ordering key shared by the sorter, the cursor and the Top-K heap. */
export interface FeedRankingKey {
  score: number;
  createdAt: Date;
  id: string;
}

/** The ordering key stored inside an opaque feed cursor. */
export interface FeedCursorKey {
  score: number;
  createdAt: Date;
  id: string;
  /** Reference time the score was computed against, see isAfterFeedCursor. */
  scoredAt: Date;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

/** Exponential decay: 1 for a brand new post, 0.5 after 72 hours. */
export function computeRecencyScore(ageHours: number): number {
  const age = Number.isFinite(ageHours) && ageHours > 0 ? ageHours : 0;

  return Math.exp(-age / FEED_RECENCY_HALF_LIFE_HOURS);
}

/** Log scaled engagement, saturating at 1 once the scale is reached. */
export function computeEngagementScore(
  commentCount: number,
  likeCount: number,
): number {
  const weighted =
    FEED_ENGAGEMENT_COMMENT_WEIGHT * Math.max(0, commentCount) +
    Math.max(0, likeCount);

  return clampUnit(Math.log1p(weighted) / Math.log1p(FEED_ENGAGEMENT_SCALE));
}

export function computeConnectionScore(status: FeedConnectionStatus): number {
  if (status === "accepted") {
    return FEED_CONNECTION_ACCEPTED_SCORE;
  }

  if (status === "pending") {
    return FEED_CONNECTION_PENDING_SCORE;
  }

  return 0;
}

export function computeTopicScore(
  sharedSkillCount: number,
  sharedInterestCount: number,
): number {
  const weighted =
    FEED_TOPIC_SKILL_WEIGHT * Math.max(0, sharedSkillCount) +
    FEED_TOPIC_INTEREST_WEIGHT * Math.max(0, sharedInterestCount);

  return clampUnit(weighted / FEED_TOPIC_SCALE);
}

export function computeCommunityTierScore(role: CommunityMemberRole): number {
  return FEED_COMMUNITY_TIER_SCORES[role] ?? FEED_COMMUNITY_TIER_SCORES.member;
}

/**
 * The feed score. Positive signals are weighted and summed, then the two
 * fatigue penalties are subtracted:
 *
 *   0.36 * recency + 0.22 * engagement + 0.18 * connection
 *   + 0.14 * topic + 0.10 * communityTier
 *   - 0.15 * authoredByMe - 0.25 * alreadyEngaged
 */
export function computeFeedScore(signals: FeedScoreSignals): number {
  const score =
    FEED_WEIGHTS.RECENCY * computeRecencyScore(signals.ageHours) +
    FEED_WEIGHTS.ENGAGEMENT *
      computeEngagementScore(signals.commentCount, signals.likeCount) +
    FEED_WEIGHTS.CONNECTION * computeConnectionScore(signals.connectionStatus) +
    FEED_WEIGHTS.TOPIC *
      computeTopicScore(signals.sharedSkillCount, signals.sharedInterestCount) +
    FEED_WEIGHTS.COMMUNITY_TIER * computeCommunityTierScore(signals.communityTier);

  const penalties =
    (signals.authoredByMe ? FEED_WEIGHTS.AUTHORED_BY_ME_PENALTY : 0) +
    (signals.alreadyEngaged ? FEED_WEIGHTS.ALREADY_ENGAGED_PENALTY : 0);

  return score - penalties;
}

function weightedEngagement(signals: FeedScoreSignals): number {
  return (
    FEED_ENGAGEMENT_COMMENT_WEIGHT * Math.max(0, signals.commentCount) +
    Math.max(0, signals.likeCount)
  );
}

/**
 * Explains one candidate. Codes are emitted in the fixed order of
 * FEED_REASON_CODES so responses are stable and easy to assert.
 */
export function buildFeedReasons(signals: FeedScoreSignals): FeedReasonCode[] {
  const reasons: FeedReasonCode[] = [];

  if (signals.authoredByMe) {
    reasons.push(FEED_REASON_CODES.AUTHORED_BY_ME);
  }

  if (signals.alreadyEngaged) {
    reasons.push(FEED_REASON_CODES.ALREADY_ENGAGED);
  }

  if (signals.connectionStatus === "accepted") {
    reasons.push(FEED_REASON_CODES.FROM_CONNECTION);
  }

  if (signals.sharedSkillCount > 0) {
    reasons.push(FEED_REASON_CODES.SHARED_SKILL);
  }

  if (signals.sharedInterestCount > 0) {
    reasons.push(FEED_REASON_CODES.SHARED_INTEREST);
  }

  // Every candidate already belongs to a community the actor is active in,
  // because that membership is the hard visibility filter of the feed.
  reasons.push(FEED_REASON_CODES.IN_MY_COMMUNITY);

  if (weightedEngagement(signals) >= FEED_POPULAR_ENGAGEMENT_THRESHOLD) {
    reasons.push(FEED_REASON_CODES.POPULAR);
  }

  if (signals.ageHours <= FEED_RECENT_REASON_HOURS) {
    reasons.push(FEED_REASON_CODES.RECENT);
  }

  return reasons;
}

/**
 * Deterministic total order: score descending, then newer first, then id
 * ascending. A negative result means `a` is ranked before `b`, so the
 * comparator can be used both for sorting and for the Top-K heap.
 */
export function compareFeedRanking(
  a: FeedRankingKey,
  b: FeedRankingKey,
): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }

  const timeDifference = b.createdAt.getTime() - a.createdAt.getTime();

  if (timeDifference !== 0) {
    return timeDifference;
  }

  if (a.id === b.id) {
    return 0;
  }

  return a.id < b.id ? -1 : 1;
}

/**
 * Strictly-after test used by cursor pagination: true when `item` belongs to a
 * later page than the page that ended with `cursor`.
 *
 * The recency signal decays with wall clock time, so a score is only comparable
 * with a score computed against the same reference time. The caller therefore
 * scores every page of one pagination sequence against `cursor.scoredAt`, which
 * makes the cursor item compare equal to itself and keeps page boundaries
 * exact.
 */
export function isAfterFeedCursor(
  item: FeedRankingKey,
  cursor: FeedCursorKey,
): boolean {
  if (item.score < cursor.score - FEED_SCORE_EPSILON) {
    return true;
  }

  if (item.score > cursor.score + FEED_SCORE_EPSILON) {
    return false;
  }

  const itemTime = item.createdAt.getTime();
  const cursorTime = cursor.createdAt.getTime();

  if (itemTime !== cursorTime) {
    return itemTime < cursorTime;
  }

  return item.id > cursor.id;
}

