import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  type Paginated,
  type Post,
  type PostListItem,
} from "@bridgeed/shared";
import { apiClient } from "@/services/api";

export interface FetchCommunityPostsParams {
  communityId: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Reads one page of a community's posts, newest first.
 *
 * The reader is the signed-in account, taken by the API from the bearer token, so
 * no actor id is sent: the API answers 409 when that account is not an active
 * member, which is how a private community stays private. The listing includes the
 * author and the engagement counts, but no ranking and no "the reader already
 * liked this" flag, because ranking is a feed concept and reactions are reported
 * per actor there.
 */
export async function fetchCommunityPosts({
  communityId,
  page = DEFAULT_PAGE,
  limit = DEFAULT_PAGE_SIZE,
  signal,
}: FetchCommunityPostsParams): Promise<Paginated<PostListItem>> {
  return apiClient.get<Paginated<PostListItem>>(
    `/communities/${encodeURIComponent(communityId)}/posts`,
    { query: { page, limit }, signal },
  );
}

export interface CreateCommunityPostParams {
  communityId: string;
  content: string;
  signal?: AbortSignal;
}

/**
 * Creates a post inside a community.
 *
 * The author is the signed-in account, taken by the API from the bearer token, so
 * a client cannot post as somebody else; only the content is sent. Only an active
 * member may post, the content limit and the empty body rule are enforced by the
 * API, and this function therefore trims the input and sends it as it is: whatever
 * the API rejects is shown to the writer unchanged.
 */
export async function createCommunityPost({
  communityId,
  content,
  signal,
}: CreateCommunityPostParams): Promise<Post> {
  return apiClient.post<Post>(
    `/communities/${encodeURIComponent(communityId)}/posts`,
    { body: { content }, signal },
  );
}
