import { randomUUID } from "node:crypto";
import type {
  Community,
  PageWindow,
  University,
  UniversityDetail,
  UniversitySummary,
} from "@bridgeed/shared";
import { prisma } from "../config/prisma";
import { toCommunity } from "./community.repository";
import { toProgram } from "./program.repository";

/** Longest slug the repository will generate, so a long name cannot bloat it. */
const MAXIMUM_SLUG_LENGTH = 80;

/** How many `-2`, `-3`, … suffixes to try before falling back to a random one. */
const MAXIMUM_SLUG_ATTEMPTS = 20;

/**
 * The columns every university document carries, whether it is read on its own
 * or as part of a larger one (a student profile, a programme). Typed structurally
 * so a Prisma row with extra columns (counts, relations) is still assignable.
 */
interface UniversityRecord {
  id: string;
  name: string;
  slug: string;
  country: string;
  state: string | null;
  city: string | null;
  websiteUrl: string | null;
  description: string | null;
  logoUrl: string | null;
  verified: boolean;
  createdAt: Date;
}

/** The relation counts the directory and detail responses expose. */
interface UniversityCounts {
  _count: {
    programs: number;
    students: number;
    communities: number;
  };
}

/**
 * Maps a stored university row onto the shared `University` shape.
 *
 * It is exported so any repository that reads a university as part of a larger
 * document (a student profile, for instance) can hand back the same shape
 * without copying the field list.
 */
export function toUniversity(university: UniversityRecord): University {
  return {
    id: university.id,
    name: university.name,
    slug: university.slug,
    country: university.country,
    state: university.state,
    city: university.city,
    websiteUrl: university.websiteUrl,
    description: university.description,
    logoUrl: university.logoUrl,
    verified: university.verified,
    createdAt: university.createdAt.toISOString(),
  };
}

/** Adds the three relation counts a directory row shows. */
function toUniversitySummary(
  university: UniversityRecord & UniversityCounts,
): UniversitySummary {
  return {
    ...toUniversity(university),
    programCount: university._count.programs,
    studentCount: university._count.students,
    communityCount: university._count.communities,
  };
}

/**
 * Turns a university name into the URL-safe identifier stored in `slug`:
 * accents folded away, lowercased, and every run of other characters collapsed
 * into a single dash.
 */
export function toUniversitySlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAXIMUM_SLUG_LENGTH);
}

/** The columns a create writes; the slug is allocated by the repository. */
export interface CreateUniversityRecord {
  id: string;
  name: string;
  country: string;
  state: string | null;
  city: string | null;
  websiteUrl: string | null;
  description: string | null;
  logoUrl: string | null;
  verified: boolean;
}

/** The `where` clause a search term produces, shared by the list and its count. */
function searchFilter(search: string | undefined) {
  const term = search?.trim();

  return term ? { name: { contains: term, mode: "insensitive" as const } } : {};
}

/** The relation counts every summary query needs, in one batched subquery. */
const SUMMARY_INCLUDE = {
  _count: {
    select: { programs: true, students: true, communities: true },
  },
} as const;

export class UniversityRepository {
  /**
   * Picks a slug no other university holds yet. The name keeps its slug stable
   * once it exists; only the first row with a given name gets the bare slug.
   */
  private async allocateSlug(name: string): Promise<string> {
    const base = toUniversitySlug(name) || "university";

    for (let attempt = 1; attempt <= MAXIMUM_SLUG_ATTEMPTS; attempt += 1) {
      const candidate = attempt === 1 ? base : `${base}-${attempt}`;
      const existing = await prisma.university.findUnique({
        where: {
          slug: candidate,
        },
      });

      if (!existing) {
        return candidate;
      }
    }

    return `${base}-${randomUUID().slice(0, 8)}`;
  }

  async findById(id: string): Promise<University | null> {
    const university = await prisma.university.findUnique({
      where: {
        id,
      },
    });

    return university ? toUniversity(university) : null;
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

    return university ? toUniversity(university) : null;
  }

  /**
   * One page of the university directory, each row carrying its counts.
   *
   * The counts come from a single batched `_count` subquery, so listing a page
   * never turns into a query per relation. Ordering is by name then id, which is
   * deterministic across pages.
   */
  async findSummaries(
    window: PageWindow,
    search: string | undefined,
  ): Promise<UniversitySummary[]> {
    const records = await prisma.university.findMany({
      where: searchFilter(search),
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: window.skip,
      take: window.take,
      include: SUMMARY_INCLUDE,
    });

    return records.map(toUniversitySummary);
  }

  async countUniversities(search: string | undefined): Promise<number> {
    return prisma.university.count({ where: searchFilter(search) });
  }

  /**
   * Everything the detail screen needs, in one batched query: the university, its
   * counts, its programmes and its communities. Each relation is loaded by the
   * same query that loads the row, so no query runs per programme or community.
   */
  async findDetailById(id: string): Promise<UniversityDetail | null> {
    const record = await prisma.university.findUnique({
      where: { id },
      include: {
        ...SUMMARY_INCLUDE,
        programs: { orderBy: [{ name: "asc" }, { id: "asc" }] },
        communities: { orderBy: [{ name: "asc" }, { id: "asc" }] },
      },
    });

    return record ? this.toUniversityDetail(record) : null;
  }

  async findDetailBySlug(slug: string): Promise<UniversityDetail | null> {
    const record = await prisma.university.findUnique({
      where: { slug },
      include: {
        ...SUMMARY_INCLUDE,
        programs: { orderBy: [{ name: "asc" }, { id: "asc" }] },
        communities: { orderBy: [{ name: "asc" }, { id: "asc" }] },
      },
    });

    return record ? this.toUniversityDetail(record) : null;
  }

  private toUniversityDetail(
    record: UniversityRecord &
      UniversityCounts & {
        programs: Parameters<typeof toProgram>[0][];
        communities: Parameters<typeof toCommunity>[0][];
      },
  ): UniversityDetail {
    return {
      ...toUniversitySummary(record),
      programs: record.programs.map((program) =>
        toProgram(program, record.name),
      ),
      communities: record.communities.map((community): Community =>
        toCommunity(community),
      ),
    };
  }

  async create(record: CreateUniversityRecord): Promise<University> {
    const slug = await this.allocateSlug(record.name);

    const createdUniversity = await prisma.university.create({
      data: {
        id: record.id,
        name: record.name,
        slug,
        country: record.country,
        state: record.state,
        city: record.city,
        websiteUrl: record.websiteUrl,
        description: record.description,
        logoUrl: record.logoUrl,
        verified: record.verified,
        verifiedAt: record.verified ? new Date() : null,
      },
    });

    return toUniversity(createdUniversity);
  }

  async findAll(): Promise<University[]> {
    const universities = await prisma.university.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return universities.map(toUniversity);
  }
}
