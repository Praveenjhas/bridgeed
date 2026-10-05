import type { StudentProfile } from "@bridgeed/shared/src/types/user";
import { StudentProfileRepository } from "../repositories/student-profile.repository";

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

export class StudentProfileService {
  constructor(
    private readonly studentProfileRepository: StudentProfileRepository,
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
