import type { Interest } from "@bridgeed/shared/src/types/interest";
import { InterestRepository } from "../repositories/interest.repository";
import { StudentInterestRepository } from "../repositories/student-interest.repository";
import { StudentProfileRepository } from "../repositories/student-profile.repository";

export class StudentInterestService {
  constructor(
    private readonly studentInterestRepository: StudentInterestRepository,
    private readonly studentProfileRepository: StudentProfileRepository,
    private readonly interestRepository: InterestRepository,
  ) {}

  async addInterestToStudent(
    userId: string,
    interestId: string,
  ): Promise<Interest> {
    await this.ensureStudentProfileExists(userId);

    const interest = await this.interestRepository.findById(interestId);

    if (!interest) {
      throw new Error("Interest not found");
    }

    const alreadyAttached = await this.studentInterestRepository.exists(
      userId,
      interestId,
    );

    if (alreadyAttached) {
      throw new Error("Interest is already added to this student profile");
    }

    await this.studentInterestRepository.create(userId, interestId);

    return interest;
  }

  async removeInterestFromStudent(
    userId: string,
    interestId: string,
  ): Promise<void> {
    await this.ensureStudentProfileExists(userId);

    const deletedCount = await this.studentInterestRepository.delete(
      userId,
      interestId,
    );

    if (deletedCount === 0) {
      throw new Error("Interest is not added to this student profile");
    }
  }

  async getStudentInterests(userId: string): Promise<Interest[]> {
    await this.ensureStudentProfileExists(userId);

    return this.studentInterestRepository.findInterestsByStudentId(userId);
  }

  /**
   * Replaces a student's interests with exactly `interestIds`. See
   * `StudentSkillService.setStudentSkills` for the validation and the reasoning.
   */
  async setStudentInterests(
    userId: string,
    interestIds: string[],
  ): Promise<Interest[]> {
    await this.ensureStudentProfileExists(userId);

    const uniqueIds = [...new Set(interestIds)];

    if (uniqueIds.length > 0) {
      const knownInterests =
        await this.interestRepository.findManyByIds(uniqueIds);

      if (knownInterests.length !== uniqueIds.length) {
        throw new Error("One or more interests do not exist");
      }
    }

    await this.studentInterestRepository.setInterestsForStudent(
      userId,
      uniqueIds,
    );

    return this.studentInterestRepository.findInterestsByStudentId(userId);
  }

  private async ensureStudentProfileExists(userId: string): Promise<void> {
    const profile = await this.studentProfileRepository.findByUserId(userId);

    if (!profile) {
      throw new Error("Student profile not found");
    }
  }
}
