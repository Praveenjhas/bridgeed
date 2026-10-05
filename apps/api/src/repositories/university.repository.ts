import type { University } from "@bridgeed/shared/src/types/university";
import { prisma } from "../config/prisma";

export class UniversityRepository {
  private toUniversity(
    university: Awaited<ReturnType<typeof prisma.university.findUnique>>,
  ): University | null {
    if (!university) {
      return null;
    }

    return {
      id: university.id,
      name: university.name,
      country: university.country,
      state: university.state,
      city: university.city,
      websiteUrl: university.websiteUrl,
      verified: university.verified,
      createdAt: university.createdAt.toISOString(),
    };
  }

  async findById(id: string): Promise<University | null> {
    const university = await prisma.university.findUnique({
      where: {
        id,
      },
    });

    return this.toUniversity(university);
  }

  async findByName(name: string): Promise<University | null> {
    const university = await prisma.university.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    return this.toUniversity(university);
  }

  async create(university: University): Promise<University> {
    const createdUniversity = await prisma.university.create({
      data: {
        id: university.id,
        name: university.name,
        country: university.country,
        state: university.state,
        city: university.city,
        websiteUrl: university.websiteUrl,
        verified: university.verified,
      },
    });

    return this.toUniversity(createdUniversity)!;
  }

  async findAll(): Promise<University[]> {
    const universities = await prisma.university.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return universities.map((university) => ({
      id: university.id,
      name: university.name,
      country: university.country,
      state: university.state,
      city: university.city,
      websiteUrl: university.websiteUrl,
      verified: university.verified,
      createdAt: university.createdAt.toISOString(),
      updatedAt: university.updatedAt.toISOString(),
    }));
  }
}
