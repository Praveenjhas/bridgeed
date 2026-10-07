import type { CommunityAcademicContext } from "./community";

/**
 * Global academic search — the discovery layer over the academic graph.
 *
 *   University -> Program -> Subject -> Community -> Students
 *
 * One term is matched against the human readable fields a student would type, and
 * the answer is grouped by category so the app can render "which universities,
 * which programmes, which subjects, which communities, which people". Every
 * result carries the identity and the one line each list row draws; nothing
 * private (no email, no bio, no session) is ever part of it.
 *
 * Questions, resources, research and events are deliberately absent: they are
 * future phases, and an empty group would be a promise this API does not keep.
 */

/** The categories v1 search covers. `/api/v1/search?type=` takes one of these. */
export const SEARCH_TYPES = {
  UNIVERSITY: "university",
  PROGRAM: "program",
  SUBJECT: "subject",
  COMMUNITY: "community",
  STUDENT: "student",
} as const;

export type SearchType = (typeof SEARCH_TYPES)[keyof typeof SEARCH_TYPES];

/**
 * Every supported `type` value, in the order a grouped response lists them, so a
 * client can iterate the categories without hard coding them again.
 */
export const SEARCH_TYPE_VALUES: readonly SearchType[] = [
  SEARCH_TYPES.UNIVERSITY,
  SEARCH_TYPES.PROGRAM,
  SEARCH_TYPES.SUBJECT,
  SEARCH_TYPES.COMMUNITY,
  SEARCH_TYPES.STUDENT,
];

/**
 * How many results each category returns when no `type` is asked for.
 *
 * A grouped search is a single bounded page rather than a paged listing: it is
 * meant to answer "where does this term live" at a glance, and the category a
 * reader cares about is then read in full with `?type=`.
 */
export const SEARCH_DEFAULT_CATEGORY_LIMIT = 5;

/** One institution, as the search list draws it. */
export interface UniversitySearchResult {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  country: string;
  logoUrl: string | null;
}

/** One programme, carrying the university it belongs to so the row reads alone. */
export interface ProgramSearchResult {
  id: string;
  name: string;
  degree: string | null;
  field: string | null;
  universityId: string;
  universityName: string;
}

/** One subject. `slug` is the canonical identifier the catalog stores. */
export interface SubjectSearchResult {
  id: string;
  name: string;
  slug: string;
}

/** One community, with its academic context resolved to names. */
export interface CommunitySearchResult {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Active members only, counted by the same read that found the community. */
  memberCount: number;
  academicContext: CommunityAcademicContext;
}

/**
 * One student. The identity is the profile's `userId`, which is what every other
 * student endpoint (a profile read, a connection, a membership) addresses.
 */
export interface StudentSearchResult {
  userId: string;
  name: string;
  username: string;
  universityName: string | null;
  programName: string | null;
  graduationYear: number | null;
  profileImageUrl: string | null;
}

/** Any single search result, for code that handles a category generically. */
export type SearchResult =
  | UniversitySearchResult
  | ProgramSearchResult
  | SubjectSearchResult
  | CommunitySearchResult
  | StudentSearchResult;

/**
 * Results grouped by category.
 *
 * Every group is always present. A typed search fills exactly one of them, and
 * the other four stay empty, so a client can render a category section without
 * first checking whether the key exists.
 */
export interface SearchResultGroups {
  universities: UniversitySearchResult[];
  programs: ProgramSearchResult[];
  subjects: SubjectSearchResult[];
  communities: CommunitySearchResult[];
  students: StudentSearchResult[];
}

/**
 * How many matches each category holds.
 *
 * A typed search counts only the category it searched, and reports zero for the
 * rest: those were never looked at, and zero is the honest answer for "how many
 * did this request find".
 */
export interface SearchResultCounts {
  universities: number;
  programs: number;
  subjects: number;
  communities: number;
  students: number;
}

/**
 * The page of results this response is.
 *
 * A typed search pages inside its one category, exactly like the directory
 * listings. A grouped search is always page one: `limit` is then the per
 * category cap and `totalPages` is 1, because one grouped read is one page.
 */
export interface SearchPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** The answer to `GET /api/v1/search`. */
export interface SearchResponse {
  /** The term as it was searched: trimmed, with its case preserved. */
  query: string;
  /** The category that was searched, or null when every category was. */
  type: SearchType | null;
  results: SearchResultGroups;
  counts: SearchResultCounts;
  pagination: SearchPagination;
}
