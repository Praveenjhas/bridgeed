import { useCallback } from "react";
import type { Interest, Skill, University } from "@bridgeed/shared";
import { useAsyncValue, type LoadStatus } from "@/hooks/useAsyncValue";
import {
  fetchInterests,
  fetchSkills,
  fetchUniversities,
} from "../api/students.api";

/** One reference list, with the state a picker needs to render honestly. */
export interface CatalogState<T> {
  items: T[];
  status: LoadStatus;
  errorMessage: string | null;
  isRefreshing: boolean;
  refresh: () => void;
}

/**
 * Loads one of the reference lists a profile picks from.
 *
 * Universities, skills and interests are read the same way, so they are loaded
 * by one hook over one loader rather than three near-identical ones. Each list
 * fails on its own: a picker whose catalog is unavailable shows an error and a
 * retry, because an empty list would read as "there is nothing to choose".
 */
export function useCatalog<T>(
  load: (params: { signal: AbortSignal }) => Promise<T[]>,
  enabled: boolean = true,
): CatalogState<T> {
  const loadItems = useCallback(
    async (signal: AbortSignal) => load({ signal }),
    [load],
  );

  const { data, status, errorMessage, isRefreshing, refresh } = useAsyncValue(
    loadItems,
    enabled,
  );

  return { items: data ?? [], status, errorMessage, isRefreshing, refresh };
}

/** Every university, for the field that names the one a student attends. */
export function useUniversities(
  enabled: boolean = true,
): CatalogState<University> {
  return useCatalog(fetchUniversities, enabled);
}

/** Every skill a profile can be tagged with. */
export function useSkills(enabled: boolean = true): CatalogState<Skill> {
  return useCatalog(fetchSkills, enabled);
}

/** Every interest a profile can be tagged with. */
export function useInterests(enabled: boolean = true): CatalogState<Interest> {
  return useCatalog(fetchInterests, enabled);
}
