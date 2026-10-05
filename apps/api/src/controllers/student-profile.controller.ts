import type { Request, Response } from "express";
import { StudentProfileService } from "../services/student-profile.service";

export class StudentProfileController {
  constructor(private readonly studentProfileService: StudentProfileService) {}

  createProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        userId,
        name,
        username,
        bio,
        universityId,
        degree,
        branch,
        graduationYear,
        profileImageUrl,
        location,
      } = req.body as {
        userId?: unknown;
        name?: unknown;
        username?: unknown;
        bio?: unknown;
        universityId?: unknown;
        degree?: unknown;
        branch?: unknown;
        graduationYear?: unknown;
        profileImageUrl?: unknown;
        location?: unknown;
      };

      if (
        typeof userId !== "string" ||
        typeof name !== "string" ||
        typeof username !== "string"
      ) {
        res.status(400).json({
          error: "userId, name, and username are required",
        });
        return;
      }

      if (bio !== undefined && bio !== null && typeof bio !== "string") {
        res.status(400).json({
          error: "bio must be a string or null",
        });
        return;
      }

      if (
        graduationYear !== undefined &&
        graduationYear !== null &&
        typeof graduationYear !== "number"
      ) {
        res.status(400).json({
          error: "graduationYear must be a number or null",
        });
        return;
      }

      const profile = await this.studentProfileService.createProfile({
        userId,
        name,
        username,
        bio: bio as string | null | undefined,
        universityId: universityId as string | null | undefined,
        degree: degree as string | null | undefined,
        branch: branch as string | null | undefined,
        graduationYear: graduationYear as number | null | undefined,
        profileImageUrl: profileImageUrl as string | null | undefined,
        location: location as string | null | undefined,
      });

      res.status(201).json(profile);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Student profile already exists for this user"
      ) {
        res.status(409).json({
          error: error.message,
        });
        return;
      }

      if (
        error instanceof Error &&
        error.message === "This username is already taken"
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

  getProfileByUserId = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      if (typeof userId !== "string") {
        res.status(400).json({
          error: "Invalid user ID",
        });
        return;
      }

      const profile =
        await this.studentProfileService.getProfileByUserId(userId);

      if (!profile) {
        res.status(404).json({
          error: "Student profile not found",
        });
        return;
      }

      res.json(profile);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };
}
