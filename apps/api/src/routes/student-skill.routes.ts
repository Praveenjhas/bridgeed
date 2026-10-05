import { Router } from "express";
import { StudentSkillController } from "../controllers/student-skill.controller";
import { StudentSkillService } from "../services/student-skill.service";
import { StudentSkillRepository } from "../repositories/student-skill.repository";
import { StudentProfileRepository } from "../repositories/student-profile.repository";
import { SkillRepository } from "../repositories/skill.repository";

const studentSkillRepository = new StudentSkillRepository();
const studentProfileRepository = new StudentProfileRepository();
const skillRepository = new SkillRepository();

const studentSkillService = new StudentSkillService(
  studentSkillRepository,
  studentProfileRepository,
  skillRepository,
);

const studentSkillController = new StudentSkillController(studentSkillService);

export const studentSkillRouter = Router({ mergeParams: true });

studentSkillRouter.get("/", studentSkillController.getStudentSkills);

studentSkillRouter.post("/:skillId", studentSkillController.addSkillToStudent);

studentSkillRouter.delete(
  "/:skillId",
  studentSkillController.removeSkillFromStudent,
);
