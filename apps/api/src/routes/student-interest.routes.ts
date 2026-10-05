import { Router } from "express";
import { StudentInterestController } from "../controllers/student-interest.controller";
import { StudentInterestService } from "../services/student-interest.service";
import { StudentInterestRepository } from "../repositories/student-interest.repository";
import { StudentProfileRepository } from "../repositories/student-profile.repository";
import { InterestRepository } from "../repositories/interest.repository";

const studentInterestRepository = new StudentInterestRepository();
const studentProfileRepository = new StudentProfileRepository();
const interestRepository = new InterestRepository();

const studentInterestService = new StudentInterestService(
  studentInterestRepository,
  studentProfileRepository,
  interestRepository,
);

const studentInterestController = new StudentInterestController(
  studentInterestService,
);

export const studentInterestRouter = Router({ mergeParams: true });

studentInterestRouter.get("/", studentInterestController.getStudentInterests);

studentInterestRouter.post(
  "/:interestId",
  studentInterestController.addInterestToStudent,
);

studentInterestRouter.delete(
  "/:interestId",
  studentInterestController.removeInterestFromStudent,
);
