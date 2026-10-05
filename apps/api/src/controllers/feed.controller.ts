import type { Request, Response } from "express";
import {
  FEED_ACTOR_REQUIRED_MESSAGE,
  FEED_CURSOR_INVALID_MESSAGE,
  FEED_LIMIT_INVALID_MESSAGE,
  FeedService,
} from "../services/feed.service";
import { sendContentError } from "../utils/content-errors";
import { readActorId, readFeedCursor, readFeedLimit } from "../utils/request";

export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  /**
   * Returns one page of the ranked feed of the acting student. Until
   * authentication exists the actor is supplied as `actorId`, exactly like the
   * other content endpoints.
   */
  getFeed = async (req: Request, res: Response): Promise<void> => {
    try {
      const actorId = readActorId(req);

      if (!actorId) {
        res.status(400).json({ error: FEED_ACTOR_REQUIRED_MESSAGE });
        return;
      }

      const limit = readFeedLimit(req);

      if (limit === null) {
        res.status(400).json({ error: FEED_LIMIT_INVALID_MESSAGE });
        return;
      }

      const cursor = readFeedCursor(req);

      if (cursor === null) {
        res.status(400).json({ error: FEED_CURSOR_INVALID_MESSAGE });
        return;
      }

      const feed = await this.feedService.getFeed(actorId, { limit, cursor });

      res.json(feed);
    } catch (error) {
      sendContentError(error, res);
    }
  };
}
