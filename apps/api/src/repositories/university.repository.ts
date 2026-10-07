import { randomUUID } from "node:crypto";
import type { University } from "@bridgeed/shared/src/types/university";
import { prisma } from "../config/prisma";

/** Longest slug the repository will generate, so a long name cannot bloat it. */
const MAXIMUM_SLUG_LENGTH = 80;

/** How many `-2`, `-3`, … suffixes to try before falling back to a random one. */
const MAXIMUM_SLUG_ATTEMPTS = 20;

/**
 * Maps a stored university row onto the shared `University` shape.
 *
 * It is exported so any repository that reads a university as part of a larger
 * document (a student profile, for instance) can hand back the same shape
 * without copying the field list.
 */
export function toUniversity(university: {
  id: string;
  name: string;
  country: string;
  state: string | null;
  city: string | null;
  websiteUrl: string | null;
  verified: boolean;
  createdAt: Date;
}): University {
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

  async create(university: University): Promise<University> {
    const slug = await this.allocateSlug(university.name);

    const createdUniversity = await prisma.university.create({
      data: {
        id: university.id,
        name: university.name,
        slug,
        country: university.country,
        state: university.state,
        city: university.city,
        websiteUrl: university.websiteUrl,
        verified: university.verified,
        verifiedAt: university.verified ? new Date() : null,
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
