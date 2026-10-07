import type { Request, Response } from "express";
import {
  COMMENT_AUTHOR_REQUIRED_MESSAGE,
  COMMENT_CONTENT_INVALID_MESSAGE,
  CommentService,
} from "../services/comment.service";
import { sendContentError } from "../utils/content-errors";
import {
  readCurrentActorId,
  readPagination,
  readRouteParam,
} from "../utils/request";

export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  createComment = async (req: Request, res: Response): Promise<void> => {
    try {
      const postId = readRouteParam(req, "postId");

      if (!postId) {
        res.status(400).json({ error: "Invalid post ID" });
        return;
      }

      const { content } = (req.body ?? {}) as { content?: unknown };
      const authorId = readCurrentActorId(req);

      if (!authorId) {
        res.status(400).json({ error: COMMENT_AUTHOR_REQUIRED_MESSAGE });
        return;
      }

      if (typeof content !== "string") {
        res.status(400).json({ error: COMMENT_CONTENT_INVALID_MESSAGE });
        return;
      }

      const comment = await this.commentService.createComment(postId, {
        authorId,
        content,
      });

      res.status(201).json(comment);
    } catch (error) {
      sendContentError(error, res);
    }
  };

  getPostComments = async (req: Request, res: Response): Promise<void> => {
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

      const pagination = readPagination(req);

      if (!pagination) {
        res
          .status(400)
          .json({ error: "page and limit must be positive integers" });
        return;
      }

      const comments = await this.commentService.listComments(
        postId,
        actorId,
        pagination,
      );

      res.json(comments);
    } catch (error) {
      sendContentError(error, res);
    }
  };

  getCommentById = async (req: Request, res: Response): Promise<void> => {
    try {
      const commentId = readRouteParam(req, "commentId");

      if (!commentId) {
        res.status(400).json({ error: "Invalid comment ID" });
        return;
      }

      const actorId = readCurrentActorId(req);

      if (!actorId) {
        res.status(400).json({ error: "actorId is required" });
        return;
      }

      const comment = await this.commentService.getComment(commentId, actorId);

      res.json(comment);
    } catch (error) {
      sendContentError(error, res);
    }
  };

  updateComment = async (req: Request, res: Response): Promise<void> => {
    try {
      const commentId = readRouteParam(req, "commentId");

      if (!commentId) {
        res.status(400).json({ error: "Invalid comment ID" });
        return;
      }

      const actorId = readCurrentActorId(req);

      if (!actorId) {
        res.status(400).json({ error: "actorId is required" });
        return;
      }

      const { content } = (req.body ?? {}) as { content?: unknown };

      if (typeof content !== "string") {
        res.status(400).json({ error: COMMENT_CONTENT_INVALID_MESSAGE });
        return;
      }

      const comment = await this.commentService.updateComment(
        commentId,
        actorId,
        content,
      );

      res.json(comment);
    } catch (error) {
      sendContentError(error, res);
    }
  };

  deleteComment = async (req: Request, res: Response): Promise<void> => {
    try {
      const commentId = readRouteParam(req, "commentId");

      if (!commentId) {
        res.status(400).json({ error: "Invalid comment ID" });
        return;
      }

      const actorId = readCurrentActorId(req);

      if (!actorId) {
        res.status(400).json({ error: "actorId is required" });
        return;
      }

      await this.commentService.deleteComment(commentId, actorId);

      res.status(204).send();
    } catch (error) {
      sendContentError(error, res);
    }
  };
}
