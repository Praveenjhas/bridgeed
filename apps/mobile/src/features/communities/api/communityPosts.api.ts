import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  type Paginated,
  type Post,
  type PostListItem,
  type PostType,
} from "@bridgeed/shared";
import { apiClient } from "@/services/api";

export interface FetchCommunityPostsParams {
  communityId: string;
  page?: number;
  limit?: number;
  /**
   * Narrows the listing to one kind of content. Omitted or null asks for every
   * type, which is what the API did before types existed.
   */
  type?: PostType | null;
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
 *
 * `type` filters the listing without changing its order or its pagination: the
 * total and page count the API reports are those of the filtered set, so a
 * filtered screen never has to reconcile two different totals.
 */
export async function fetchCommunityPosts({
  communityId,
  page = DEFAULT_PAGE,
  limit = DEFAULT_PAGE_SIZE,
  type = null,
  signal,
}: FetchCommunityPostsParams): Promise<Paginated<PostListItem>> {
  return apiClient.get<Paginated<PostListItem>>(
    `/communities/${encodeURIComponent(communityId)}/posts`,
    { query: { page, limit, type }, signal },
  );
}

export interface CreateCommunityPostParams {
  communityId: string;
  content: string;
  /**
   * What is being shared. Omitted means the API stores the canonical default,
   * so a caller that does not ask for a type keeps the previous behaviour.
   */
  type?: PostType;
  signal?: AbortSignal;
}

/**
 * Creates a post inside a community.
 *
 * The author is the signed-in account, taken by the API from the bearer token, so
 * a client cannot post as somebody else; only the content and the chosen type are
 * sent. Only an active member may post, the content limit and the empty body rule
 * are enforced by the API, and this function therefore trims the input and sends
 * it as it is: whatever the API rejects is shown to the writer unchanged.
 */
export async function createCommunityPost({
  communityId,
  content,
  type,
  signal,
}: CreateCommunityPostParams): Promise<Post> {
  return apiClient.post<Post>(
    `/communities/${encodeURIComponent(communityId)}/posts`,
    { body: { content, type }, signal },
  );
}
