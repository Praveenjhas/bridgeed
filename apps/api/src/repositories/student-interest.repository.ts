import type { Interest } from "@bridgeed/shared/src/types/interest";
import { prisma } from "../config/prisma";
import { toInterest } from "./interest.repository";

export class StudentInterestRepository {
  async findInterestsByStudentId(studentId: string): Promise<Interest[]> {
    const records = await prisma.studentInterest.findMany({
      where: {
        studentId,
      },
      include: {
        interest: true,
      },
      orderBy: {
        interest: {
          name: "asc",
        },
      },
    });

    return records.map((record) => toInterest(record.interest));
  }

  async exists(studentId: string, interestId: string): Promise<boolean> {
    const record = await prisma.studentInterest.findUnique({
      where: {
        studentId_interestId: {
          studentId,
          interestId,
        },
      },
    });

    return record !== null;
  }

  async create(studentId: string, interestId: string): Promise<void> {
    await prisma.studentInterest.create({
      data: {
        studentId,
        interestId,
      },
    });
  }

  async delete(studentId: string, interestId: string): Promise<number> {
    const result = await prisma.studentInterest.deleteMany({
      where: {
        studentId,
        interestId,
      },
    });

    return result.count;
  }
}
