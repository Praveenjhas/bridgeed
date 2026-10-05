import {
  POST_TYPES,
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

const POST_TYPE_VALUES: readonly string[] = Object.values(POST_TYPES);

export interface CreatePostInput {
  authorId: unknown;
  content: unknown;
  type?: unknown;
}

export interface ListPostsQuery {
  page?: number;
  limit?: number;
}

export class PostService {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly communityService: CommunityService,
    private readonly communityMembershipService: CommunityMembershipService,
  ) {}

  /**
   * Creates a post inside a community. The author must be an active member;
   * the post type is always TEXT in this version and any other value sent by
   * the client is rejected instead of trusted.
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

  /** Lists the posts of a community, newest first, for active members only. */
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
      ),
      this.postRepository.countByCommunity(communityId),
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

  private normalizeType(value: unknown): PostType {
    if (value === undefined || value === null) {
      return POST_TYPES.TEXT;
    }

    if (typeof value !== "string") {
      throw new Error(POST_TYPE_INVALID_MESSAGE);
    }

    const type = value.trim().toLowerCase();

    // Only TEXT exists in this version, so any other value is invalid input
    // rather than a value the client is allowed to choose.
    if (!POST_TYPE_VALUES.includes(type) || type !== POST_TYPES.TEXT) {
      throw new Error(POST_TYPE_INVALID_MESSAGE);
    }

    return POST_TYPES.TEXT;
  }
}
