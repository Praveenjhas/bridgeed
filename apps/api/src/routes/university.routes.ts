import { Router } from "express";
import { UniversityController } from "../controllers/university.controller";
import { UniversityService } from "../services/university.service";
import { UniversityRepository } from "../repositories/university.repository";

const universityRepository = new UniversityRepository();

const universityService = new UniversityService(universityRepository);

const universityController = new UniversityController(universityService);

export const universityRouter = Router();

universityRouter.post("/", universityController.createUniversity);

universityRouter.get("/", universityController.getAllUniversities);

universityRouter.get("/:id", universityController.getUniversityById);
