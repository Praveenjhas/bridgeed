import type { Request, Response } from "express";
import { InterestService } from "../services/interest.service";

export class InterestController {
  constructor(private readonly interestService: InterestService) {}

  createInterest = async (req: Request, res: Response): Promise<void> => {
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

      const interest = await this.interestService.createInterest({ name });

      res.status(201).json(interest);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "An interest with this name already exists"
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

  getInterestById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (typeof id !== "string") {
        res.status(400).json({
          error: "Invalid interest ID",
        });
        return;
      }

      const interest = await this.interestService.getInterestById(id);

      if (!interest) {
        res.status(404).json({
          error: "Interest not found",
        });
        return;
      }

      res.json(interest);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };

  getAllInterests = async (_req: Request, res: Response): Promise<void> => {
    try {
      const interests = await this.interestService.getAllInterests();

      res.json(interests);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };
}
