import type { Request, Response } from "express";
import { StudentInterestService } from "../services/student-interest.service";

export class StudentInterestController {
  constructor(
    private readonly studentInterestService: StudentInterestService,
  ) {}

  addInterestToStudent = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, interestId } = req.params;

      if (typeof userId !== "string" || typeof interestId !== "string") {
        res.status(400).json({
          error: "Invalid student or interest ID",
        });
        return;
      }

      const interest = await this.studentInterestService.addInterestToStudent(
        userId,
        interestId,
      );

      res.status(201).json(interest);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  removeInterestFromStudent = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const { userId, interestId } = req.params;

      if (typeof userId !== "string" || typeof interestId !== "string") {
        res.status(400).json({
          error: "Invalid student or interest ID",
        });
        return;
      }

      await this.studentInterestService.removeInterestFromStudent(
        userId,
        interestId,
      );

      res.status(204).send();
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  getStudentInterests = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      if (typeof userId !== "string") {
        res.status(400).json({
          error: "Invalid student ID",
        });
        return;
      }

      const interests =
        await this.studentInterestService.getStudentInterests(userId);

      res.json(interests);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  private sendMappedError(error: unknown, res: Response): void {
    const message = error instanceof Error ? error.message : undefined;

    switch (message) {
      case "Student profile not found":
      case "Interest not found":
      case "Interest is not added to this student profile":
        res.status(404).json({ error: message });
        return;
      case "Interest is already added to this student profile":
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
