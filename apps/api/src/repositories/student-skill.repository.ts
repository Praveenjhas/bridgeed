import type { Skill } from "@bridgeed/shared/src/types/skill";
import { prisma } from "../config/prisma";
import { toSkill } from "./skill.repository";

export class StudentSkillRepository {
  async findSkillsByStudentId(studentId: string): Promise<Skill[]> {
    const records = await prisma.studentSkill.findMany({
      where: {
        studentId,
      },
      include: {
        skill: true,
      },
      orderBy: {
        skill: {
          name: "asc",
        },
      },
    });

    return records.map((record) => toSkill(record.skill));
  }

  async exists(studentId: string, skillId: string): Promise<boolean> {
    const record = await prisma.studentSkill.findUnique({
      where: {
        studentId_skillId: {
          studentId,
          skillId,
        },
      },
    });

    return record !== null;
  }

  async create(studentId: string, skillId: string): Promise<void> {
    await prisma.studentSkill.create({
      data: {
        studentId,
        skillId,
      },
    });
  }

  async delete(studentId: string, skillId: string): Promise<number> {
    const result = await prisma.studentSkill.deleteMany({
      where: {
        studentId,
        skillId,
      },
    });

    return result.count;
  }

  /**
   * Makes `skillIds` the complete set of skills on a profile.
   *
   * The delete and the inserts run in one transaction, so a failure halfway
   * through cannot leave a profile with its old skills removed and its new ones
   * missing. The caller has already checked that every id exists, so the only
   * way this throws is a genuine write failure.
   */
  async setSkillsForStudent(
    studentId: string,
    skillIds: string[],
  ): Promise<void> {
    await prisma.$transaction([
      prisma.studentSkill.deleteMany({ where: { studentId } }),
      ...skillIds.map((skillId) =>
        prisma.studentSkill.create({ data: { studentId, skillId } }),
      ),
    ]);
  }
}
