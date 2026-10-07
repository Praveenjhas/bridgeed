import type { PageWindow, Subject } from "@bridgeed/shared";
import { prisma } from "../config/prisma";

/** The columns a subject document carries. */
interface SubjectRecord {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Maps a stored subject row onto the shared `Subject` shape. */
export function toSubject(subject: SubjectRecord): Subject {
  return {
    id: subject.id,
    name: subject.name,
    slug: subject.slug,
    createdAt: subject.createdAt.toISOString(),
    updatedAt: subject.updatedAt.toISOString(),
  };
}

/** The `where` clause a search term produces, shared by the list and its count. */
function searchFilter(search: string | undefined) {
  const term = search?.trim();

  return term ? { name: { contains: term, mode: "insensitive" as const } } : {};
}

export class SubjectRepository {
  /** One page of the subject catalog, ordered by name for stable paging. */
  async list(window: PageWindow, search: string | undefined): Promise<Subject[]> {
    const records = await prisma.subject.findMany({
      where: searchFilter(search),
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: window.skip,
      take: window.take,
    });

    return records.map(toSubject);
  }

  async countSubjects(search: string | undefined): Promise<number> {
    return prisma.subject.count({ where: searchFilter(search) });
  }

  async findById(id: string): Promise<Subject | null> {
    const record = await prisma.subject.findUnique({ where: { id } });

    return record ? toSubject(record) : null;
  }
}
