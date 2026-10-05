import { Router } from "express";
import { CommunityController } from "../controllers/community.controller";
import { CommunityService } from "../services/community.service";
import { CommunityMembershipService } from "../services/community-membership.service";
import { CommunityRepository } from "../repositories/community.repository";
import { CommunityMembershipRepository } from "../repositories/community-membership.repository";
import { StudentProfileRepository } from "../repositories/student-profile.repository";

const communityRepository = new CommunityRepository();
const communityMembershipRepository = new CommunityMembershipRepository();
const studentProfileRepository = new StudentProfileRepository();

const communityService = new CommunityService(
  communityRepository,
  studentProfileRepository,
);

const communityMembershipService = new CommunityMembershipService(
  communityMembershipRepository,
  communityService,
);

const communityController = new CommunityController(
  communityService,
  communityMembershipService,
);

export const communityRouter = Router();

communityRouter.post("/", communityController.createCommunity);
communityRouter.get("/", communityController.getCommunities);
communityRouter.get("/:communityId", communityController.getCommunityById);
communityRouter.get(
  "/:communityId/members",
  communityController.getCommunityMembers,
);
communityRouter.get(
  "/:communityId/membership-requests",
  communityController.getMembershipRequests,
);
communityRouter.post(
  "/:communityId/join",
  communityController.joinCommunity,
);
communityRouter.delete(
  "/:communityId/membership",
  communityController.leaveCommunity,
);

export const studentCommunityRouter = Router({ mergeParams: true });

studentCommunityRouter.get(
  "/communities",
  communityController.getStudentCommunities,
);
