import type {
  StudentProfile,
  StudentProfileDetails,
} from "@bridgeed/shared/src/types/user";
import type { University } from "@bridgeed/shared/src/types/university";
import { StudentProfileRepository } from "../repositories/student-profile.repository";
import { UniversityRepository } from "../repositories/university.repository";
import { StudentSkillService } from "./student-skill.service";
import { StudentInterestService } from "./student-interest.service";

export interface CreateStudentProfileInput {
  userId: string;
  name: string;
  username: string;
  bio?: string | null;
  universityId?: string | null;
  degree?: string | null;
  branch?: string | null;
  graduationYear?: number | null;
  profileImageUrl?: string | null;
  location?: string | null;
}

/**
 * The fields a student may change about their own profile.
 *
 * It is deliberately narrower than `StudentProfile`: `userId` is the account the
 * profile belongs to and is never editable, and `username` is left out because a
 * handle is an identity other students already refer to. Everything here is a
 * field the profile screen shows and a student owns.
 */
export interface UpdateStudentProfileInput {
  name?: string;
  bio?: string | null;
  universityId?: string | null;
  degree?: string | null;
  branch?: string | null;
  graduationYear?: number | null;
  location?: string | null;
}

/** Raised when an update names a university that does not exist. */
export const STUDENT_PROFILE_UNKNOWN_UNIVERSITY_MESSAGE =
  "The selected university does not exist";

export class StudentProfileService {
  constructor(
    private readonly studentProfileRepository: StudentProfileRepository,
    private readonly universityRepository: UniversityRepository,
    private readonly studentSkillService: StudentSkillService,
    private readonly studentInterestService: StudentInterestService,
  ) {}

  async createProfile(
    input: CreateStudentProfileInput,
  ): Promise<StudentProfile> {
    const existingProfile = await this.studentProfileRepository.findByUserId(
      input.userId,
    );

    if (existingProfile) {
      throw new Error("Student profile already exists for this user");
    }

    const existingUsername = await this.studentProfileRepository.findByUsername(
      input.username,
    );

    if (existingUsername) {
      throw new Error("This username is already taken");
    }

    const profile: StudentProfile = {
      userId: input.userId,
      name: input.name,
      username: input.username,
      bio: input.bio ?? null,
      universityId: input.universityId ?? null,
      degree: input.degree ?? null,
      branch: input.branch ?? null,
      graduationYear: input.graduationYear ?? null,
      profileImageUrl: input.profileImageUrl ?? null,
      location: input.location ?? null,
    };

    return this.studentProfileRepository.create(profile);
  }

  async getProfileByUserId(userId: string): Promise<StudentProfile | null> {
    return this.studentProfileRepository.findByUserId(userId);
  }

  /**
   * The signed-in student's own profile, with its university, skills and
   * interests. `null` means the account has no profile yet, which the endpoint
   * reports as 404.
   */
  async getMyProfileDetails(
    userId: string,
  ): Promise<StudentProfileDetails | null> {
    return this.studentProfileRepository.findDetailsByUserId(userId);
  }

  /**
   * Applies an update to one profile and returns the refreshed document.
   *
   * The owner is `userId`, which the caller has already taken from the verified
   * token, so a body that names somebody else cannot reach a different profile.
   * A changed university is checked to exist first, so an update can fail with a
   * clear reason instead of a foreign key error. `null` means the profile is
   * missing.
   */
  async updateMyProfile(
    userId: string,
    updates: UpdateStudentProfileInput,
  ): Promise<StudentProfileDetails | null> {
    const existingProfile =
      await this.studentProfileRepository.findByUserId(userId);

    if (!existingProfile) {
      return null;
    }

    if (updates.universityId !== undefined && updates.universityId !== null) {
      const university = await this.universityRepository.findById(
        updates.universityId,
      );

      if (!university) {
        throw new Error(STUDENT_PROFILE_UNKNOWN_UNIVERSITY_MESSAGE);
      }
    }

    await this.studentProfileRepository.update(userId, updates);

    return this.studentProfileRepository.findDetailsByUserId(userId);
  }

  /** Replaces the signed-in student's skills with exactly `skillIds`. */
  async setMySkills(userId: string, skillIds: string[]) {
    return this.studentSkillService.setStudentSkills(userId, skillIds);
  }

  /** Replaces the signed-in student's interests with exactly `interestIds`. */
  async setMyInterests(userId: string, interestIds: string[]) {
    return this.studentInterestService.setStudentInterests(userId, interestIds);
  }

  async updateProfile(
    userId: string,
    updates: Partial<Omit<StudentProfile, "userId">>,
  ): Promise<StudentProfile | null> {
    if (updates.username) {
      const existingUsername =
        await this.studentProfileRepository.findByUsername(updates.username);

      if (existingUsername && existingUsername.userId !== userId) {
        throw new Error("This username is already taken");
      }
    }

    return this.studentProfileRepository.update(userId, updates);
  }
}

