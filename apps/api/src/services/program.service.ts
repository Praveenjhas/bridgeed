import type { Program, ProgramDetail } from "@bridgeed/shared";
import { ProgramRepository } from "../repositories/program.repository";
import { UniversityRepository } from "../repositories/university.repository";
import { UNIVERSITY_NOT_FOUND_MESSAGE } from "./university.service";

/** Raised when a programme id names nothing. */
export const PROGRAM_NOT_FOUND_MESSAGE = "Program not found";

export class ProgramService {
  constructor(
    private readonly programRepository: ProgramRepository,
    private readonly universityRepository: UniversityRepository,
  ) {}

  /**
   * Every programme a university offers.
   *
   * The university is checked first so a request for the programmes of an id that
   * does not exist answers 404 rather than an empty list, which would be a lie:
   * an empty list means "this university offers nothing", not "no such place".
   */
  async listProgramsForUniversity(universityId: string): Promise<Program[]> {
    const university = await this.universityRepository.findById(universityId);

    if (!university) {
      throw new Error(UNIVERSITY_NOT_FOUND_MESSAGE);
    }

    return this.programRepository.findByUniversity(universityId);
  }

  async getProgramDetail(id: string): Promise<ProgramDetail | null> {
    return this.programRepository.findById(id);
  }
}
