import {
  DEFAULT_POST_TYPE,
  POST_TYPE_VALUES,
  type Paginated,
  type Post,
  type PostDetails,
  type PostListItem,
  type PostType,
} from "@bridgeed/shared";
import { PostRepository } from "../repositories/post.repository";
import { CommunityService } from "./community.service";
import { CommunityMembershipService } from "./community-membership.service";
import {
  normalizeLimit,
  normalizePage,
  toPageWindow,
  toPaginated,
} from "../utils/pagination";

export const POST_NOT_FOUND_MESSAGE = "Post not found";
export const POST_DELETED_MESSAGE = "Post has been deleted";
export const POST_AUTHOR_REQUIRED_MESSAGE = "Post authorId is required";
export const POST_CONTENT_INVALID_MESSAGE = "Post content must be a string";
export const POST_CONTENT_REQUIRED_MESSAGE = "Post content is required";
export const POST_CONTENT_TOO_LONG_MESSAGE =
  "Post content must be at most 5000 characters";
export const POST_TYPE_INVALID_MESSAGE = "Post type is invalid";
export const POST_EDIT_FORBIDDEN_MESSAGE =
  "Only the post author can edit this post";
export const POST_DELETE_FORBIDDEN_MESSAGE =
  "Only the post author can delete this post";

const MAX_POST_CONTENT_LENGTH = 5000;

export interface CreatePostInput {
  authorId: unknown;
  content: unknown;
  /** Optional canonical type; omitted by clients that do not choose one. */
  type?: unknown;
}

export interface ListPostsQuery {
  page?: number;
  limit?: number;
  /** Narrows the listing to one kind of content. Omitted means every type. */
  type?: PostType;
}

export class PostService {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly communityService: CommunityService,
    private readonly communityMembershipService: CommunityMembershipService,
  ) {}

  /**
   * Creates a post inside a community. The author must be an active member; the
   * author is always taken from the authenticated actor, never from the body.
   *
   * `type` is optional: a client that does not choose one gets DEFAULT_POST_TYPE,
   * which is what keeps older clients working unchanged. A value outside the
   * canonical set is rejected rather than quietly turned into a discussion, so a
   * typo in a client cannot silently label content.
   */
  async createPost(communityId: string, input: CreatePostInput): Promise<Post> {
    const authorId = this.normalizeAuthorId(input.authorId);
    const content = this.normalizeContent(input.content);
    const type = this.normalizeType(input.type);

    await this.communityService.requireCommunity(communityId);

    await this.communityService.ensureStudentProfileExists(authorId);

    await this.communityMembershipService.requireActiveMembership(
      communityId,
      authorId,
    );

    return this.postRepository.create({
      id: crypto.randomUUID(),
      authorId,
      communityId,
      content,
      type,
    });
  }

  /**
   * Lists the posts of a community, newest first, for active members only.
   *
   * `query.type` filters the listing to one kind of content without changing the
   * ordering or the pagination rules; the total it reports is the total of that
   * filtered set, so the page count and the items stay consistent.
   */
  async listCommunityPosts(
    communityId: string,
    actorId: string,
    query: ListPostsQuery,
  ): Promise<Paginated<PostListItem>> {
    await this.communityService.requireCommunity(communityId);

    await this.communityMembershipService.requireActiveMembership(
      communityId,
      actorId,
    );

    const page = normalizePage(query.page);
    const limit = normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.postRepository.listByCommunity(
        communityId,
        toPageWindow(page, limit),
        query.type,
      ),
      this.postRepository.countByCommunity(communityId, query.type),
    ]);

    return toPaginated(items, page, limit, total);
  }

  /** Reads a single post. A deleted post never exposes its original content. */
  async getPost(postId: string, actorId: string): Promise<PostDetails> {
    const post = await this.requirePost(postId);

    await this.communityMembershipService.requireActiveMembership(
      post.communityId,
      actorId,
    );

    if (post.deletedAt) {
      throw new Error(POST_DELETED_MESSAGE);
    }

    const details = await this.postRepository.findDetailsById(postId);

    if (!details) {
      throw new Error(POST_NOT_FOUND_MESSAGE);
    }

    return details;
  }

  /**
   * Only the original author may edit a post, and only while the post is not
   * deleted. Ownership is compared against the stored authorId, so moderator
   * and admin roles gain no extra power in this slice.
   */
  async updatePost(
    postId: string,
    actorId: string,
    content: unknown,
  ): Promise<Post> {
    const post = await this.requirePost(postId);

    if (post.deletedAt) {
      throw new Error(POST_DELETED_MESSAGE);
    }

    await this.communityMembershipService.requireActiveMembership(
      post.communityId,
      actorId,
    );

    if (post.authorId !== actorId) {
      throw new Error(POST_EDIT_FORBIDDEN_MESSAGE);
    }

    return this.postRepository.updateContent(
      postId,
      this.normalizeContent(content),
    );
  }

  /** Soft deletes a post owned by the actor; nothing is removed physically. */
  async deletePost(postId: string, actorId: string): Promise<void> {
    const post = await this.requirePost(postId);

    if (post.deletedAt) {
      throw new Error(POST_DELETED_MESSAGE);
    }

    await this.communityMembershipService.requireActiveMembership(
      post.communityId,
      actorId,
    );

    if (post.authorId !== actorId) {
      throw new Error(POST_DELETE_FORBIDDEN_MESSAGE);
    }

    await this.postRepository.softDelete(postId, new Date());
  }

  /** Shared post lookup so every post operation uses one "Post not found" rule. */
  async requirePost(postId: string): Promise<Post> {
    const post = await this.postRepository.findById(postId);

    if (!post) {
      throw new Error(POST_NOT_FOUND_MESSAGE);
    }

    return post;
  }

  private normalizeAuthorId(value: unknown): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(POST_AUTHOR_REQUIRED_MESSAGE);
    }

    return value.trim();
  }

  private normalizeContent(value: unknown): string {
    if (typeof value !== "string") {
      throw new Error(POST_CONTENT_INVALID_MESSAGE);
    }

    const content = value.trim();

    if (content.length === 0) {
      throw new Error(POST_CONTENT_REQUIRED_MESSAGE);
    }

    if (content.length > MAX_POST_CONTENT_LENGTH) {
      throw new Error(POST_CONTENT_TOO_LONG_MESSAGE);
    }

    return content;
  }

  /**
   * Resolves the optional post type.
   *
   * Absent, `null` or an empty string means "the client did not choose", which is
   * the documented default rather than an error, so older clients keep working.
   * Anything else has to be one of the canonical values, compared
   * case-insensitively so `QUESTION` and `question` mean the same thing. An
   * unknown value is a 400: guessing would label a student's content for them.
   */
  private normalizeType(value: unknown): PostType {
    if (value === undefined || value === null) {
      return DEFAULT_POST_TYPE;
    }

    if (typeof value !== "string") {
      throw new Error(POST_TYPE_INVALID_MESSAGE);
    }

    const candidate = value.trim().toLowerCase();

    if (candidate.length === 0) {
      return DEFAULT_POST_TYPE;
    }

    const type = POST_TYPE_VALUES.find((known) => known === candidate);

    if (!type) {
      throw new Error(POST_TYPE_INVALID_MESSAGE);
    }

    return type;
  }
}
