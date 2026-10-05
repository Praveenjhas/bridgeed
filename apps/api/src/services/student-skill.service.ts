import type { Skill } from "@bridgeed/shared/src/types/skill";
import { SkillRepository } from "../repositories/skill.repository";
import { StudentProfileRepository } from "../repositories/student-profile.repository";
import { StudentSkillRepository } from "../repositories/student-skill.repository";

export class StudentSkillService {
  constructor(
    private readonly studentSkillRepository: StudentSkillRepository,
    private readonly studentProfileRepository: StudentProfileRepository,
    private readonly skillRepository: SkillRepository,
  ) {}

  async addSkillToStudent(userId: string, skillId: string): Promise<Skill> {
    await this.ensureStudentProfileExists(userId);

    const skill = await this.skillRepository.findById(skillId);

    if (!skill) {
      throw new Error("Skill not found");
    }

    const alreadyAttached = await this.studentSkillRepository.exists(
      userId,
      skillId,
    );

    if (alreadyAttached) {
      throw new Error("Skill is already added to this student profile");
    }

    await this.studentSkillRepository.create(userId, skillId);

    return skill;
  }

  async removeSkillFromStudent(
    userId: string,
    skillId: string,
  ): Promise<void> {
    await this.ensureStudentProfileExists(userId);

    const deletedCount = await this.studentSkillRepository.delete(
      userId,
      skillId,
    );

    if (deletedCount === 0) {
      throw new Error("Skill is not added to this student profile");
    }
  }

  async getStudentSkills(userId: string): Promise<Skill[]> {
    await this.ensureStudentProfileExists(userId);

    return this.studentSkillRepository.findSkillsByStudentId(userId);
  }

  private async ensureStudentProfileExists(userId: string): Promise<void> {
    const profile = await this.studentProfileRepository.findByUserId(userId);

    if (!profile) {
      throw new Error("Student profile not found");
    }
  }
}
