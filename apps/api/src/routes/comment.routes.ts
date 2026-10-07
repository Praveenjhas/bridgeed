import { Router } from "express";
import { CommentController } from "../controllers/comment.controller";
import { optionalAuth } from "../middleware/require-auth";
import { CommentService } from "../services/comment.service";
import { PostService } from "../services/post.service";
import { CommunityService } from "../services/community.service";
import { CommunityMembershipService } from "../services/community-membership.service";
import { CommentRepository } from "../repositories/comment.repository";
import { PostRepository } from "../repositories/post.repository";
import { CommunityRepository } from "../repositories/community.repository";
import { CommunityMembershipRepository } from "../repositories/community-membership.repository";
import { StudentProfileRepository } from "../repositories/student-profile.repository";

const communityRepository = new CommunityRepository();
const communityMembershipRepository = new CommunityMembershipRepository();
const studentProfileRepository = new StudentProfileRepository();
const postRepository = new PostRepository();
const commentRepository = new CommentRepository();

const communityService = new CommunityService(
  communityRepository,
  studentProfileRepository,
);

const communityMembershipService = new CommunityMembershipService(
  communityMembershipRepository,
  communityService,
);

const postService = new PostService(
  postRepository,
  communityService,
  communityMembershipService,
);

const commentService = new CommentService(
  commentRepository,
  postService,
  communityService,
  communityMembershipService,
);

const commentController = new CommentController(commentService);

/** Mounted at /api/v1/comments */
export const commentRouter = Router();

/**
 * `optionalAuth` makes the authenticated account the reader and the author of
 * these comment operations whenever a bearer token is present, so a client cannot
 * read or edit a comment as somebody else. The explicit `actorId`/`authorId`
 * survives only for the unauthenticated legacy path. Comment create and list
 * live under the post router, which carries the same guard.
 */
commentRouter.use(optionalAuth);

commentRouter.get("/:commentId", commentController.getCommentById);
commentRouter.patch("/:commentId", commentController.updateComment);
commentRouter.delete("/:commentId", commentController.deleteComment);
