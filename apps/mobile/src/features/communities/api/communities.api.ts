import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  type Community,
  type CommunityType,
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

export interface CreateCommunityParams {
  name: string;
  slug: string;
  type: CommunityType;
  /** Omitted or empty when the creator wrote none. */
  description?: string;
  signal?: AbortSignal;
}

/**
 * Creates a community and makes the creator its owner.
 *
 * The owner is the signed-in account, taken by the API from the bearer token, so
 * no `createdById` is sent: a client cannot create a community owned by somebody
 * else. Only the visible fields are sent; the API normalizes the name and slug,
 * enforces the length limits and answers 409 when the slug is already taken,
 * which this function surfaces unchanged.
 */
export async function createCommunity({
  name,
  slug,
  type,
  description,
  signal,
}: CreateCommunityParams): Promise<Community> {
  return apiClient.post<Community>("/communities", {
    body: { name, slug, type, description },
    signal,
  });
}
