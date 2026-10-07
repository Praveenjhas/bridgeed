import { Router } from "express";
import { FeedController } from "../controllers/feed.controller";
import { optionalAuth } from "../middleware/require-auth";
import { FeedService } from "../services/feed.service";
import { CommunityService } from "../services/community.service";
import { FeedRepository } from "../repositories/feed.repository";
import { PostRepository } from "../repositories/post.repository";
import { ConnectionRepository } from "../repositories/connection.repository";
import { CommunityRepository } from "../repositories/community.repository";
import { StudentProfileRepository } from "../repositories/student-profile.repository";
import { StudentSkillRepository } from "../repositories/student-skill.repository";
import { StudentInterestRepository } from "../repositories/student-interest.repository";

const feedRepository = new FeedRepository();
const postRepository = new PostRepository();
const connectionRepository = new ConnectionRepository();
const communityRepository = new CommunityRepository();
const studentProfileRepository = new StudentProfileRepository();
const studentSkillRepository = new StudentSkillRepository();
const studentInterestRepository = new StudentInterestRepository();

const communityService = new CommunityService(
  communityRepository,
  studentProfileRepository,
);

const feedService = new FeedService(
  feedRepository,
  postRepository,
  connectionRepository,
  studentSkillRepository,
  studentInterestRepository,
  communityService,
);

const feedController = new FeedController(feedService);

/** Mounted at /api/v1/feed */
export const feedRouter = Router();

/**
 * The canonical request is `GET /feed?limit=&cursor=` with a bearer token; the
 * actor is then `req.auth.userId`. `optionalAuth` also lets the legacy
 * `GET /feed?actorId=` shape through, which is kept solely for the live smoke
 * suite and never overrides an authenticated identity.
 */
feedRouter.get("/", optionalAuth, feedController.getFeed);
