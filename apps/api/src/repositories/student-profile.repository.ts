import type { StudentProfile } from "@bridgeed/shared/src/types/user";
import { prisma } from "../config/prisma";

export class StudentProfileRepository {
  private toStudentProfile(
    profile: Awaited<ReturnType<typeof prisma.studentProfile.findUnique>>,
  ): StudentProfile | null {
    if (!profile) {
      return null;
    }

    return {
      userId: profile.userId,
      name: profile.name,
      username: profile.username,
      bio: profile.bio,
      universityId: profile.universityId,
      degree: profile.degree,
      branch: profile.branch,
      graduationYear: profile.graduationYear,
      profileImageUrl: profile.profileImageUrl,
      location: profile.location,
    };
  }

  async findByUserId(userId: string): Promise<StudentProfile | null> {
    const profile = await prisma.studentProfile.findUnique({
      where: {
        userId,
      },
    });

    return this.toStudentProfile(profile);
  }

  async findByUsername(username: string): Promise<StudentProfile | null> {
    const profile = await prisma.studentProfile.findUnique({
      where: {
        username,
      },
    });

    return this.toStudentProfile(profile);
  }

  async create(profile: StudentProfile): Promise<StudentProfile> {
    const createdProfile = await prisma.studentProfile.create({
      data: {
        userId: profile.userId,
        name: profile.name,
        username: profile.username,
        bio: profile.bio,
        universityId: profile.universityId,
        degree: profile.degree,
        branch: profile.branch,
        graduationYear: profile.graduationYear,
        profileImageUrl: profile.profileImageUrl,
        location: profile.location,
      },
    });

    return this.toStudentProfile(createdProfile)!;
  }

  async update(
    userId: string,
    profile: Partial<Omit<StudentProfile, "userId">>,
  ): Promise<StudentProfile | null> {
    const updatedProfile = await prisma.studentProfile.update({
      where: {
        userId,
      },
      data: profile,
    });

    return this.toStudentProfile(updatedProfile);
  }
}
