/**
 * Page size for the student directory.
 *
 * It matches the community directory's page so the two discover lists behave
 * alike. The value is a mobile-side choice only: the API clamps whatever it is
 * sent to its own maximum.
 */
export const STUDENT_DIRECTORY_PAGE_LIMIT = 20;

/**
 * How many universities a picker reads at once.
 *
 * The university endpoint is paged, but a picker needs the whole vocabulary in
 * one drop rather than a page at a time, and the catalog is small (a curated
 * seed set), so a single large page is read and unwrapped. The API still caps it
 * at its own maximum.
 */
export const UNIVERSITY_PICKER_LIMIT = 100;
