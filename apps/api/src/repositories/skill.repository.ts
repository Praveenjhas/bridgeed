import type { Skill } from "@bridgeed/shared/src/types/skill";
import { prisma } from "../config/prisma";

export function toSkill(skill: {
  id: string;
  name: string;
  createdAt: Date;
}): Skill {
  return {
    id: skill.id,
    name: skill.name,
    createdAt: skill.createdAt.toISOString(),
  };
}

export class SkillRepository {
  async findById(id: string): Promise<Skill | null> {
    const skill = await prisma.skill.findUnique({
      where: {
        id,
      },
    });

    return skill ? toSkill(skill) : null;
  }

  async findByName(name: string): Promise<Skill | null> {
    const skill = await prisma.skill.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    return skill ? toSkill(skill) : null;
  }

  async create(skill: Skill): Promise<Skill> {
    const createdSkill = await prisma.skill.create({
      data: {
        id: skill.id,
        name: skill.name,
      },
    });

    return toSkill(createdSkill);
  }

  async findAll(): Promise<Skill[]> {
    const skills = await prisma.skill.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return skills.map(toSkill);
  }
}
