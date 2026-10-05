import type { Request, Response } from "express";
import {
  REACTION_USER_REQUIRED_MESSAGE,
  ReactionService,
} from "../services/reaction.service";
import { sendContentError } from "../utils/content-errors";
import { readActorId, readRouteParam } from "../utils/request";

/**
 * Reactions only ever act on the stored rows: the client sends who it is, and
 * the service verifies membership and ownership against the database.
 */
export class ReactionController {
  constructor(private readonly reactionService: ReactionService) {}

  likePost = async (req: Request, res: Response): Promise<void> => {
    try {
      const postId = readRouteParam(req, "postId");

      if (!postId) {
        res.status(400).json({ error: "Invalid post ID" });
        return;
      }

      const userId = readActorId(req);

      if (!userId) {
        res.status(400).json({ error: REACTION_USER_REQUIRED_MESSAGE });
        return;
      }

      const { type } = (req.body ?? {}) as { type?: unknown };

      const reaction = await this.reactionService.likePost(postId, {
        userId,
        type,
      });

      res.status(201).json(reaction);
    } catch (error) {
      sendContentError(error, res);
    }
  };

  unlikePost = async (req: Request, res: Response): Promise<void> => {
    try {
      const postId = readRouteParam(req, "postId");

      if (!postId) {
        res.status(400).json({ error: "Invalid post ID" });
        return;
      }

      const userId = readActorId(req);

      if (!userId) {
        res.status(400).json({ error: REACTION_USER_REQUIRED_MESSAGE });
        return;
      }

      await this.reactionService.unlikePost(postId, userId);

      res.status(204).send();
    } catch (error) {
      sendContentError(error, res);
    }
  };

  likeComment = async (req: Request, res: Response): Promise<void> => {
    try {
      const commentId = readRouteParam(req, "commentId");

      if (!commentId) {
        res.status(400).json({ error: "Invalid comment ID" });
        return;
      }

      const userId = readActorId(req);

      if (!userId) {
        res.status(400).json({ error: REACTION_USER_REQUIRED_MESSAGE });
        return;
      }

      const { type } = (req.body ?? {}) as { type?: unknown };

      const reaction = await this.reactionService.likeComment(commentId, {
        userId,
        type,
      });

      res.status(201).json(reaction);
    } catch (error) {
      sendContentError(error, res);
    }
  };

  unlikeComment = async (req: Request, res: Response): Promise<void> => {
    try {
      const commentId = readRouteParam(req, "commentId");

      if (!commentId) {
        res.status(400).json({ error: "Invalid comment ID" });
        return;
      }

      const userId = readActorId(req);

      if (!userId) {
        res.status(400).json({ error: REACTION_USER_REQUIRED_MESSAGE });
        return;
      }

      await this.reactionService.unlikeComment(commentId, userId);

      res.status(204).send();
    } catch (error) {
      sendContentError(error, res);
    }
  };
}
