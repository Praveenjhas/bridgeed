import { Router } from "express";
import { ReactionController } from "../controllers/reaction.controller";
import { optionalAuth } from "../middleware/require-auth";
import { ReactionService } from "../services/reaction.service";
import { PostService } from "../services/post.service";
import { CommentService } from "../services/comment.service";
import { CommunityService } from "../services/community.service";
import { CommunityMembershipService } from "../services/community-membership.service";
import { PostReactionRepository } from "../repositories/post-reaction.repository";
import { CommentReactionRepository } from "../repositories/comment-reaction.repository";
import { PostRepository } from "../repositories/post.repository";
import { CommentRepository } from "../repositories/comment.repository";
import { CommunityRepository } from "../repositories/community.repository";
import { CommunityMembershipRepository } from "../repositories/community-membership.repository";
import { StudentProfileRepository } from "../repositories/student-profile.repository";

const communityRepository = new CommunityRepository();
const communityMembershipRepository = new CommunityMembershipRepository();
const studentProfileRepository = new StudentProfileRepository();
const postRepository = new PostRepository();
const commentRepository = new CommentRepository();
const postReactionRepository = new PostReactionRepository();
const commentReactionRepository = new CommentReactionRepository();

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

const reactionService = new ReactionService(
  postReactionRepository,
  commentReactionRepository,
  postService,
  commentService,
  communityService,
  communityMembershipService,
);

const reactionController = new ReactionController(reactionService);

/** Mounted at /api/v1/posts/:postId/reactions */
export const postReactionRouter = Router({ mergeParams: true });

/**
 * `optionalAuth` makes the reacting account the authenticated one whenever a
 * bearer token is present, so a client cannot like on somebody else's behalf.
 * The explicit `userId` shape survives only for the unauthenticated legacy path.
 */
postReactionRouter.use(optionalAuth);

postReactionRouter.post("/", reactionController.likePost);
postReactionRouter.delete("/", reactionController.unlikePost);

/** Mounted at /api/v1/comments/:commentId/reactions */
export const commentReactionRouter = Router({ mergeParams: true });

commentReactionRouter.use(optionalAuth);

commentReactionRouter.post("/", reactionController.likeComment);
commentReactionRouter.delete("/", reactionController.unlikeComment);
