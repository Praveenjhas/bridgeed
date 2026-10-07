import {
  DEFAULT_PAGE,
  SEARCH_DEFAULT_CATEGORY_LIMIT,
  SEARCH_TYPES,
  type PageWindow,
  type SearchResponse,
  type SearchResultCounts,
  type SearchResultGroups,
  type SearchType,
} from "@bridgeed/shared";
import type { SearchRepository } from "../repositories/search.repository";
import {
  normalizeLimit,
  normalizePage,
  toPageWindow,
} from "../utils/pagination";

/** One category's contribution to an answer: its page of rows and its total. */
interface CategoryResult<Row> {
  rows: Row[];
  total: number;
}

export interface SearchInput {
  /** The term to search for, already trimmed and known to be non-empty. */
  term: string;
  /** One category to search, or null to search every category. */
  type: SearchType | null;
  page?: number;
  limit?: number;
  /** The authenticated student, left out of the student category. */
  viewerId: string;
}

/** Which group of a response a category fills. */
const GROUP_BY_TYPE: Record<SearchType, keyof SearchResultGroups> = {
  [SEARCH_TYPES.UNIVERSITY]: "universities",
  [SEARCH_TYPES.PROGRAM]: "programs",
  [SEARCH_TYPES.SUBJECT]: "subjects",
  [SEARCH_TYPES.COMMUNITY]: "communities",
  [SEARCH_TYPES.STUDENT]: "students",
};

function emptyGroups(): SearchResultGroups {
  return {
    universities: [],
    programs: [],
    subjects: [],
    communities: [],
    students: [],
  };
}

function emptyCounts(): SearchResultCounts {
  return {
    universities: 0,
    programs: 0,
    subjects: 0,
    communities: 0,
    students: 0,
  };
}

/**
 * The per category cap of a grouped search.
 *
 * It defaults to five rather than to the listing page size, because a grouped
 * answer is a preview of every category: five rows are enough to see where a term
 * lives, and the category a student cares about is then opened in full with
 * `?type=`. An explicit `limit` is still honoured, clamped to `MAX_PAGE_SIZE` like
 * every other listing, so one request can never scan a whole catalog.
 */
function normalizeCategoryLimit(limit: number | undefined): number {
  return limit === undefined
    ? SEARCH_DEFAULT_CATEGORY_LIMIT
    : normalizeLimit(limit);
}

/**
 * Global search over the academic graph.
 *
 * Two shapes, one answer. Without `type` every category is searched with the same
 * term and the top few of each are returned together: that is the "where does this
 * term live" read the search screen makes as a student types. With `type` one
 * category is paged exactly like a directory listing, so a student can walk past
 * the preview without a second endpoint.
 *
 * The counts are produced by the same request as the rows: a category is counted
 * with one `COUNT` and read with one bounded read, so the "12 matches" a screen
 * shows is never stale and never costs a round trip of its own.
 */
export class SearchService {
  constructor(private readonly searchRepository: SearchRepository) {}

  async search(input: SearchInput): Promise<SearchResponse> {
    const { type } = input;

    return type === null
      ? this.searchEveryCategory(input)
      : this.searchOneCategory({ ...input, type });
  }

  /** Every category, capped, in one answer. */
  private async searchEveryCategory({
    term,
    limit,
    viewerId,
  }: SearchInput): Promise<SearchResponse> {
    const categoryLimit = normalizeCategoryLimit(limit);
    const window: PageWindow = { skip: 0, take: categoryLimit };

    const [universities, programs, subjects, communities, students] =
      await Promise.all([
        this.read(
          (w) => this.searchRepository.findUniversities(term, w),
          () => this.searchRepository.countUniversities(term),
          window,
        ),
        this.read(
          (w) => this.searchRepository.findPrograms(term, w),
          () => this.searchRepository.countPrograms(term),
          window,
        ),
        this.read(
          (w) => this.searchRepository.findSubjects(term, w),
          () => this.searchRepository.countSubjects(term),
          window,
        ),
        this.read(
          (w) => this.searchRepository.findCommunities(term, w),
          () => this.searchRepository.countCommunities(term),
          window,
        ),
        this.read(
          (w) => this.searchRepository.findStudents(term, viewerId, w),
          () => this.searchRepository.countStudents(term, viewerId),
          window,
        ),
      ]);

    const counts: SearchResultCounts = {
      universities: universities.total,
      programs: programs.total,
      subjects: subjects.total,
      communities: communities.total,
      students: students.total,
    };

    return {
      query: term,
      type: null,
      results: {
        universities: universities.rows,
        programs: programs.rows,
        subjects: subjects.rows,
        communities: communities.rows,
        students: students.rows,
      },
      counts,
      // A grouped search is one page: there is no page two of "everything at
      // once", and a category that overflows the cap is read with `?type=`.
      pagination: {
        page: DEFAULT_PAGE,
        limit: categoryLimit,
        total:
          counts.universities +
          counts.programs +
          counts.subjects +
          counts.communities +
          counts.students,
        totalPages: 1,
      },
    };
  }

  /** One category, paged like a directory listing. */
  private async searchOneCategory(
    input: SearchInput & { type: SearchType },
  ): Promise<SearchResponse> {
    const { term, type, viewerId } = input;
    const page = normalizePage(input.page);
    const limit = normalizeLimit(input.limit);
    const window = toPageWindow(page, limit);
    const results = emptyGroups();

    switch (type) {
      case SEARCH_TYPES.UNIVERSITY: {
        const { rows, total } = await this.read(
          (w) => this.searchRepository.findUniversities(term, w),
          () => this.searchRepository.countUniversities(term),
          window,
        );

        results.universities = rows;

        return this.categoryResponse({
          term,
          type,
          results,
          total,
          page,
          limit,
        });
      }

      case SEARCH_TYPES.PROGRAM: {
        const { rows, total } = await this.read(
          (w) => this.searchRepository.findPrograms(term, w),
          () => this.searchRepository.countPrograms(term),
          window,
        );

        results.programs = rows;

        return this.categoryResponse({
          term,
          type,
          results,
          total,
          page,
          limit,
        });
      }

      case SEARCH_TYPES.SUBJECT: {
        const { rows, total } = await this.read(
          (w) => this.searchRepository.findSubjects(term, w),
          () => this.searchRepository.countSubjects(term),
          window,
        );

        results.subjects = rows;

        return this.categoryResponse({
          term,
          type,
          results,
          total,
          page,
          limit,
        });
      }

      case SEARCH_TYPES.COMMUNITY: {
        const { rows, total } = await this.read(
          (w) => this.searchRepository.findCommunities(term, w),
          () => this.searchRepository.countCommunities(term),
          window,
        );

        results.communities = rows;

        return this.categoryResponse({
          term,
          type,
          results,
          total,
          page,
          limit,
        });
      }

      case SEARCH_TYPES.STUDENT: {
        const { rows, total } = await this.read(
          (w) => this.searchRepository.findStudents(term, viewerId, w),
          () => this.searchRepository.countStudents(term, viewerId),
          window,
        );

        results.students = rows;

        return this.categoryResponse({
          term,
          type,
          results,
          total,
          page,
          limit,
        });
      }
    }
  }

  /** A typed answer: one group of rows, one count, one page. */
  private categoryResponse({
    term,
    type,
    results,
    total,
    page,
    limit,
  }: {
    term: string;
    type: SearchType;
    results: SearchResultGroups;
    total: number;
    page: number;
    limit: number;
  }): SearchResponse {
    const counts = emptyCounts();

    counts[GROUP_BY_TYPE[type]] = total;

    return {
      query: term,
      type,
      results,
      counts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * One category's page and its total, read together.
   *
   * Both statements are issued in parallel and both are bounded: the rows by the
   * page window, the count by the category's match filter. Neither is allowed to
   * grow with the size of the table.
   */
  private async read<Row>(
    find: (window: PageWindow) => Promise<Row[]>,
    count: () => Promise<number>,
    window: PageWindow,
  ): Promise<CategoryResult<Row>> {
    const [rows, total] = await Promise.all([find(window), count()]);

    return { rows, total };
  }
}
