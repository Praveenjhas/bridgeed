import { Router } from "express";
import { CommunityMembershipController } from "../controllers/community-membership.controller";
import { CommunityMembershipService } from "../services/community-membership.service";
import { CommunityService } from "../services/community.service";
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

const communityMembershipController = new CommunityMembershipController(
  communityMembershipService,
);

export const communityMembershipRouter = Router();

communityMembershipRouter.get(
  "/:membershipId",
  communityMembershipController.getMembershipById,
);
communityMembershipRouter.patch(
  "/:membershipId/approve",
  communityMembershipController.approveMembership,
);
communityMembershipRouter.patch(
  "/:membershipId/reject",
  communityMembershipController.rejectMembership,
);
