import { Router } from "express";
import { PostController } from "../controllers/post.controller";
import { CommentController } from "../controllers/comment.controller";
import { PostService } from "../services/post.service";
import { CommentService } from "../services/comment.service";
import { CommunityService } from "../services/community.service";
import { CommunityMembershipService } from "../services/community-membership.service";
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

const postController = new PostController(postService);
const commentController = new CommentController(commentService);

/** Mounted at /api/v1/communities/:communityId/posts */
export const communityPostRouter = Router({ mergeParams: true });

communityPostRouter.post("/", postController.createPost);
communityPostRouter.get("/", postController.getCommunityPosts);

/** Mounted at /api/v1/posts */
export const postRouter = Router();

postRouter.get("/:postId", postController.getPostById);
postRouter.patch("/:postId", postController.updatePost);
postRouter.delete("/:postId", postController.deletePost);
postRouter.get("/:postId/comments", commentController.getPostComments);
postRouter.post("/:postId/comments", commentController.createComment);
