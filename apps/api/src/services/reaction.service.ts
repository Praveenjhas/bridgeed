import {
  REACTION_TYPES,
  type CommentReaction,
  type PostReaction,
  type ReactionType,
} from "@bridgeed/shared";
import { CommentReactionRepository } from "../repositories/comment-reaction.repository";
import {
  PostReactionRepository,
  REACTION_ALREADY_EXISTS_MESSAGE,
} from "../repositories/post-reaction.repository";
import { COMMENT_DELETED_MESSAGE, CommentService } from "./comment.service";
import { CommunityService } from "./community.service";
import { CommunityMembershipService } from "./community-membership.service";
import { POST_DELETED_MESSAGE, PostService } from "./post.service";

export const REACTION_NOT_FOUND_MESSAGE = "Reaction not found";
export const REACTION_USER_REQUIRED_MESSAGE = "userId is required";
export const REACTION_TYPE_INVALID_MESSAGE = "Reaction type is invalid";

const REACTION_TYPE_VALUES: readonly string[] = Object.values(REACTION_TYPES);

export interface CreateReactionInput {
  userId: unknown;
  type?: unknown;
}

/**
 * Reactions are always derived from the database. The client cannot pick a
 * reaction type other than LIKE in this version, and it cannot react on behalf
 * of somebody else because the actor id is compared against the stored row.
 */
export class ReactionService {
  constructor(
    private readonly postReactionRepository: PostReactionRepository,
    private readonly commentReactionRepository: CommentReactionRepository,
    private readonly postService: PostService,
    private readonly commentService: CommentService,
    private readonly communityService: CommunityService,
    private readonly communityMembershipService: CommunityMembershipService,
  ) {}

  /** Likes a post. Duplicate likes fail deterministically instead of silently. */
  async likePost(
    postId: string,
    input: CreateReactionInput,
  ): Promise<PostReaction> {
    const userId = this.normalizeUserId(input.userId);
    const type = this.normalizeType(input.type);

    const post = await this.postService.requirePost(postId);

    if (post.deletedAt) {
      throw new Error(POST_DELETED_MESSAGE);
    }

    await this.requireActiveMember(post.communityId, userId);

    return this.postReactionRepository.create({
      id: crypto.randomUUID(),
      postId,
      userId,
      type,
    });
  }

  /** Removes the actor's own like from a post. */
  async unlikePost(postId: string, userId: unknown): Promise<void> {
    const actorId = this.normalizeUserId(userId);

    const post = await this.postService.requirePost(postId);

    if (post.deletedAt) {
      throw new Error(POST_DELETED_MESSAGE);
    }

    await this.requireActiveMember(post.communityId, actorId);

    const deleted = await this.postReactionRepository.delete(postId, actorId);

    if (deleted === 0) {
      throw new Error(REACTION_NOT_FOUND_MESSAGE);
    }
  }

  /** Likes a comment. Duplicate likes fail deterministically instead of silently. */
  async likeComment(
    commentId: string,
    input: CreateReactionInput,
  ): Promise<CommentReaction> {
    const userId = this.normalizeUserId(input.userId);
    const type = this.normalizeType(input.type);

    const communityId = await this.requireCommentCommunity(commentId);

    await this.requireActiveMember(communityId, userId);

    return this.commentReactionRepository.create({
      id: crypto.randomUUID(),
      commentId,
      userId,
      type,
    });
  }

  /** Removes the actor's own like from a comment. */
  async unlikeComment(commentId: string, userId: unknown): Promise<void> {
    const actorId = this.normalizeUserId(userId);

    const communityId = await this.requireCommentCommunity(commentId);

    await this.requireActiveMember(communityId, actorId);

    const deleted = await this.commentReactionRepository.delete(
      commentId,
      actorId,
    );

    if (deleted === 0) {
      throw new Error(REACTION_NOT_FOUND_MESSAGE);
    }
  }

  /**
   * Reactions authorize through the community of the target, resolved through
   * the post. A deleted comment or a deleted post can no longer be reacted to.
   */
  private async requireCommentCommunity(commentId: string): Promise<string> {
    const comment = await this.commentService.requireComment(commentId);

    if (comment.deletedAt) {
      throw new Error(COMMENT_DELETED_MESSAGE);
    }

    const post = await this.postService.requirePost(comment.postId);

    if (post.deletedAt) {
      throw new Error(POST_DELETED_MESSAGE);
    }

    return post.communityId;
  }

  private async requireActiveMember(
    communityId: string,
    userId: string,
  ): Promise<void> {
    await this.communityService.ensureStudentProfileExists(userId);

    await this.communityMembershipService.requireActiveMembership(
      communityId,
      userId,
    );
  }

  private normalizeUserId(value: unknown): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(REACTION_USER_REQUIRED_MESSAGE);
    }

    return value.trim();
  }

  private normalizeType(value: unknown): ReactionType {
    if (value === undefined || value === null) {
      return REACTION_TYPES.LIKE;
    }

    if (typeof value !== "string") {
      throw new Error(REACTION_TYPE_INVALID_MESSAGE);
    }

    const type = value.trim().toLowerCase();

    // Only LIKE exists in this version, so nothing else can be selected here
    // even though the schema is ready for more reaction types later.
    if (!REACTION_TYPE_VALUES.includes(type) || type !== REACTION_TYPES.LIKE) {
      throw new Error(REACTION_TYPE_INVALID_MESSAGE);
    }

    return REACTION_TYPES.LIKE;
  }
}
