import { useCallback } from "react";
import type { Program } from "@bridgeed/shared";
import { useAsyncValue, type AsyncValueResult } from "@/hooks/useAsyncValue";
import { fetchUniversityPrograms } from "../api/universities.api";

/**
 * Every programme a university offers.
 *
 * It is driven by a selected university id, so the profile editor can load the
 * programme list for whichever university was just chosen, and reload it when the
 * choice changes. A null id means there is nothing to read, which is why the read
 * is disabled rather than rejected.
 */
export function useUniversityPrograms(
  universityId: string | null,
): AsyncValueResult<Program[]> {
  const load = useCallback(
    (signal: AbortSignal) =>
      universityId
        ? fetchUniversityPrograms({ universityId, signal })
        : Promise.resolve([] as Program[]),
    [universityId],
  );

  return useAsyncValue(load, universityId !== null);
}
