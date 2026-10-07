import type { Paginated } from "@bridgeed/shared";
import type {
  StudentProfile,
  StudentProfileDetails,
} from "@bridgeed/shared/src/types/user";
import type { University } from "@bridgeed/shared/src/types/university";
import { ProgramRepository } from "../repositories/program.repository";
import { StudentProfileRepository } from "../repositories/student-profile.repository";
import { UniversityRepository } from "../repositories/university.repository";
import {
  normalizeLimit,
  normalizePage,
  toPageWindow,
  toPaginated,
} from "../utils/pagination";
import { StudentSkillService } from "./student-skill.service";
import { StudentInterestService } from "./student-interest.service";

export interface CreateStudentProfileInput {
  userId: string;
  name: string;
  username: string;
  bio?: string | null;
  universityId?: string | null;
  programId?: string | null;
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
  programId?: string | null;
  degree?: string | null;
  branch?: string | null;
  graduationYear?: number | null;
  location?: string | null;
}

/** The page window the Discover screen asks the directory for. */
export interface ListStudentProfilesQuery {
  page?: number;
  limit?: number;
}

/** Raised when an update names a university that does not exist. */
export const STUDENT_PROFILE_UNKNOWN_UNIVERSITY_MESSAGE =
  "The selected university does not exist";

/** Raised when an update names a programme that does not exist. */
export const STUDENT_PROFILE_UNKNOWN_PROGRAM_MESSAGE =
  "The selected program does not exist";

/** Raised when a programme is chosen that the named university does not offer. */
export const STUDENT_PROFILE_PROGRAM_UNIVERSITY_MISMATCH_MESSAGE =
  "The selected program is not offered by the selected university";

export class StudentProfileService {
  constructor(
    private readonly studentProfileRepository: StudentProfileRepository,
    private readonly universityRepository: UniversityRepository,
    private readonly programRepository: ProgramRepository,
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

    // The academic context is checked before the row is written, so a profile can
    // never be created pointing at a university or programme that does not exist,
    // and never at a programme its university does not offer. Onboarding sends the
    // pair the picker produced, so an id that has since been deleted is answered
    // with a reason instead of a foreign key failure.
    await this.validateAcademicAffiliation(
      input.universityId ?? null,
      input.programId ?? null,
    );

    const profile: StudentProfile = {
      userId: input.userId,
      name: input.name,
      username: input.username,
      bio: input.bio ?? null,
      universityId: input.universityId ?? null,
      programId: input.programId ?? null,
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
   * One page of the public student directory, used by Discover.
   *
   * It is a plain, newest-first list: no ranking and no search index, only the
   * page window the caller asked for. The viewer's own profile is excluded so the
   * list is always other students.
   */
  async listStudentProfiles(
    query: ListStudentProfilesQuery,
    excludeUserId: string | null,
  ): Promise<Paginated<StudentProfile>> {
    const page = normalizePage(query.page);
    const limit = normalizeLimit(query.limit);
    const window = toPageWindow(page, limit);

    const [items, total] = await Promise.all([
      this.studentProfileRepository.findDirectory(window, excludeUserId),
      this.studentProfileRepository.countDirectory(excludeUserId),
    ]);

    return toPaginated(items, page, limit, total);
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

    // The pair is checked against what the profile will be left with, so an update
    // that sends only a programme cannot leave the university pointing somewhere
    // else: a programme that is named has to belong to the university the profile
    // records, whether that university arrived in this request or is the one
    // already stored.
    await this.validateAcademicAffiliation(
      updates.universityId !== undefined
        ? updates.universityId
        : existingProfile.universityId,
      updates.programId !== undefined
        ? updates.programId
        : existingProfile.programId,
    );

    await this.studentProfileRepository.update(userId, updates);

    return this.studentProfileRepository.findDetailsByUserId(userId);
  }

  /**
   * Checks the university and programme a profile is about to record.
   *
   * Anything that is set has to exist, and a programme has to belong to the
   * university the profile will carry, so the pair can never describe a course the
   * university does not offer. `null` on either means "not recorded", which is a
   * valid state rather than a contradiction, and is what keeps every profile that
   * existed before the academic graph working exactly as it did.
   */
  private async validateAcademicAffiliation(
    universityId: string | null,
    programId: string | null,
  ): Promise<void> {
    if (universityId) {
      const university = await this.universityRepository.findById(universityId);

      if (!university) {
        throw new Error(STUDENT_PROFILE_UNKNOWN_UNIVERSITY_MESSAGE);
      }
    }

    if (programId) {
      const program = await this.programRepository.findById(programId);

      if (!program) {
        throw new Error(STUDENT_PROFILE_UNKNOWN_PROGRAM_MESSAGE);
      }

      if (universityId && program.universityId !== universityId) {
        throw new Error(STUDENT_PROFILE_PROGRAM_UNIVERSITY_MISMATCH_MESSAGE);
      }
    }
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
