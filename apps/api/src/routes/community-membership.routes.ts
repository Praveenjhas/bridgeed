import { Router } from "express";
import { CommunityMembershipController } from "../controllers/community-membership.controller";
import { optionalAuth } from "../middleware/require-auth";
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

/**
 * `optionalAuth` makes the authenticated account the manager who approves or
 * rejects a join request whenever a bearer token is present; the explicit
 * `actorId` survives only for the unauthenticated legacy path.
 */
communityMembershipRouter.use(optionalAuth);

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
