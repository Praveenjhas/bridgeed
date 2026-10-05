import {
  COMMUNITY_MEMBER_ROLES,
  CONNECTION_STATUSES,
  FEED_DEFAULT_LIMIT,
  FEED_MAX_LIMIT,
  type CommunityMemberRole,
  type Connection,
  type FeedItem,
  type FeedPage,
  type FeedReasonCode,
} from "@bridgeed/shared";
import { ConnectionRepository } from "../repositories/connection.repository";
import {
  FeedRepository,
  type FeedCandidateRecord,
  type FeedTopicOverlapRecord,
} from "../repositories/feed.repository";
import { PostRepository } from "../repositories/post.repository";
import { StudentInterestRepository } from "../repositories/student-interest.repository";
import { StudentSkillRepository } from "../repositories/student-skill.repository";
import { CommunityService } from "./community.service";
import { MinHeap } from "../utils/min-heap";
import {
  buildFeedReasons,
  compareFeedRanking,
  computeFeedScore,
  isAfterFeedCursor,
  type FeedConnectionStatus,
  type FeedCursorKey,
  type FeedRankingKey,
  type FeedScoreSignals,
} from "./feed-ranking";

export const FEED_ACTOR_REQUIRED_MESSAGE = "actorId is required";
export const FEED_LIMIT_INVALID_MESSAGE = "limit must be a positive integer";
export const FEED_CURSOR_INVALID_MESSAGE = "Feed cursor is invalid";

/** Rolling window of history a feed request may consider, in hours. */
export const FEED_WINDOW_HOURS = 24 * 30;

/**
 * Per source candidate caps. Together they bound one feed request to at most
 * FEED_MAX_CANDIDATES rows, whatever the size of the database.
 */
export const FEED_COMMUNITY_CANDIDATE_CAP = 300;
export const FEED_CONNECTION_CANDIDATE_CAP = 200;
export const FEED_TOPIC_CANDIDATE_CAP = 100;
export const FEED_MAX_CANDIDATES =
  FEED_COMMUNITY_CANDIDATE_CAP +
  FEED_CONNECTION_CANDIDATE_CAP +
  FEED_TOPIC_CANDIDATE_CAP;

/** How many topic matched authors may enter the candidate sweep. */
export const FEED_TOPIC_AUTHOR_LIMIT = 50;

/**
 * Version tag so a future cursor format is rejected instead of misread.
 * Version 2 added the reference time the score was computed against, which is
 * what keeps page boundaries exact (see `isAfterFeedCursor`).
 */
const FEED_CURSOR_VERSION = 2;

/** Scores are transport rounded, but ranked and compared unrounded. */
const FEED_SCORE_PRECISION = 1_000_000;

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

export interface FeedQueryInput {
  limit?: number;
  cursor?: string;
}

interface FeedCursorPayload {
  v: number;
  score: number;
  createdAt: string;
  id: string;
  /** Reference time the score was computed against. */
  at: string;
}

/** A candidate plus everything derived from it, ready to be ranked. */
interface ScoredCandidate extends FeedRankingKey {
  record: FeedCandidateRecord;
  reasons: FeedReasonCode[];
  fromConnection: boolean;
  hasReacted: boolean;
  hasCommented: boolean;
}

/** The parts of the actor's social graph and history that scoring depends on. */
export interface FeedCandidateContext {
  actorId: string;
  now: Date;
  acceptedConnectionIds: ReadonlySet<string>;
  pendingConnectionIds: ReadonlySet<string>;
  communityRoles: ReadonlyMap<string, CommunityMemberRole>;
  overlaps: ReadonlyMap<string, FeedTopicOverlapRecord>;
  reactedPostIds: ReadonlySet<string>;
  commentedPostIds: ReadonlySet<string>;
}

/** Builds the pure scoring input of one candidate. */
export function buildCandidateSignals(
  candidate: FeedCandidateRecord,
  context: FeedCandidateContext,
): FeedScoreSignals {
  const overlap = context.overlaps.get(candidate.authorId);
  const isAcceptedConnection = context.acceptedConnectionIds.has(
    candidate.authorId,
  );
  const isPendingConnection = context.pendingConnectionIds.has(
    candidate.authorId,
  );

  let connectionStatus: FeedConnectionStatus = null;

  if (isAcceptedConnection) {
    connectionStatus = "accepted";
  } else if (isPendingConnection) {
    connectionStatus = "pending";
  }

  const ageHours =
    (context.now.getTime() - candidate.createdAt.getTime()) /
    MILLISECONDS_PER_HOUR;

  return {
    ageHours: ageHours > 0 ? ageHours : 0,
    commentCount: candidate.commentCount,
    likeCount: candidate.likeCount,
    connectionStatus,
    sharedSkillCount: overlap ? overlap.sharedSkillCount : 0,
    sharedInterestCount: overlap ? overlap.sharedInterestCount : 0,
    communityTier:
      context.communityRoles.get(candidate.communityId) ??
      COMMUNITY_MEMBER_ROLES.MEMBER,
    authoredByMe: candidate.authorId === context.actorId,
    alreadyEngaged:
      context.reactedPostIds.has(candidate.id) ||
      context.commentedPostIds.has(candidate.id),
  };
}

/** Scores one candidate and keeps the metadata the response needs. */
export function scoreCandidate(
  candidate: FeedCandidateRecord,
  context: FeedCandidateContext,
): ScoredCandidate {
  const signals = buildCandidateSignals(candidate, context);

  return {
    record: candidate,
    score: computeFeedScore(signals),
    createdAt: candidate.createdAt,
    id: candidate.id,
    reasons: buildFeedReasons(signals),
    fromConnection: signals.connectionStatus === "accepted",
    hasReacted: context.reactedPostIds.has(candidate.id),
    hasCommented: context.commentedPostIds.has(candidate.id),
  };
}

/**
 * Bounded Top-K selection with a min-heap: O(N log K) time and O(K) memory
 * instead of sorting the whole candidate set. The returned slice is fully
 * sorted by the ranking order, so the caller can page over it directly.
 */
export function selectTopK<T extends FeedRankingKey>(
  candidates: readonly T[],
  limit: number,
): T[] {
  if (limit <= 0 || candidates.length === 0) {
    return [];
  }

  // The heap is ordered by the reverse ranking comparator, so its root is the
  // worst item of the current best K and can be evicted in O(log K).
  const heap = new MinHeap<T>((a, b) => compareFeedRanking(b, a));

  for (const candidate of candidates) {
    if (heap.size < limit) {
      heap.push(candidate);
      continue;
    }

    const worst = heap.peek();

    if (worst !== undefined && compareFeedRanking(candidate, worst) < 0) {
      heap.replaceMin(candidate);
    }
  }

  return [...heap.values()].sort(compareFeedRanking);
}

/**
 * Encodes the ordering key of the last item of a page into an opaque cursor.
 * The reference time the score was computed against travels with the cursor, so
 * the next page can score the same candidates against the same clock.
 */
export function encodeFeedCursor(item: FeedRankingKey, scoredAt: Date): string {
  const payload: FeedCursorPayload = {
    v: FEED_CURSOR_VERSION,
    score: item.score,
    createdAt: item.createdAt.toISOString(),
    id: item.id,
    at: scoredAt.toISOString(),
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * Decodes a cursor, rejecting anything that is not a cursor issued by this API
 * with a deterministic 400 instead of silently restarting the feed.
 */
export function decodeFeedCursor(cursor: string): FeedCursorKey {
  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new Error(FEED_CURSOR_INVALID_MESSAGE);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(FEED_CURSOR_INVALID_MESSAGE);
  }

  const { v, score, createdAt, id, at } = parsed as FeedCursorPayload;

  if (v !== FEED_CURSOR_VERSION) {
    throw new Error(FEED_CURSOR_INVALID_MESSAGE);
  }

  if (typeof score !== "number" || !Number.isFinite(score)) {
    throw new Error(FEED_CURSOR_INVALID_MESSAGE);
  }

  if (typeof createdAt !== "string" || typeof id !== "string" || id === "") {
    throw new Error(FEED_CURSOR_INVALID_MESSAGE);
  }

  if (typeof at !== "string") {
    throw new Error(FEED_CURSOR_INVALID_MESSAGE);
  }

  const createdAtDate = new Date(createdAt);
  const scoredAtDate = new Date(at);

  if (
    Number.isNaN(createdAtDate.getTime()) ||
    Number.isNaN(scoredAtDate.getTime())
  ) {
    throw new Error(FEED_CURSOR_INVALID_MESSAGE);
  }

  return {
    score,
    createdAt: createdAtDate,
    id,
    scoredAt: scoredAtDate,
  };
}

/** Default limit is applied here, and oversized limits are clamped. */
export function normalizeFeedLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return FEED_DEFAULT_LIMIT;
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(FEED_LIMIT_INVALID_MESSAGE);
  }

  return Math.min(limit, FEED_MAX_LIMIT);
}

function roundFeedScore(score: number): number {
  return Math.round(score * FEED_SCORE_PRECISION) / FEED_SCORE_PRECISION;
}

function toEmptyFeed(generatedAt: Date, candidatesConsidered: number): FeedPage {
  return {
    items: [],
    nextCursor: null,
    generatedAt: generatedAt.toISOString(),
    candidatesConsidered,
  };
}

/**
 * Candidate generation, ranking and Top-K selection for the home feed.
 *
 * The service performs a fixed number of bounded reads: the actor's active
 * memberships, its connection graph, its topics, three candidate sweeps, one
 * engagement read and one topic overlap read, plus a single hydration query for
 * the selected page. Nothing is proportional to the size of the database, and
 * no query is ever issued per candidate.
 */
export class FeedService {
  constructor(
    private readonly feedRepository: FeedRepository,
    private readonly postRepository: PostRepository,
    private readonly connectionRepository: ConnectionRepository,
    private readonly studentSkillRepository: StudentSkillRepository,
    private readonly studentInterestRepository: StudentInterestRepository,
    private readonly communityService: CommunityService,
  ) {}

  /**
   * Returns one page of the ranked feed of `actorId`.
   *
   * An unknown actor is a 404, but a known actor with nothing eligible (no
   * active membership, no posts, or a cursor past the end) gets an empty feed
   * instead of an error.
   */
  async getFeed(actorId: unknown, query: FeedQueryInput): Promise<FeedPage> {
    const normalizedActorId = this.normalizeActorId(actorId);

    await this.communityService.ensureStudentProfileExists(normalizedActorId);

    // A malformed cursor is rejected before any candidate work is done.
    const cursor =
      query.cursor === undefined ? null : decodeFeedCursor(query.cursor);
    const limit = normalizeFeedLimit(query.limit);
    const generatedAt = new Date();

    // Scores are only comparable when they were computed against the same
    // clock, so a paginated sequence reuses the reference time carried by the
    // cursor. Without this, recency decay between two requests would push the
    // cursor item past its own boundary and pages would repeat items.
    const rankingNow = cursor === null ? generatedAt : cursor.scoredAt;

    const [communityRoles, connections, skills, interests] = await Promise.all([
      this.feedRepository.findActiveCommunityRoles(normalizedActorId),
      this.connectionRepository.findByStudentId(normalizedActorId),
      this.studentSkillRepository.findSkillsByStudentId(normalizedActorId),
      this.studentInterestRepository.findInterestsByStudentId(normalizedActorId),
    ]);

    const communityRolesByCommunityId = new Map<string, CommunityMemberRole>();

    for (const membership of communityRoles) {
      communityRolesByCommunityId.set(membership.communityId, membership.role);
    }

    const communityIds = [...communityRolesByCommunityId.keys()];

    if (communityIds.length === 0) {
      // Without an ACTIVE membership nothing is readable, so there is no
      // candidate to consider and no work to do.
      return toEmptyFeed(generatedAt, 0);
    }

    const { acceptedConnectionIds, pendingConnectionIds, blockedUserIds } =
      this.partitionConnections(normalizedActorId, connections);

    // Blocks are exclusions, never penalties: a blocked student's posts must
    // not be reachable at all, not merely ranked lower.
    const excludedAuthorIds = [...blockedUserIds];

    const skillIds = skills.map((skill) => skill.id);
    const interestIds = interests.map((interest) => interest.id);

    const topicAuthorIds = await this.feedRepository.findTopicAuthorIds({
      skillIds,
      interestIds,
      // The actor and blocked students can never enter through topic affinity.
      excludedUserIds: [...blockedUserIds, normalizedActorId],
      limit: FEED_TOPIC_AUTHOR_LIMIT,
    });

    const since = new Date(
      rankingNow.getTime() - FEED_WINDOW_HOURS * MILLISECONDS_PER_HOUR,
    );

    // Three bounded sweeps. They overlap by design: the community sweep gives
    // broad recall, while the connection and topic sweeps guarantee that those
    // authors are represented even when a community cap truncates its history.
    const [communityCandidates, connectionCandidates, topicCandidates] =
      await Promise.all([
        this.feedRepository.findCandidatePosts({
          communityIds,
          excludedAuthorIds,
          since,
          limit: FEED_COMMUNITY_CANDIDATE_CAP,
        }),
        acceptedConnectionIds.size === 0
          ? []
          : this.feedRepository.findCandidatePosts({
              communityIds,
              authorIds: [...acceptedConnectionIds],
              excludedAuthorIds,
              since,
              limit: FEED_CONNECTION_CANDIDATE_CAP,
            }),
        topicAuthorIds.length === 0
          ? []
          : this.feedRepository.findCandidatePosts({
              communityIds,
              authorIds: topicAuthorIds,
              excludedAuthorIds,
              since,
              limit: FEED_TOPIC_CANDIDATE_CAP,
            }),
      ]);

    const candidatesById = new Map<string, FeedCandidateRecord>();

    // Deduplicate by post id with a Map: a post reachable from several sources
    // is scored once, while still carrying every signal it earned.
    for (const candidate of [
      ...communityCandidates,
      ...connectionCandidates,
      ...topicCandidates,
    ]) {
      if (!candidatesById.has(candidate.id)) {
        candidatesById.set(candidate.id, candidate);
      }
    }

    const candidates = [...candidatesById.values()];
    const candidatesConsidered = candidates.length;

    if (candidates.length === 0) {
      return toEmptyFeed(generatedAt, 0);
    }

    const candidatePostIds = candidates.map((candidate) => candidate.id);
    const authorIds = [...new Set(candidates.map((one) => one.authorId))];

    const [engagement, overlaps] = await Promise.all([
      this.feedRepository.findActedPostIds({
        userId: normalizedActorId,
        postIds: candidatePostIds,
      }),
      this.feedRepository.countSharedTopics({
        studentIds: authorIds,
        skillIds,
        interestIds,
      }),
    ]);

    const context: FeedCandidateContext = {
      actorId: normalizedActorId,
      now: rankingNow,
      acceptedConnectionIds,
      pendingConnectionIds,
      communityRoles: communityRolesByCommunityId,
      overlaps: new Map(overlaps.map((overlap) => [overlap.studentId, overlap])),
      reactedPostIds: new Set(engagement.reactedPostIds),
      commentedPostIds: new Set(engagement.commentedPostIds),
    };

    const scoredCandidates = candidates.map((candidate) =>
      scoreCandidate(candidate, context),
    );

    // Keyset paging: only candidates strictly after the cursor are ranked, so a
    // page never repeats an item an earlier page already returned.
    const remaining =
      cursor === null
        ? scoredCandidates
        : scoredCandidates.filter((candidate) =>
            isAfterFeedCursor(candidate, cursor),
          );

    const selected = selectTopK(remaining, limit);

    if (selected.length === 0) {
      return toEmptyFeed(generatedAt, candidatesConsidered);
    }

    const lastSelected = selected[selected.length - 1];
    const nextCursor =
      lastSelected !== undefined && remaining.length > selected.length
        ? encodeFeedCursor(lastSelected, rankingNow)
        : null;

    // Only the selected Top-K is hydrated, and in a single query.
    const details = await this.postRepository.findDetailsByIds(
      selected.map((candidate) => candidate.id),
    );
    const detailsById = new Map(details.map((detail) => [detail.id, detail]));

    const items: FeedItem[] = [];

    for (const candidate of selected) {
      const detail = detailsById.get(candidate.id);

      if (!detail) {
        // Deleted between ranking and hydration: dropped rather than returned
        // with stale content.
        continue;
      }

      items.push({
        ...detail,
        score: roundFeedScore(candidate.score),
        rank: items.length + 1,
        reasons: candidate.reasons,
        fromConnection: candidate.fromConnection,
        hasReacted: candidate.hasReacted,
        hasCommented: candidate.hasCommented,
      });
    }

    return {
      items,
      nextCursor,
      generatedAt: generatedAt.toISOString(),
      candidatesConsidered,
    };
  }

  /**
   * Splits the actor's connection rows into the three sets ranking cares about.
   * A REJECTED request is neither a signal nor an exclusion.
   */
  private partitionConnections(
    actorId: string,
    connections: Connection[],
  ): {
    acceptedConnectionIds: Set<string>;
    pendingConnectionIds: Set<string>;
    blockedUserIds: Set<string>;
  } {
    const acceptedConnectionIds = new Set<string>();
    const pendingConnectionIds = new Set<string>();
    const blockedUserIds = new Set<string>();

    for (const connection of connections) {
      const otherId =
        connection.requesterId === actorId
          ? connection.receiverId
          : connection.requesterId;

      switch (connection.status) {
        case CONNECTION_STATUSES.BLOCKED:
          blockedUserIds.add(otherId);
          break;
        case CONNECTION_STATUSES.ACCEPTED:
          acceptedConnectionIds.add(otherId);
          break;
        case CONNECTION_STATUSES.PENDING:
          pendingConnectionIds.add(otherId);
          break;
        default:
          break;
      }
    }

    return { acceptedConnectionIds, pendingConnectionIds, blockedUserIds };
  }

  private normalizeActorId(value: unknown): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(FEED_ACTOR_REQUIRED_MESSAGE);
    }

    return value.trim();
  }
}
