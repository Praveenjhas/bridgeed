/**
 * Search tuning.
 *
 * The two page sizes match `UNIVERSITIES_PAGE_LIMIT`, and the API clamps whatever
 * it is sent to its own maximum, so the numbers are a mobile-side choice rather
 * than a contract.
 */

/** Results per page inside one category. */
export const SEARCH_PAGE_LIMIT = 20;

/**
 * How many rows of each category a grouped search shows.
 *
 * It matches `SEARCH_DEFAULT_CATEGORY_LIMIT` on the API, so the preview is asked
 * for rather than assumed: the screen shows the same five rows per section that
 * the API sends by default, and says how many more the category holds.
 */
export const SEARCH_PREVIEW_LIMIT = 5;

/**
 * How long typing has to pause before a search is sent.
 *
 * Long enough that a typed word is one request rather than one per letter, short
 * enough that the answer feels like it followed the last keystroke.
 */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * The shortest term the API is asked about.
 *
 * One character matches most of the catalog, so a single letter is answered with
 * a prompt instead of a request that would either be useless or expensive.
 */
export const MIN_SEARCH_TERM_LENGTH = 2;
