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
  /**
   * The student reading. The API answers 409 when this student is not an active
   * member, which is how a private community stays private.
   */
  actorId: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Reads one page of a community's posts, newest first.
 *
 * The listing includes the author and the engagement counts, but no ranking and
 * no "the reader already liked this" flag, because ranking is a feed concept and
 * reactions are reported per actor there.
 */
export async function fetchCommunityPosts({
  communityId,
  actorId,
  page = DEFAULT_PAGE,
  limit = DEFAULT_PAGE_SIZE,
  signal,
}: FetchCommunityPostsParams): Promise<Paginated<PostListItem>> {
  return apiClient.get<Paginated<PostListItem>>(
    `/communities/${encodeURIComponent(communityId)}/posts`,
    { query: { actorId, page, limit }, signal },
  );
}

export interface CreateCommunityPostParams {
  communityId: string;
  /** Author of the post. This route accepts `authorId` or `actorId`. */
  authorId: string;
  content: string;
  signal?: AbortSignal;
}

/**
 * Creates a post inside a community.
 *
 * Only an active member may post, the content limit and the empty body rule are
 * enforced by the API, and this function therefore trims the input and sends it
 * as it is: whatever the API rejects is shown to the writer unchanged.
 */
export async function createCommunityPost({
  communityId,
  authorId,
  content,
  signal,
}: CreateCommunityPostParams): Promise<Post> {
  return apiClient.post<Post>(
    `/communities/${encodeURIComponent(communityId)}/posts`,
    { body: { authorId, content }, signal },
  );
}
