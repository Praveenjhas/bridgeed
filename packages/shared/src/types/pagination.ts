/** Default page number used when a client does not send `page`. */
export const DEFAULT_PAGE = 1;

/** Default page size used when a client does not send `limit`. */
export const DEFAULT_PAGE_SIZE = 20;

/** Hard upper bound for `limit`, so listings cannot be abused as full scans. */
export const MAX_PAGE_SIZE = 100;

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Offset window derived from `page`/`limit` and used for paged queries. */
export interface PageWindow {
  skip: number;
  take: number;
}
