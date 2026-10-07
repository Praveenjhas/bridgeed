import { FEED_DEFAULT_LIMIT, type FeedPage } from "@bridgeed/shared";
import { apiClient } from "@/services/api";

export interface FetchFeedPageParams {
  /** The student the feed is ranked for. */
  actorId: string;
  /** Opaque cursor from the previous page; null for the first page. */
  cursor?: string | null;
  /** Page size. Defaults to the shared `FEED_DEFAULT_LIMIT`. */
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Reads one page of the ranked feed.
 *
 * The cursor is treated as opaque on purpose: only the API decides what it
 * means, which keeps pagination stable while scores move between requests.
 */
export async function fetchFeedPage({
  actorId,
  cursor = null,
  limit = FEED_DEFAULT_LIMIT,
  signal,
}: FetchFeedPageParams): Promise<FeedPage> {
  return apiClient.get<FeedPage>("/feed", {
    query: { actorId, limit, cursor },
    signal,
  });
}
