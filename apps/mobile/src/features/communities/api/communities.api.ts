import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  type Community,
  type Paginated,
} from "@bridgeed/shared";
import { apiClient } from "@/services/api";

export interface FetchCommunitiesParams {
  /** One based page number, matching the API's paged listings. */
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Reads one page of every community that exists.
 *
 * The listing is intentionally not personalised by the API: it returns plain
 * communities and no membership, so the caller combines it with the actor's
 * memberships to know which ones they already belong to.
 */
export async function fetchCommunities({
  page = DEFAULT_PAGE,
  limit = DEFAULT_PAGE_SIZE,
  signal,
}: FetchCommunitiesParams = {}): Promise<Paginated<Community>> {
  return apiClient.get<Paginated<Community>>("/communities", {
    query: { page, limit },
    signal,
  });
}

export interface FetchCommunityParams {
  communityId: string;
  signal?: AbortSignal;
}

/**
 * Reads one community.
 *
 * This endpoint is public, so it answers without an actor: whether its posts are
 * readable is decided separately by the membership of the requesting student.
 */
export async function fetchCommunity({
  communityId,
  signal,
}: FetchCommunityParams): Promise<Community> {
  return apiClient.get<Community>(
    `/communities/${encodeURIComponent(communityId)}`,
    { signal },
  );
}
