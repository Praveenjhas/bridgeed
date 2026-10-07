import { Router } from "express";
import { UniversityController } from "../controllers/university.controller";
import { UniversityService } from "../services/university.service";
import { UniversityRepository } from "../repositories/university.repository";

const universityRepository = new UniversityRepository();

const universityService = new UniversityService(universityRepository);

const universityController = new UniversityController(universityService);

export const universityRouter = Router();

universityRouter.post("/", universityController.createUniversity);

/**
 * The directory: `GET /universities?search=&page=&limit=` returns one page of
 * universities, each with its programme, student and community counts.
 */
universityRouter.get("/", universityController.listUniversities);

/**
 * The canonical slug lookup is declared before `/:id` so the literal `slug`
 * segment is not swallowed as an id.
 */
universityRouter.get("/slug/:slug", universityController.getUniversityBySlug);

/** One university with its counts, programmes and communities. */
universityRouter.get("/:id", universityController.getUniversityById);
