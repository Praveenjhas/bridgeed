import type {
  Comment,
  CommentDetails,
  CommentListItem,
  Paginated,
} from "@bridgeed/shared";
import { CommentRepository } from "../repositories/comment.repository";
import { CommunityService } from "./community.service";
import { CommunityMembershipService } from "./community-membership.service";
import { POST_DELETED_MESSAGE, PostService } from "./post.service";
import {
  normalizeLimit,
  normalizePage,
  toPageWindow,
  toPaginated,
} from "../utils/pagination";

export const COMMENT_NOT_FOUND_MESSAGE = "Comment not found";
export const COMMENT_DELETED_MESSAGE = "Comment has been deleted";
export const COMMENT_AUTHOR_REQUIRED_MESSAGE = "Comment authorId is required";
export const COMMENT_CONTENT_INVALID_MESSAGE =
  "Comment content must be a string";
export const COMMENT_CONTENT_REQUIRED_MESSAGE = "Comment content is required";
export const COMMENT_CONTENT_TOO_LONG_MESSAGE =
  "Comment content must be at most 2000 characters";
export const COMMENT_EDIT_FORBIDDEN_MESSAGE =
  "Only the comment author can edit this comment";
export const COMMENT_DELETE_FORBIDDEN_MESSAGE =
  "Only the comment author can delete this comment";

const MAX_COMMENT_CONTENT_LENGTH = 2000;

export interface CreateCommentInput {
  authorId: unknown;
  content: unknown;
}

export interface ListCommentsQuery {
  page?: number;
  limit?: number;
}

export class CommentService {
  constructor(
    private readonly commentRepository: CommentRepository,
    private readonly postService: PostService,
    private readonly communityService: CommunityService,
    private readonly communityMembershipService: CommunityMembershipService,
  ) {}

  /**
   * Adds a flat comment to a post. The post must exist and not be deleted, and
   * the author must be an active member of the community that owns the post.
   */
  async createComment(
    postId: string,
    input: CreateCommentInput,
  ): Promise<Comment> {
    const authorId = this.normalizeAuthorId(input.authorId);
    const content = this.normalizeContent(input.content);

    const post = await this.postService.requirePost(postId);

    if (post.deletedAt) {
      throw new Error(POST_DELETED_MESSAGE);
    }

    await this.communityService.ensureStudentProfileExists(authorId);

    await this.communityMembershipService.requireActiveMembership(
      post.communityId,
      authorId,
    );

    return this.commentRepository.create({
      id: crypto.randomUUID(),
      postId,
      authorId,
      content,
    });
  }

  /** Lists the comments of a post, oldest first, for active members only. */
  async listComments(
    postId: string,
    actorId: string,
    query: ListCommentsQuery,
  ): Promise<Paginated<CommentListItem>> {
    const post = await this.postService.requirePost(postId);

    await this.communityMembershipService.requireActiveMembership(
      post.communityId,
      actorId,
    );

    if (post.deletedAt) {
      throw new Error(POST_DELETED_MESSAGE);
    }

    const page = normalizePage(query.page);
    const limit = normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.commentRepository.listByPost(postId, toPageWindow(page, limit)),
      this.commentRepository.countByPost(postId),
    ]);

    return toPaginated(items, page, limit, total);
  }

  /** Reads a single comment. A deleted comment never exposes its content. */
  async getComment(
    commentId: string,
    actorId: string,
  ): Promise<CommentDetails> {
    const comment = await this.requireComment(commentId);

    const context =
      await this.commentRepository.findCommunityLookupById(commentId);

    if (!context) {
      throw new Error(COMMENT_NOT_FOUND_MESSAGE);
    }

    await this.communityMembershipService.requireActiveMembership(
      context.communityId,
      actorId,
    );

    if (comment.deletedAt) {
      throw new Error(COMMENT_DELETED_MESSAGE);
    }

    const details = await this.commentRepository.findDetailsById(commentId);

    if (!details) {
      throw new Error(COMMENT_NOT_FOUND_MESSAGE);
    }

    return details;
  }

  /**
   * Only the original author may edit a comment. Deleting roles, moderator and
   * admin rights grant no extra power over someone else's comment.
   */
  async updateComment(
    commentId: string,
    actorId: string,
    content: unknown,
  ): Promise<Comment> {
    const comment = await this.requireComment(commentId);

    if (comment.deletedAt) {
      throw new Error(COMMENT_DELETED_MESSAGE);
    }

    await this.requireActiveMemberForComment(commentId, actorId);

    if (comment.authorId !== actorId) {
      throw new Error(COMMENT_EDIT_FORBIDDEN_MESSAGE);
    }

    return this.commentRepository.updateContent(
      commentId,
      this.normalizeContent(content),
    );
  }

  /** Soft deletes a comment owned by the actor; nothing is removed physically. */
  async deleteComment(commentId: string, actorId: string): Promise<void> {
    const comment = await this.requireComment(commentId);

    if (comment.deletedAt) {
      throw new Error(COMMENT_DELETED_MESSAGE);
    }

    await this.requireActiveMemberForComment(commentId, actorId);

    if (comment.authorId !== actorId) {
      throw new Error(COMMENT_DELETE_FORBIDDEN_MESSAGE);
    }

    await this.commentRepository.softDelete(commentId, new Date());
  }

  /** Shared comment lookup so every comment operation uses one not-found rule. */
  async requireComment(commentId: string): Promise<Comment> {
    const comment = await this.commentRepository.findById(commentId);

    if (!comment) {
      throw new Error(COMMENT_NOT_FOUND_MESSAGE);
    }

    return comment;
  }

  /** Resolves the owning community of a comment and checks actor membership. */
  private async requireActiveMemberForComment(
    commentId: string,
    actorId: string,
  ): Promise<void> {
    const context =
      await this.commentRepository.findCommunityLookupById(commentId);

    if (!context) {
      throw new Error(COMMENT_NOT_FOUND_MESSAGE);
    }

    await this.communityMembershipService.requireActiveMembership(
      context.communityId,
      actorId,
    );
  }

  private normalizeAuthorId(value: unknown): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(COMMENT_AUTHOR_REQUIRED_MESSAGE);
    }

    return value.trim();
  }

  private normalizeContent(value: unknown): string {
    if (typeof value !== "string") {
      throw new Error(COMMENT_CONTENT_INVALID_MESSAGE);
    }

    const content = value.trim();

    if (content.length === 0) {
      throw new Error(COMMENT_CONTENT_REQUIRED_MESSAGE);
    }

    if (content.length > MAX_COMMENT_CONTENT_LENGTH) {
      throw new Error(COMMENT_CONTENT_TOO_LONG_MESSAGE);
    }

    return content;
  }
}
