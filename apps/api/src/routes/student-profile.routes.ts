import { Router } from "express";
import { StudentProfileController } from "../controllers/student-profile.controller";
import { StudentProfileService } from "../services/student-profile.service";
import { StudentProfileRepository } from "../repositories/student-profile.repository";

const studentProfileRepository = new StudentProfileRepository();
const studentProfileService = new StudentProfileService(
  studentProfileRepository,
);
const studentProfileController = new StudentProfileController(
  studentProfileService,
);

export const studentProfileRouter = Router();

studentProfileRouter.post("/", studentProfileController.createProfile);
studentProfileRouter.get(
  "/:userId",
  studentProfileController.getProfileByUserId,
);
