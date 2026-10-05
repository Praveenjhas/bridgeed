import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type PageWindow,
  type Paginated,
} from "@bridgeed/shared";

/** Clamps a raw page number into the supported range. */
export function normalizePage(page: number | undefined): number {
  return page !== undefined && Number.isInteger(page) && page > 0
    ? page
    : DEFAULT_PAGE;
}

/** Clamps a raw page size into the supported range. */
export function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isInteger(limit) || limit < 1) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(limit, MAX_PAGE_SIZE);
}

export function toPageWindow(page: number, limit: number): PageWindow {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function toPaginated<T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
): Paginated<T> {
  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
