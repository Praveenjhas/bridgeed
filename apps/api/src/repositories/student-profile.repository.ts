import type {
  StudentProfile,
  StudentProfileDetails,
} from "@bridgeed/shared/src/types/user";
import { toInterest } from "./interest.repository";
import { prisma } from "../config/prisma";
import { toSkill } from "./skill.repository";
import { toUniversity } from "./university.repository";

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

  /**
   * Reads a profile together with everything it names: its university and the
   * skills and interests attached to it.
   *
   * The whole document is assembled in one query with three includes, so the
   * signed-in student's profile is read once rather than by four round trips
   * that could disagree with each other halfway through.
   */
  async findDetailsByUserId(
    userId: string,
  ): Promise<StudentProfileDetails | null> {
    const profile = await prisma.studentProfile.findUnique({
      where: {
        userId,
      },
      include: {
        university: true,
        skills: {
          include: { skill: true },
          orderBy: { skill: { name: "asc" } },
        },
        interests: {
          include: { interest: true },
          orderBy: { interest: { name: "asc" } },
        },
      },
    });

    const base = this.toStudentProfile(profile);

    if (!base || !profile) {
      return null;
    }

    return {
      ...base,
      university: profile.university ? toUniversity(profile.university) : null,
      skills: profile.skills.map((record) => toSkill(record.skill)),
      interests: profile.interests.map((record) => toInterest(record.interest)),
    };
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
