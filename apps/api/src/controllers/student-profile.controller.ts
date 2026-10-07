import type { Request, Response } from "express";
import { requireAuthContext } from "../middleware/require-auth";
import {
  StudentProfileService,
  STUDENT_PROFILE_UNKNOWN_UNIVERSITY_MESSAGE,
  type UpdateStudentProfileInput,
} from "../services/student-profile.service";

/** Sent when a user has no student profile yet. */
export const STUDENT_PROFILE_NOT_FOUND_MESSAGE = "Student profile not found";

/** Raised by the service when the account already has a profile. */
const STUDENT_PROFILE_ALREADY_EXISTS_MESSAGE =
  "Student profile already exists for this user";

/** Raised by the service when the handle is claimed by somebody else. */
const USERNAME_TAKEN_MESSAGE = "This username is already taken";

/**
 * The length limits the server enforces on editable profile fields.
 *
 * They mirror the ones the app checks while typing, and exist here so a request
 * that did not come through the app — or one that was crafted by hand — cannot
 * store a name of ten thousand characters. The graduation year is bounded well
 * outside a real cohort so a typo is caught rather than stored.
 */
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 80;
const BIO_MAX_LENGTH = 240;
const DEGREE_MAX_LENGTH = 60;
const BRANCH_MAX_LENGTH = 60;
const LOCATION_MAX_LENGTH = 60;
const GRADUATION_YEAR_MIN = 1950;
const GRADUATION_YEAR_MAX = 2100;

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

type ProfileUpdateResult =
  | { kind: "ok"; updates: UpdateStudentProfileInput }
  | { kind: "invalid"; message: string };

type ProfileBody = Record<string, unknown>;

/** Trimmed text, or null when the caller sent nothing but whitespace. */
function optionalText(value: string): string | null {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

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

  /**
   * Returns the caller's own profile, together with its university, skills and
   * interests, or 404 when there is none yet.
   */
  getMyProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = requireAuthContext(req);
      const profile =
        await this.studentProfileService.getMyProfileDetails(userId);

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
   * Updates the caller's own profile.
   *
   * The owner is read from `req.auth` and the body is filtered down to the
   * editable fields, so a body carrying `userId` (or anything else) cannot move
   * the write to another account. The response is the refreshed document, which
   * is what the profile screen shows next.
   */
  updateMyProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = requireAuthContext(req);
      const body = (req.body ?? {}) as ProfileBody;
      const parsed = this.readProfileUpdate(body);

      if (parsed.kind === "invalid") {
        res.status(400).json({ error: parsed.message });
        return;
      }

      const profile = await this.studentProfileService.updateMyProfile(
        userId,
        parsed.updates,
      );

      if (!profile) {
        res.status(404).json({
          error: STUDENT_PROFILE_NOT_FOUND_MESSAGE,
        });
        return;
      }

      res.json(profile);
    } catch (error) {
      this.sendUpdateError(error, res);
    }
  };

  /** Replaces the caller's own skills with exactly the ids in the body. */
  replaceMySkills = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = requireAuthContext(req);
      const parsed = this.readTagIds(
        (req.body ?? {}) as ProfileBody,
        "skillIds",
      );

      if (parsed.kind === "invalid") {
        res.status(400).json({ error: parsed.message });
        return;
      }

      const skills = await this.studentProfileService.setMySkills(
        userId,
        parsed.ids,
      );

      res.json(skills);
    } catch (error) {
      this.sendTagError(error, res, "One or more skills do not exist");
    }
  };

  /** Replaces the caller's own interests with exactly the ids in the body. */
  replaceMyInterests = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = requireAuthContext(req);
      const parsed = this.readTagIds(
        (req.body ?? {}) as ProfileBody,
        "interestIds",
      );

      if (parsed.kind === "invalid") {
        res.status(400).json({ error: parsed.message });
        return;
      }

      const interests = await this.studentProfileService.setMyInterests(
        userId,
        parsed.ids,
      );

      res.json(interests);
    } catch (error) {
      this.sendTagError(error, res, "One or more interests do not exist");
    }
  };

  /**
   * Reads somebody else's profile by user id.
   *
   * The id is the *subject* of the read, not an actor: this is the public
   * profile other students see, and its privacy follows the existing rules. The
   * viewer's identity, if any, never changes whose profile this is.
   */
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
   * Reads the editable fields out of an update body.
   *
   * Only the fields named here can ever reach the database; everything else —
   * `userId`, `createdAt`, an account role — is ignored rather than rejected, so
   * a client that echoes a whole profile back saves what it is allowed to and
   * nothing more. Each field that is present is type-checked and bounded.
   */
  private readProfileUpdate(body: ProfileBody): ProfileUpdateResult {
    const updates: UpdateStudentProfileInput = {};

    if ("name" in body) {
      const name = body["name"];

      if (typeof name !== "string") {
        return { kind: "invalid", message: "name must be a string" };
      }

      const trimmed = name.trim();

      if (trimmed.length < NAME_MIN_LENGTH) {
        return {
          kind: "invalid",
          message: `name must be at least ${NAME_MIN_LENGTH} characters`,
        };
      }

      if (trimmed.length > NAME_MAX_LENGTH) {
        return {
          kind: "invalid",
          message: `name must be at most ${NAME_MAX_LENGTH} characters`,
        };
      }

      updates.name = trimmed;
    }

    const textFields: {
      key: "bio" | "degree" | "branch" | "location";
      maxLength: number;
    }[] = [
      { key: "bio", maxLength: BIO_MAX_LENGTH },
      { key: "degree", maxLength: DEGREE_MAX_LENGTH },
      { key: "branch", maxLength: BRANCH_MAX_LENGTH },
      { key: "location", maxLength: LOCATION_MAX_LENGTH },
    ];

    for (const field of textFields) {
      if (!(field.key in body)) {
        continue;
      }

      const value = body[field.key];

      if (value !== null && typeof value !== "string") {
        return {
          kind: "invalid",
          message: `${field.key} must be a string or null`,
        };
      }

      if (typeof value === "string" && value.trim().length > field.maxLength) {
        return {
          kind: "invalid",
          message: `${field.key} must be at most ${field.maxLength} characters`,
        };
      }

      updates[field.key] = value === null ? null : optionalText(value);
    }

    if ("universityId" in body) {
      const universityId = body["universityId"];

      if (universityId === null) {
        updates.universityId = null;
      } else if (typeof universityId === "string" && universityId.length > 0) {
        updates.universityId = universityId;
      } else {
        return {
          kind: "invalid",
          message: "universityId must be a string or null",
        };
      }
    }

    if ("graduationYear" in body) {
      const graduationYear = body["graduationYear"];

      if (graduationYear === null) {
        updates.graduationYear = null;
      } else if (
        typeof graduationYear !== "number" ||
        !Number.isInteger(graduationYear)
      ) {
        return {
          kind: "invalid",
          message: "graduationYear must be a whole number or null",
        };
      } else if (
        graduationYear < GRADUATION_YEAR_MIN ||
        graduationYear > GRADUATION_YEAR_MAX
      ) {
        return {
          kind: "invalid",
          message: `graduationYear must be between ${GRADUATION_YEAR_MIN} and ${GRADUATION_YEAR_MAX}`,
        };
      } else {
        updates.graduationYear = graduationYear;
      }
    }

    return { kind: "ok", updates };
  }

  /** Reads a list of ids for a replace-tags request. */
  private readTagIds(
    body: ProfileBody,
    key: string,
  ): { kind: "ok"; ids: string[] } | { kind: "invalid"; message: string } {
    const value = body[key];

    if (
      !Array.isArray(value) ||
      value.some((id) => typeof id !== "string" || id.length === 0)
    ) {
      return { kind: "invalid", message: `${key} must be an array of ids` };
    }

    return { kind: "ok", ids: value as string[] };
  }

  /** Maps an update failure onto a status, or 500 for anything unexpected. */
  private sendUpdateError(error: unknown, res: Response): void {
    if (
      error instanceof Error &&
      error.message === STUDENT_PROFILE_UNKNOWN_UNIVERSITY_MESSAGE
    ) {
      res.status(400).json({ error: error.message });
      return;
    }

    console.error(error);

    res.status(500).json({
      error: "Internal server error",
    });
  }

  /** Maps a replace-tags failure onto a status, or 500 for anything unexpected. */
  private sendTagError(
    error: unknown,
    res: Response,
    unknownIdMessage: string,
  ): void {
    const message = error instanceof Error ? error.message : undefined;

    if (message === STUDENT_PROFILE_NOT_FOUND_MESSAGE) {
      res.status(404).json({ error: message });
      return;
    }

    if (message === unknownIdMessage) {
      res.status(400).json({ error: message });
      return;
    }

    console.error(error);

    res.status(500).json({
      error: "Internal server error",
    });
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
