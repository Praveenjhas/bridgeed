import type { Request, Response } from "express";
import { UniversityService } from "../services/university.service";

export class UniversityController {
  constructor(private readonly universityService: UniversityService) {}

  createUniversity = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, country, state, city, websiteUrl, verified } = req.body as {
        name?: unknown;
        country?: unknown;
        state?: unknown;
        city?: unknown;
        websiteUrl?: unknown;
        verified?: unknown;
      };

      if (typeof name !== "string" || typeof country !== "string") {
        res.status(400).json({
          error: "name and country are required",
        });
        return;
      }

      if (state !== undefined && state !== null && typeof state !== "string") {
        res.status(400).json({
          error: "state must be a string or null",
        });
        return;
      }

      if (city !== undefined && city !== null && typeof city !== "string") {
        res.status(400).json({
          error: "city must be a string or null",
        });
        return;
      }

      if (
        websiteUrl !== undefined &&
        websiteUrl !== null &&
        typeof websiteUrl !== "string"
      ) {
        res.status(400).json({
          error: "websiteUrl must be a string or null",
        });
        return;
      }

      if (verified !== undefined && typeof verified !== "boolean") {
        res.status(400).json({
          error: "verified must be a boolean",
        });
        return;
      }

      const university = await this.universityService.createUniversity({
        name,
        country,
        state: state as string | null | undefined,
        city: city as string | null | undefined,
        websiteUrl: websiteUrl as string | null | undefined,
        verified: verified as boolean | undefined,
      });

      res.status(201).json(university);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "A university with this name already exists"
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

  getUniversityById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (typeof id !== "string") {
        res.status(400).json({
          error: "Invalid university ID",
        });
        return;
      }

      const university = await this.universityService.getUniversityById(id);

      if (!university) {
        res.status(404).json({
          error: "University not found",
        });
        return;
      }

      res.json(university);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };

  getAllUniversities = async (_req: Request, res: Response): Promise<void> => {
    try {
      const universities = await this.universityService.getAllUniversities();

      res.json(universities);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };
}
