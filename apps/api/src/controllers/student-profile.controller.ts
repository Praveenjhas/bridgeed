import type { Request, Response } from "express";
import { requireAuthContext } from "../middleware/require-auth";
import { StudentProfileService } from "../services/student-profile.service";

/** Sent when a user has no student profile yet. */
export const STUDENT_PROFILE_NOT_FOUND_MESSAGE = "Student profile not found";

/** Raised by the service when the account already has a profile. */
const STUDENT_PROFILE_ALREADY_EXISTS_MESSAGE =
  "Student profile already exists for this user";

/** Raised by the service when the handle is claimed by somebody else. */
const USERNAME_TAKEN_MESSAGE = "This username is already taken";

/**
 * The optional fields accepted when a profile is created. `undefined` means the
 * caller said nothing about the field; `null` means it deliberately cleared it.
 */
interface OptionalProfileFields {
  bio: string | null | undefined;
  universityId: string | null | undefined;
  degree: string | null | undefined;
  branch: string | null | undefined;
  graduationYear: number | null | undefined;
  profileImageUrl: string | null | undefined;
  location: string | null | undefined;
}

type OptionalProfileFieldsResult =
  | { kind: "ok"; fields: OptionalProfileFields }
  | { kind: "invalid"; message: string };

type ProfileBody = Record<string, unknown>;

export class StudentProfileController {
  constructor(private readonly studentProfileService: StudentProfileService) {}

  /**
   * Legacy create path. The owner is taken from the request body, which is why
   * new clients create their profile through `createMyProfile` instead.
   */
  createProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const body = (req.body ?? {}) as ProfileBody;
      const { userId, name, username } = body;

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

      const optionalFields = this.readOptionalProfileFields(body);

      if (optionalFields.kind === "invalid") {
        res.status(400).json({ error: optionalFields.message });
        return;
      }

      const profile = await this.studentProfileService.createProfile({
        userId,
        name,
        username,
        ...optionalFields.fields,
      });

      res.status(201).json(profile);
    } catch (error) {
      this.sendCreateError(error, res);
    }
  };

  /**
   * Creates the caller's own student profile. The owner is read from `req.auth`,
   * so the body cannot name somebody else's account.
   */
  createMyProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = requireAuthContext(req);
      const body = (req.body ?? {}) as ProfileBody;
      const { name, username } = body;

      if (typeof name !== "string" || typeof username !== "string") {
        res.status(400).json({
          error: "name and username are required",
        });
        return;
      }

      const optionalFields = this.readOptionalProfileFields(body);

      if (optionalFields.kind === "invalid") {
        res.status(400).json({ error: optionalFields.message });
        return;
      }

      const profile = await this.studentProfileService.createProfile({
        userId,
        name,
        username,
        ...optionalFields.fields,
      });

      res.status(201).json(profile);
    } catch (error) {
      this.sendCreateError(error, res);
    }
  };

  /** Returns the caller's own student profile, or 404 when there is none yet. */
  getMyProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = requireAuthContext(req);
      const profile =
        await this.studentProfileService.getProfileByUserId(userId);

      if (!profile) {
        res.status(404).json({
          error: STUDENT_PROFILE_NOT_FOUND_MESSAGE,
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
          error: STUDENT_PROFILE_NOT_FOUND_MESSAGE,
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

  /**
   * Validates the optional profile fields once, so both create paths accept the
   * same subset without repeating the type checks.
   */
  private readOptionalProfileFields(
    body: ProfileBody,
  ): OptionalProfileFieldsResult {
    const {
      bio,
      universityId,
      degree,
      branch,
      graduationYear,
      profileImageUrl,
      location,
    } = body;

    if (bio !== undefined && bio !== null && typeof bio !== "string") {
      return { kind: "invalid", message: "bio must be a string or null" };
    }

    if (
      graduationYear !== undefined &&
      graduationYear !== null &&
      typeof graduationYear !== "number"
    ) {
      return {
        kind: "invalid",
        message: "graduationYear must be a number or null",
      };
    }

    return {
      kind: "ok",
      fields: {
        bio: bio as string | null | undefined,
        universityId: universityId as string | null | undefined,
        degree: degree as string | null | undefined,
        branch: branch as string | null | undefined,
        graduationYear: graduationYear as number | null | undefined,
        profileImageUrl: profileImageUrl as string | null | undefined,
        location: location as string | null | undefined,
      },
    };
  }

  /**
   * Maps the two conflicts the service can raise onto 409 responses, so both
   * create paths report a taken handle and an existing profile identically.
   */
  private sendCreateError(error: unknown, res: Response): void {
    if (
      error instanceof Error &&
      error.message === STUDENT_PROFILE_ALREADY_EXISTS_MESSAGE
    ) {
      res.status(409).json({ error: error.message });
      return;
    }

    if (error instanceof Error && error.message === USERNAME_TAKEN_MESSAGE) {
      res.status(409).json({ error: error.message });
      return;
    }

    console.error(error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
}
