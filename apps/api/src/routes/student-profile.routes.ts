import { Router } from "express";
import { StudentProfileController } from "../controllers/student-profile.controller";
import { StudentProfileService } from "../services/student-profile.service";
import { StudentProfileRepository } from "../repositories/student-profile.repository";
import { UniversityRepository } from "../repositories/university.repository";
import { StudentSkillRepository } from "../repositories/student-skill.repository";
import { StudentInterestRepository } from "../repositories/student-interest.repository";
import { SkillRepository } from "../repositories/skill.repository";
import { InterestRepository } from "../repositories/interest.repository";
import { StudentSkillService } from "../services/student-skill.service";
import { StudentInterestService } from "../services/student-interest.service";
import { requireAuth } from "../middleware/require-auth";

const studentProfileRepository = new StudentProfileRepository();
const universityRepository = new UniversityRepository();
const studentSkillRepository = new StudentSkillRepository();
const studentInterestRepository = new StudentInterestRepository();
const skillRepository = new SkillRepository();
const interestRepository = new InterestRepository();

const studentSkillService = new StudentSkillService(
  studentSkillRepository,
  studentProfileRepository,
  skillRepository,
);
const studentInterestService = new StudentInterestService(
  studentInterestRepository,
  studentProfileRepository,
  interestRepository,
);

const studentProfileService = new StudentProfileService(
  studentProfileRepository,
  universityRepository,
  studentSkillService,
  studentInterestService,
);
const studentProfileController = new StudentProfileController(
  studentProfileService,
);

export const studentProfileRouter = Router();

/**
 * The signed-in student's own profile. These paths are declared before
 * `/:userId` so the literal segment is not swallowed as a user id, and they are
 * the only way a client can learn which profile belongs to it: the owner is
 * read from `req.auth` rather than from the body. `PATCH` edits that profile and
 * the two `PUT`s replace its skills and interests — the owner is never taken
 * from the request, so no client field can point a write at another account.
 */
studentProfileRouter.get(
  "/me",
  requireAuth,
  studentProfileController.getMyProfile,
);
studentProfileRouter.post(
  "/me",
  requireAuth,
  studentProfileController.createMyProfile,
);
studentProfileRouter.patch(
  "/me",
  requireAuth,
  studentProfileController.updateMyProfile,
);
studentProfileRouter.put(
  "/me/skills",
  requireAuth,
  studentProfileController.replaceMySkills,
);
studentProfileRouter.put(
  "/me/interests",
  requireAuth,
  studentProfileController.replaceMyInterests,
);

/**
 * The public directory of students, used by the Discover screen.
 *
 * It is guarded because it names every account that has a profile; the viewing
 * student is taken from the token and left out of the page. It is the one route
 * in this router that reads `page`/`limit`, and it sits before `/:userId` so the
 * empty path is never taken for an id.
 */
studentProfileRouter.get(
  "/",
  requireAuth,
  studentProfileController.listProfiles,
);

/**
 * Legacy create path, kept for the live smoke scripts. It trusts the `userId` in
 * the body, which is exactly why the app uses `POST /me` instead.
 */
studentProfileRouter.post("/", studentProfileController.createProfile);

/**
 * Public read of another student's profile. The id is the subject being viewed,
 * not the viewer, so this route stays unauthenticated and unchanged.
 */
studentProfileRouter.get(
  "/:userId",
  studentProfileController.getProfileByUserId,
);


