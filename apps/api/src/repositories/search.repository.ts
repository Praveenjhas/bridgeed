import type {
  CommunitySearchResult,
  PageWindow,
  ProgramSearchResult,
  StudentSearchResult,
  SubjectSearchResult,
  UniversitySearchResult,
} from "@bridgeed/shared";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";
import { ACTIVE_MEMBERSHIP_STATUS } from "./community-membership.repository";
import { toAcademicContext } from "./community.repository";

/**
 * Reads for global search.
 *
 * Every category is matched with the same four questions, asked in order of
 * relevance: does the text *equal* the term, does it *start with* the term, does
 * it *contain* the term, and does a secondary field hold it. Each question
 * excludes the ones asked before it, so the tiers are disjoint and a row can only
 * be found by one of them. Rows are read tier by tier, most relevant first, and
 * each tier is ordered by name then id, so a term that matches more than a page
 * returns the same rows in the same order every time.
 *
 * The tiers are read until the requested page is covered, never further: a search
 * for five rows touches five rows per category at worst, and a category that
 * matches nothing costs one empty read. Text matching is `ILIKE` on PostgreSQL,
 * which is case insensitive but *not* accent or typo tolerant — that is a
 * documented v1 boundary, not an accident.
 *
 * Matching happens on the human readable fields a student would type. A community
 * is found by its name and description, never by the university or subject it is
 * attached to, and a programme carries its university's name so a result row can
 * be rendered without a second read.
 */

const insensitive = "insensitive" as const;

/** Fills one page from a category's relevance tiers. */
interface RankedRead<Where, Row> {
  /** Tier filters, most relevant first, each excluding the ones before it. */
  tiers: readonly Where[];
  /** Reads the matches of one tier, already ordered and already capped. */
  readTier: (where: Where, take: number) => Promise<Row[]>;
  /** The page to fill. */
  window: PageWindow;
}

/**
 * Reads tiers in order until the page is covered, then slices it out.
 *
 * Reading `skip + take` rows from the most relevant tiers is enough to place any
 * row of the requested page: everything above it is more relevant, and a row that
 * fell outside the read could only be less relevant.
 */
async function collectRankedPage<Where, Row>({
  tiers,
  readTier,
  window,
}: RankedRead<Where, Row>): Promise<Row[]> {
  const needed = window.skip + window.take;
  const collected: Row[] = [];

  for (const where of tiers) {
    if (collected.length >= needed) {
      break;
    }

    const rows = await readTier(where, needed - collected.length);

    collected.push(...rows);
  }

  return collected.slice(window.skip, window.skip + window.take);
}

const UNIVERSITY_COLUMNS = {
  id: true,
  name: true,
  slug: true,
  city: true,
  state: true,
  country: true,
  logoUrl: true,
} as const;

/**
 * Universities, by name first and city second.
 *
 * Country is deliberately not matched: a term like "India" would return the whole
 * catalog rather than an answer.
 */
function universityFilters(term: string): {
  tiers: Prisma.UniversityWhereInput[];
  all: Prisma.UniversityWhereInput;
} {
  return {
    tiers: [
      { name: { equals: term, mode: insensitive } },
      {
        name: { startsWith: term, mode: insensitive },
        NOT: { name: { equals: term, mode: insensitive } },
      },
      {
        name: { contains: term, mode: insensitive },
        NOT: { name: { startsWith: term, mode: insensitive } },
      },
      {
        city: { contains: term, mode: insensitive },
        NOT: { name: { contains: term, mode: insensitive } },
      },
    ],
    all: {
      OR: [
        { name: { contains: term, mode: insensitive } },
        { city: { contains: term, mode: insensitive } },
      ],
    },
  };
}

const PROGRAM_COLUMNS = {
  id: true,
  name: true,
  degree: true,
  field: true,
  universityId: true,
  university: { select: { name: true } },
} as const;

interface ProgramRecord {
  id: string;
  name: string;
  degree: string | null;
  field: string | null;
  universityId: string;
  university: { name: string };
}

/** Programmes, by name and then by the degree or field they are taught in. */
function programFilters(term: string): {
  tiers: Prisma.ProgramWhereInput[];
  all: Prisma.ProgramWhereInput;
} {
  return {
    tiers: [
      { name: { equals: term, mode: insensitive } },
      {
        name: { startsWith: term, mode: insensitive },
        NOT: { name: { equals: term, mode: insensitive } },
      },
      {
        name: { contains: term, mode: insensitive },
        NOT: { name: { startsWith: term, mode: insensitive } },
      },
      {
        OR: [
          { degree: { contains: term, mode: insensitive } },
          { field: { contains: term, mode: insensitive } },
        ],
        NOT: { name: { contains: term, mode: insensitive } },
      },
    ],
    all: {
      OR: [
        { name: { contains: term, mode: insensitive } },
        { degree: { contains: term, mode: insensitive } },
        { field: { contains: term, mode: insensitive } },
      ],
    },
  };
}

function toProgramResult(record: ProgramRecord): ProgramSearchResult {
  return {
    id: record.id,
    name: record.name,
    degree: record.degree,
    field: record.field,
    universityId: record.universityId,
    universityName: record.university.name,
  };
}

const SUBJECT_COLUMNS = { id: true, name: true, slug: true } as const;

/** Subjects are matched by their canonical name alone. */
function subjectFilters(term: string): {
  tiers: Prisma.SubjectWhereInput[];
  all: Prisma.SubjectWhereInput;
} {
  return {
    tiers: [
      { name: { equals: term, mode: insensitive } },
      {
        name: { startsWith: term, mode: insensitive },
        NOT: { name: { equals: term, mode: insensitive } },
      },
      {
        name: { contains: term, mode: insensitive },
        NOT: { name: { startsWith: term, mode: insensitive } },
      },
    ],
    all: { name: { contains: term, mode: insensitive } },
  };
}

const COMMUNITY_COLUMNS = {
  id: true,
  name: true,
  slug: true,
  description: true,
  university: { select: { id: true, name: true, slug: true } },
  program: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true } },
  _count: {
    select: { memberships: { where: { status: ACTIVE_MEMBERSHIP_STATUS } } },
  },
} as const;

interface CommunityRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  university: { id: string; name: string; slug: string } | null;
  program: { id: string; name: string } | null;
  subject: { id: string; name: string } | null;
  _count: { memberships: number };
}

/** Communities, by name and then by description. */
function communityFilters(term: string): {
  tiers: Prisma.CommunityWhereInput[];
  all: Prisma.CommunityWhereInput;
} {
  return {
    tiers: [
      { name: { equals: term, mode: insensitive } },
      {
        name: { startsWith: term, mode: insensitive },
        NOT: { name: { equals: term, mode: insensitive } },
      },
      {
        name: { contains: term, mode: insensitive },
        NOT: { name: { startsWith: term, mode: insensitive } },
      },
      {
        description: { contains: term, mode: insensitive },
        NOT: { name: { contains: term, mode: insensitive } },
      },
    ],
    all: {
      OR: [
        { name: { contains: term, mode: insensitive } },
        { description: { contains: term, mode: insensitive } },
      ],
    },
  };
}

function toCommunityResult(record: CommunityRecord): CommunitySearchResult {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description,
    memberCount: record._count.memberships,
    academicContext: toAcademicContext(record),
  };
}

const STUDENT_COLUMNS = {
  userId: true,
  name: true,
  username: true,
  graduationYear: true,
  profileImageUrl: true,
  university: { select: { name: true } },
  program: { select: { name: true } },
} as const;

interface StudentRecord {
  userId: string;
  name: string;
  username: string;
  graduationYear: number | null;
  profileImageUrl: string | null;
  university: { name: string } | null;
  program: { name: string } | null;
}

/**
 * Students, by profile name, then username, then the institution and programme
 * they study in.
 *
 * The viewing student is left out of every tier, exactly as the student directory
 * leaves them out: a search must never be a way to find yourself.
 */
function studentFilters(
  term: string,
  viewerId: string,
): {
  tiers: Prisma.StudentProfileWhereInput[];
  all: Prisma.StudentProfileWhereInput;
} {
  const notViewer = { userId: { not: viewerId } } as const;

  return {
    tiers: [
      { ...notViewer, name: { equals: term, mode: insensitive } },
      {
        ...notViewer,
        name: { startsWith: term, mode: insensitive },
        NOT: { name: { equals: term, mode: insensitive } },
      },
      {
        ...notViewer,
        name: { contains: term, mode: insensitive },
        NOT: { name: { startsWith: term, mode: insensitive } },
      },
      {
        ...notViewer,
        username: { contains: term, mode: insensitive },
        NOT: { name: { contains: term, mode: insensitive } },
      },
      {
        ...notViewer,
        OR: [
          { university: { name: { contains: term, mode: insensitive } } },
          { program: { name: { contains: term, mode: insensitive } } },
        ],
        NOT: [
          { name: { contains: term, mode: insensitive } },
          { username: { contains: term, mode: insensitive } },
        ],
      },
    ],
    all: {
      ...notViewer,
      OR: [
        { name: { contains: term, mode: insensitive } },
        { username: { contains: term, mode: insensitive } },
        { university: { name: { contains: term, mode: insensitive } } },
        { program: { name: { contains: term, mode: insensitive } } },
      ],
    },
  };
}

function toStudentResult(record: StudentRecord): StudentSearchResult {
  return {
    userId: record.userId,
    name: record.name,
    username: record.username,
    graduationYear: record.graduationYear,
    profileImageUrl: record.profileImageUrl,
    universityName: record.university?.name ?? null,
    programName: record.program?.name ?? null,
  };
}

export class SearchRepository {
  /** One page of universities matching `term`, most relevant first. */
  async findUniversities(
    term: string,
    window: PageWindow,
  ): Promise<UniversitySearchResult[]> {
    return collectRankedPage({
      tiers: universityFilters(term).tiers,
      readTier: (where, take) =>
        prisma.university.findMany({
          where,
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take,
          select: UNIVERSITY_COLUMNS,
        }),
      window,
    });
  }

  /** How many universities match `term`, ignoring the page. */
  async countUniversities(term: string): Promise<number> {
    return prisma.university.count({ where: universityFilters(term).all });
  }

  /** One page of programmes matching `term`, most relevant first. */
  async findPrograms(
    term: string,
    window: PageWindow,
  ): Promise<ProgramSearchResult[]> {
    const rows = await collectRankedPage({
      tiers: programFilters(term).tiers,
      readTier: (where, take) =>
        prisma.program.findMany({
          where,
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take,
          select: PROGRAM_COLUMNS,
        }),
      window,
    });

    return rows.map(toProgramResult);
  }

  /** How many programmes match `term`, ignoring the page. */
  async countPrograms(term: string): Promise<number> {
    return prisma.program.count({ where: programFilters(term).all });
  }

  /** One page of subjects matching `term`, most relevant first. */
  async findSubjects(
    term: string,
    window: PageWindow,
  ): Promise<SubjectSearchResult[]> {
    return collectRankedPage({
      tiers: subjectFilters(term).tiers,
      readTier: (where, take) =>
        prisma.subject.findMany({
          where,
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take,
          select: SUBJECT_COLUMNS,
        }),
      window,
    });
  }

  /** How many subjects match `term`, ignoring the page. */
  async countSubjects(term: string): Promise<number> {
    return prisma.subject.count({ where: subjectFilters(term).all });
  }

  /** One page of communities matching `term`, most relevant first. */
  async findCommunities(
    term: string,
    window: PageWindow,
  ): Promise<CommunitySearchResult[]> {
    const rows = await collectRankedPage({
      tiers: communityFilters(term).tiers,
      readTier: (where, take) =>
        prisma.community.findMany({
          where,
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take,
          select: COMMUNITY_COLUMNS,
        }),
      window,
    });

    return rows.map(toCommunityResult);
  }

  /** How many communities match `term`, ignoring the page. */
  async countCommunities(term: string): Promise<number> {
    return prisma.community.count({ where: communityFilters(term).all });
  }

  /** One page of students matching `term`, most relevant first. */
  async findStudents(
    term: string,
    viewerId: string,
    window: PageWindow,
  ): Promise<StudentSearchResult[]> {
    const rows = await collectRankedPage({
      tiers: studentFilters(term, viewerId).tiers,
      readTier: (where, take) =>
        prisma.studentProfile.findMany({
          where,
          orderBy: [{ name: "asc" }, { userId: "asc" }],
          take,
          select: STUDENT_COLUMNS,
        }),
      window,
    });

    return rows.map(toStudentResult);
  }

  /** How many students match `term`, ignoring the page and the viewer. */
  async countStudents(term: string, viewerId: string): Promise<number> {
    return prisma.studentProfile.count({
      where: studentFilters(term, viewerId).all,
    });
  }
}
