import type { Interest } from "@bridgeed/shared/src/types/interest";
import { prisma } from "../config/prisma";

export function toInterest(interest: {
  id: string;
  name: string;
  createdAt: Date;
}): Interest {
  return {
    id: interest.id,
    name: interest.name,
    createdAt: interest.createdAt.toISOString(),
  };
}

export class InterestRepository {
  async findById(id: string): Promise<Interest | null> {
    const interest = await prisma.interest.findUnique({
      where: {
        id,
      },
    });

    return interest ? toInterest(interest) : null;
  }

  async findByName(name: string): Promise<Interest | null> {
    const interest = await prisma.interest.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    return interest ? toInterest(interest) : null;
  }

  async create(interest: Interest): Promise<Interest> {
    const createdInterest = await prisma.interest.create({
      data: {
        id: interest.id,
        name: interest.name,
      },
    });

    return toInterest(createdInterest);
  }

  async findAll(): Promise<Interest[]> {
    const interests = await prisma.interest.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return interests.map(toInterest);
  }

  /** Every interest whose id is in `ids`; see `SkillRepository.findManyByIds`. */
  async findManyByIds(ids: string[]): Promise<Interest[]> {
    if (ids.length === 0) {
      return [];
    }

    const interests = await prisma.interest.findMany({
      where: {
        id: { in: ids },
      },
    });

    return interests.map(toInterest);
  }
}
