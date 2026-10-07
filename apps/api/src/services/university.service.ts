import type {
  Paginated,
  University,
  UniversityDetail,
  UniversitySummary,
} from "@bridgeed/shared";
import {
  UniversityRepository,
  type CreateUniversityRecord,
} from "../repositories/university.repository";
import {
  normalizeLimit,
  normalizePage,
  toPageWindow,
  toPaginated,
} from "../utils/pagination";

export interface CreateUniversityInput {
  name: string;
  country: string;
  state?: string | null;
  city?: string | null;
  websiteUrl?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  verified?: boolean;
}

/** The page window and optional name search a directory read asks for. */
export interface ListUniversitiesQuery {
  page?: number;
  limit?: number;
  search?: string;
}

/** Raised when a university id or slug names nothing. */
export const UNIVERSITY_NOT_FOUND_MESSAGE = "University not found";

export class UniversityService {
  constructor(private readonly universityRepository: UniversityRepository) {}

  async createUniversity(input: CreateUniversityInput): Promise<University> {
    const existingUniversity = await this.universityRepository.findByName(
      input.name,
    );

    if (existingUniversity) {
      throw new Error("A university with this name already exists");
    }

    const record: CreateUniversityRecord = {
      id: crypto.randomUUID(),
      name: input.name,
      country: input.country,
      state: input.state ?? null,
      city: input.city ?? null,
      websiteUrl: input.websiteUrl ?? null,
      description: input.description ?? null,
      logoUrl: input.logoUrl ?? null,
      verified: input.verified ?? false,
    };

    return this.universityRepository.create(record);
  }

  /**
   * One page of the university directory.
   *
   * It is a plain alphabetical list with an optional name search: no ranking and
   * no index. Search matches the name only, case-insensitively, because that is
   * the one field a reader has in mind when they look a university up.
   */
  async listUniversities(
    query: ListUniversitiesQuery,
  ): Promise<Paginated<UniversitySummary>> {
    const page = normalizePage(query.page);
    const limit = normalizeLimit(query.limit);
    const window = toPageWindow(page, limit);

    const [items, total] = await Promise.all([
      this.universityRepository.findSummaries(window, query.search),
      this.universityRepository.countUniversities(query.search),
    ]);

    return toPaginated(items, page, limit, total);
  }

  async getUniversityDetail(id: string): Promise<UniversityDetail | null> {
    return this.universityRepository.findDetailById(id);
  }

  async getUniversityDetailBySlug(
    slug: string,
  ): Promise<UniversityDetail | null> {
    return this.universityRepository.findDetailBySlug(slug);
  }

  /** The plain record, used where only identity is needed (profile validation). */
  async getUniversityById(id: string): Promise<University | null> {
    return this.universityRepository.findById(id);
  }
}

