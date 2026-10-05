import type { Skill } from "@bridgeed/shared/src/types/skill";
import { SkillRepository } from "../repositories/skill.repository";

export interface CreateSkillInput {
  name: string;
}

export class SkillService {
  constructor(private readonly skillRepository: SkillRepository) {}

  async createSkill(input: CreateSkillInput): Promise<Skill> {
    const name = input.name.trim();

    const existingSkill = await this.skillRepository.findByName(name);

    if (existingSkill) {
      throw new Error("A skill with this name already exists");
    }

    const skill: Skill = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
    };

    return this.skillRepository.create(skill);
  }

  async getSkillById(id: string): Promise<Skill | null> {
    return this.skillRepository.findById(id);
  }

  async getAllSkills(): Promise<Skill[]> {
    return this.skillRepository.findAll();
  }
}
