import type { PageWindow } from "@bridgeed/shared";
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

  /**
   * One page of the public student directory, newest first.
   *
   * Discovery lists students rather than looking one up, so it reads profiles
   * directly: there is no membership or connection filter, only the page window.
   * The viewer's own profile is left out, because a student cannot connect with
   * themselves.
   */
  async findDirectory(
    window: PageWindow,
    excludeUserId: string | null,
  ): Promise<StudentProfile[]> {
    const records = await prisma.studentProfile.findMany({
      where: excludeUserId ? { userId: { not: excludeUserId } } : undefined,
      orderBy: [{ createdAt: "desc" }, { userId: "asc" }],
      skip: window.skip,
      take: window.take,
    });

    return records
      .map((record) => this.toStudentProfile(record))
      .filter((profile): profile is StudentProfile => profile !== null);
  }

  /** Total number of students in the directory, excluding the viewer. */
  async countDirectory(excludeUserId: string | null): Promise<number> {
    return prisma.studentProfile.count({
      where: excludeUserId ? { userId: { not: excludeUserId } } : undefined,
    });
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
