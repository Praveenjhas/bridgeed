import type { Request, Response } from "express";
import { StudentSkillService } from "../services/student-skill.service";

export class StudentSkillController {
  constructor(private readonly studentSkillService: StudentSkillService) {}

  addSkillToStudent = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, skillId } = req.params;

      if (typeof userId !== "string" || typeof skillId !== "string") {
        res.status(400).json({
          error: "Invalid student or skill ID",
        });
        return;
      }

      const skill = await this.studentSkillService.addSkillToStudent(
        userId,
        skillId,
      );

      res.status(201).json(skill);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  removeSkillFromStudent = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const { userId, skillId } = req.params;

      if (typeof userId !== "string" || typeof skillId !== "string") {
        res.status(400).json({
          error: "Invalid student or skill ID",
        });
        return;
      }

      await this.studentSkillService.removeSkillFromStudent(userId, skillId);

      res.status(204).send();
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  getStudentSkills = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      if (typeof userId !== "string") {
        res.status(400).json({
          error: "Invalid student ID",
        });
        return;
      }

      const skills = await this.studentSkillService.getStudentSkills(userId);

      res.json(skills);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  private sendMappedError(error: unknown, res: Response): void {
    const message = error instanceof Error ? error.message : undefined;

    switch (message) {
      case "Student profile not found":
      case "Skill not found":
      case "Skill is not added to this student profile":
        res.status(404).json({ error: message });
        return;
      case "Skill is already added to this student profile":
        res.status(409).json({ error: message });
        return;
      default:
        console.error(error);

        res.status(500).json({
          error: "Internal server error",
        });
    }
  }
}
