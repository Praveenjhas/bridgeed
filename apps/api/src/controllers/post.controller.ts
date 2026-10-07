import type { Request, Response } from "express";
import {
  POST_AUTHOR_REQUIRED_MESSAGE,
  POST_CONTENT_INVALID_MESSAGE,
  POST_TYPE_INVALID_MESSAGE,
  PostService,
} from "../services/post.service";
import { sendContentError } from "../utils/content-errors";
import {
  isNonEmptyString,
  readCurrentActorId,
  readPagination,
  readPostType,
  readRouteParam,
} from "../utils/request";

export class PostController {
  constructor(private readonly postService: PostService) {}

  createPost = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = readRouteParam(req, "communityId");

      if (!communityId) {
        res.status(400).json({ error: "Invalid community ID" });
        return;
      }

      const { content, type } = (req.body ?? {}) as {
        content?: unknown;
        type?: unknown;
      };
      const authorId = readCurrentActorId(req);

      if (!authorId) {
        res.status(400).json({ error: POST_AUTHOR_REQUIRED_MESSAGE });
        return;
      }

      if (typeof content !== "string") {
        res.status(400).json({ error: POST_CONTENT_INVALID_MESSAGE });
        return;
      }

      const post = await this.postService.createPost(communityId, {
        authorId,
        content,
        type,
      });

      res.status(201).json(post);
    } catch (error) {
      sendContentError(error, res);
    }
  };

  getCommunityPosts = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = readRouteParam(req, "communityId");

      if (!communityId) {
        res.status(400).json({ error: "Invalid community ID" });
        return;
      }

      const actorId = readCurrentActorId(req);

      if (!actorId) {
        res.status(400).json({ error: "actorId is required" });
        return;
      }

      const pagination = readPagination(req);

      if (!pagination) {
        res
          .status(400)
          .json({ error: "page and limit must be positive integers" });
        return;
      }

      // `?type=` is optional. An unknown value is refused instead of ignored, so
      // a filter can never look applied while returning everything.
      const type = readPostType(req);

      if (type === null) {
        res.status(400).json({ error: POST_TYPE_INVALID_MESSAGE });
        return;
      }

      const posts = await this.postService.listCommunityPosts(
        communityId,
        actorId,
        { ...pagination, type },
      );

      res.json(posts);
    } catch (error) {
      sendContentError(error, res);
    }
  };

  getPostById = async (req: Request, res: Response): Promise<void> => {
    try {
      const postId = readRouteParam(req, "postId");

      if (!postId) {
        res.status(400).json({ error: "Invalid post ID" });
        return;
      }

      const actorId = readCurrentActorId(req);

      if (!actorId) {
        res.status(400).json({ error: "actorId is required" });
        return;
      }

      const post = await this.postService.getPost(postId, actorId);

      res.json(post);
    } catch (error) {
      sendContentError(error, res);
    }
  };

  updatePost = async (req: Request, res: Response): Promise<void> => {
    try {
      const postId = readRouteParam(req, "postId");

      if (!postId) {
        res.status(400).json({ error: "Invalid post ID" });
        return;
      }

      const actorId = readCurrentActorId(req);

      if (!actorId) {
        res.status(400).json({ error: "actorId is required" });
        return;
      }

      const { content } = (req.body ?? {}) as { content?: unknown };

      if (typeof content !== "string") {
        res.status(400).json({ error: POST_CONTENT_INVALID_MESSAGE });
        return;
      }

      const post = await this.postService.updatePost(postId, actorId, content);

      res.json(post);
    } catch (error) {
      sendContentError(error, res);
    }
  };

  deletePost = async (req: Request, res: Response): Promise<void> => {
    try {
      const postId = readRouteParam(req, "postId");

      if (!postId) {
        res.status(400).json({ error: "Invalid post ID" });
        return;
      }

      const actorId = readCurrentActorId(req);

      if (!actorId) {
        res.status(400).json({ error: "actorId is required" });
        return;
      }

      await this.postService.deletePost(postId, actorId);

      res.status(204).send();
    } catch (error) {
      sendContentError(error, res);
    }
  };
}
