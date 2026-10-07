import { Router } from "express";
import { ProgramController } from "../controllers/program.controller";
import { ProgramService } from "../services/program.service";
import { ProgramRepository } from "../repositories/program.repository";
import { UniversityRepository } from "../repositories/university.repository";

const programRepository = new ProgramRepository();
const universityRepository = new UniversityRepository();

const programService = new ProgramService(
  programRepository,
  universityRepository,
);

const programController = new ProgramController(programService);

/**
 * Mounted at `/universities/:universityId/programs`. `mergeParams` is what lets
 * the handler read the university id from the parent mount.
 */
export const universityProgramRouter = Router({ mergeParams: true });

universityProgramRouter.get("/", programController.getUniversityPrograms);

/** Mounted at `/programs`. */
export const programRouter = Router();

programRouter.get("/:programId", programController.getProgramById);