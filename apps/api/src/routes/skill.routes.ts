import { Router } from "express";
import { SkillController } from "../controllers/skill.controller";
import { SkillService } from "../services/skill.service";
import { SkillRepository } from "../repositories/skill.repository";

const skillRepository = new SkillRepository();
const skillService = new SkillService(skillRepository);
const skillController = new SkillController(skillService);

export const skillRouter = Router();

skillRouter.post("/", skillController.createSkill);

skillRouter.get("/", skillController.getAllSkills);

skillRouter.get("/:id", skillController.getSkillById);
