import {
  SEARCH_TYPES,
  type SearchResultCounts,
  type SearchResultGroups,
  type SearchType,
} from "@bridgeed/shared";
import type { IconName } from "@/components";

/**
 * Copy for the search vocabulary.
 *
 * The five categories keep one wording everywhere: a section heading, a filter
 * chip and a count line all read "Programs", so a student never has to work out
 * that "courses" and "programs" are the same group.
 */

export const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
  [SEARCH_TYPES.UNIVERSITY]: "Universities",
  [SEARCH_TYPES.PROGRAM]: "Programs",
  [SEARCH_TYPES.SUBJECT]: "Subjects",
  [SEARCH_TYPES.COMMUNITY]: "Communities",
  [SEARCH_TYPES.STUDENT]: "Students",
};

/** One line explaining what a category holds, used before anything is typed. */
export const SEARCH_TYPE_DESCRIPTIONS: Record<SearchType, string> = {
  [SEARCH_TYPES.UNIVERSITY]:
    "Institutions on BridgeEd, with their programs and students.",
  [SEARCH_TYPES.PROGRAM]: "Courses of study, by name, degree or field.",
  [SEARCH_TYPES.SUBJECT]: "The subjects a program teaches.",
  [SEARCH_TYPES.COMMUNITY]: "Communities, by name or description.",
  [SEARCH_TYPES.STUDENT]: "Students, by name, handle, university or program.",
};

export const SEARCH_TYPE_ICONS: Record<SearchType, IconName> = {
  [SEARCH_TYPES.UNIVERSITY]: "school-outline",
  [SEARCH_TYPES.PROGRAM]: "book-outline",
  [SEARCH_TYPES.SUBJECT]: "library-outline",
  [SEARCH_TYPES.COMMUNITY]: "people-outline",
  [SEARCH_TYPES.STUDENT]: "person-outline",
};

/** The singular of each category, for a count line. */
const SEARCH_TYPE_SINGULARS: Record<SearchType, string> = {
  [SEARCH_TYPES.UNIVERSITY]: "university",
  [SEARCH_TYPES.PROGRAM]: "program",
  [SEARCH_TYPES.SUBJECT]: "subject",
  [SEARCH_TYPES.COMMUNITY]: "community",
  [SEARCH_TYPES.STUDENT]: "student",
};

/** Which group of a response a category fills. */
export const SEARCH_GROUP_BY_TYPE: Record<
  SearchType,
  keyof SearchResultGroups
> = {
  [SEARCH_TYPES.UNIVERSITY]: "universities",
  [SEARCH_TYPES.PROGRAM]: "programs",
  [SEARCH_TYPES.SUBJECT]: "subjects",
  [SEARCH_TYPES.COMMUNITY]: "communities",
  [SEARCH_TYPES.STUDENT]: "students",
};

/** The five categories, in the order the API lists them. */
export const SEARCH_TYPES_IN_ORDER: readonly SearchType[] = [
  SEARCH_TYPES.UNIVERSITY,
  SEARCH_TYPES.PROGRAM,
  SEARCH_TYPES.SUBJECT,
  SEARCH_TYPES.COMMUNITY,
  SEARCH_TYPES.STUDENT,
];

/** `1 university` / `12 universities`. */
export function formatSearchCount(type: SearchType, count: number): string {
  const singular = SEARCH_TYPE_SINGULARS[type];

  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

/** How many matches a category holds, or null when the answer does not say. */
export function searchCountFor(
  counts: SearchResultCounts | null,
  type: SearchType,
): number | null {
  return counts === null ? null : counts[SEARCH_GROUP_BY_TYPE[type]];
}

/**
 * The line above the results: `12 matches for "machine"` — or, for a term that
 * found nothing, `No matches for "machine"`.
 */
export function describeSearchSummary(
  total: number | null,
  term: string,
): string | null {
  if (total === null) {
    return null;
  }

  return total === 1
    ? `1 match for "${term}"`
    : total === 0
      ? `No matches for "${term}"`
      : `${total} matches for "${term}"`;
}

/** `Showing 5 of 12` for a section that the preview had to cut short. */
export function describeSectionOverflow(
  shown: number,
  count: number | null,
): string | null {
  if (count === null || count <= shown) {
    return null;
  }

  return `Showing ${shown} of ${count}`;
}
