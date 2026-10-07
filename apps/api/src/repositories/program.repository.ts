import type { Program, ProgramDetail } from "@bridgeed/shared";
import { prisma } from "../config/prisma";
import { toSubject } from "./subject.repository";
import { toUniversity } from "./university.repository";

/** The columns a programme document carries. */
interface ProgramRecord {
  id: string;
  universityId: string;
  name: string;
  degree: string | null;
  field: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Maps a stored programme row onto the shared `Program` shape.
 *
 * `universityName` is passed in rather than read from a relation so a programme
 * can be mapped both when it was loaded under its university and when it was
 * loaded on its own with the university included.
 */
export function toProgram(
  record: ProgramRecord,
  universityName: string,
): Program {
  return {
    id: record.id,
    universityId: record.universityId,
    universityName,
    name: record.name,
    degree: record.degree,
    field: record.field,
    description: record.description,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class ProgramRepository {
  /** Every programme a university offers, with the university name attached. */
  async findByUniversity(universityId: string): Promise<Program[]> {
    const records = await prisma.program.findMany({
      where: { universityId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: { university: { select: { name: true } } },
    });

    return records.map((record) => toProgram(record, record.university.name));
  }

  /**
   * A programme together with its university and the subjects it teaches, in one
   * query with the relations included rather than read one at a time.
   */
  async findById(id: string): Promise<ProgramDetail | null> {
    const record = await prisma.program.findUnique({
      where: { id },
      include: {
        university: true,
        subjects: {
          include: { subject: true },
          orderBy: { subject: { name: "asc" } },
        },
        // The two counts come from one batched subquery, so the detail read does
        // not run a query per student or per community.
        _count: { select: { students: true, communities: true } },
      },
    });

    if (!record) {
      return null;
    }

    return {
      ...toProgram(record, record.university.name),
      university: toUniversity(record.university),
      subjects: record.subjects.map((link) => toSubject(link.subject)),
      studentCount: record._count.students,
      communityCount: record._count.communities,
    };
  }
}
