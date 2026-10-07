import type { Request, Response } from "express";
import { readRouteParam } from "../utils/request";
import {
  PROGRAM_NOT_FOUND_MESSAGE,
  ProgramService,
} from "../services/program.service";
import { UNIVERSITY_NOT_FOUND_MESSAGE } from "../services/university.service";

export class ProgramController {
  constructor(private readonly programService: ProgramService) {}

  /** Every programme a university offers. 404 when the university is unknown. */
  getUniversityPrograms = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const universityId = readRouteParam(req, "universityId");

      if (!universityId) {
        res.status(400).json({
          error: "Invalid university ID",
        });
        return;
      }

      const programs =
        await this.programService.listProgramsForUniversity(universityId);

      res.json(programs);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === UNIVERSITY_NOT_FOUND_MESSAGE
      ) {
        res.status(404).json({ error: error.message });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };

  /** One programme with its university and subjects. 404 when it is unknown. */
  getProgramById = async (req: Request, res: Response): Promise<void> => {
    try {
      const programId = readRouteParam(req, "programId");

      if (!programId) {
        res.status(400).json({
          error: "Invalid program ID",
        });
        return;
      }

      const program = await this.programService.getProgramDetail(programId);

      if (!program) {
        res.status(404).json({
          error: PROGRAM_NOT_FOUND_MESSAGE,
        });
        return;
      }

      res.json(program);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };
}
