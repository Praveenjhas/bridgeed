import type { Request, Response } from "express";
import { SkillService } from "../services/skill.service";

export class SkillController {
  constructor(private readonly skillService: SkillService) {}

  createSkill = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name } = req.body as {
        name?: unknown;
      };

      if (typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({
          error: "name is required and must be a non-empty string",
        });
        return;
      }

      const skill = await this.skillService.createSkill({ name });

      res.status(201).json(skill);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "A skill with this name already exists"
      ) {
        res.status(409).json({
          error: error.message,
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };

  getSkillById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (typeof id !== "string") {
        res.status(400).json({
          error: "Invalid skill ID",
        });
        return;
      }

      const skill = await this.skillService.getSkillById(id);

      if (!skill) {
        res.status(404).json({
          error: "Skill not found",
        });
        return;
      }

      res.json(skill);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };

  getAllSkills = async (_req: Request, res: Response): Promise<void> => {
    try {
      const skills = await this.skillService.getAllSkills();

      res.json(skills);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };
}
