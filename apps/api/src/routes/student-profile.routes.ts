import { Router } from "express";
import { StudentProfileController } from "../controllers/student-profile.controller";
import { StudentProfileService } from "../services/student-profile.service";
import { StudentProfileRepository } from "../repositories/student-profile.repository";
import { requireAuth } from "../middleware/require-auth";

const studentProfileRepository = new StudentProfileRepository();
const studentProfileService = new StudentProfileService(
  studentProfileRepository,
);
const studentProfileController = new StudentProfileController(
  studentProfileService,
);

export const studentProfileRouter = Router();

/**
 * The signed-in student's own profile. These two paths are declared before
 * `/:userId` so the literal segment is not swallowed as a user id, and they are
 * the only way a client can learn which profile belongs to it: the owner is
 * read from `req.auth` rather than from the body.
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

/**
 * Legacy create path, kept for the live smoke scripts. It trusts the `userId` in
 * the body, which is exactly why the app uses `POST /me` instead.
 */
studentProfileRouter.post("/", studentProfileController.createProfile);
studentProfileRouter.get(
  "/:userId",
  studentProfileController.getProfileByUserId,
);

