import { useCallback, useMemo } from "react";
import type { StudentProfile } from "@bridgeed/shared";
import { useAsyncValue, type LoadStatus } from "@/hooks/useAsyncValue";
import { fetchStudentProfile } from "../api/students.api";

export interface StudentProfilesState {
  /** Profile per requested id. A null value means that profile could not be read. */
  profiles: ReadonlyMap<string, StudentProfile | null>;
  status: LoadStatus;
  errorMessage: string | null;
  isRefreshing: boolean;
  refresh: () => void;
}

/** Shared empty map, so callers never compare against a fresh object. */
const EMPTY_PROFILES: ReadonlyMap<string, StudentProfile | null> = new Map();

/** Deduplicates ids, drops blanks and sorts, so the read key is stable. */
function normalizeIds(userIds: readonly string[]): string[] {
  return Array.from(new Set(userIds.filter((id) => id.length > 0))).sort();
}

/**
 * Loads a set of student profiles in one pass.
 *
 * A connection row only holds user ids, so a list of connection cards needs the
 * people behind them before it can show a name. The ids are read as a single
 * stable key, which keeps the request from restarting on every render and lets
 * the screen refresh the list and its people together.
 *
 * A profile that fails to read resolves to null for its own id instead of
 * failing the batch: one deleted student must not blank out the whole list, and
 * the row that owns that id is the right place to say so.
 */
export function useStudentProfiles(
  userIds: readonly string[],
  enabled: boolean = true,
): StudentProfilesState {
  const idsKey = useMemo(() => normalizeIds(userIds).join("\n"), [userIds]);

  const load = useCallback(
    async (signal: AbortSignal) => {
      const ids = idsKey.length === 0 ? [] : idsKey.split("\n");
      const entries = await Promise.all(
        ids.map(async (id): Promise<[string, StudentProfile | null]> => {
          try {
            return [id, await fetchStudentProfile({ userId: id, signal })];
          } catch {
            // Aborts and 404s both land here; the caller renders the row either
            // way, so there is nothing useful to rethrow.
            return [id, null];
          }
        }),
      );

      return new Map(entries);
    },
    [idsKey],
  );

  const { data, status, errorMessage, isRefreshing, refresh } = useAsyncValue(
    load,
    enabled,
  );

  return {
    profiles: data ?? EMPTY_PROFILES,
    status,
    errorMessage,
    isRefreshing,
    refresh,
  };
}
