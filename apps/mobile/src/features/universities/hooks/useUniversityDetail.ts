import { useCallback } from "react";
import type { UniversityDetail } from "@bridgeed/shared";
import { useAsyncValue, type AsyncValueResult } from "@/hooks/useAsyncValue";
import { fetchUniversityDetail } from "../api/universities.api";

/**
 * One university with its counts, programmes and communities.
 *
 * The read is skipped while there is no id, so a screen opened without a
 * university simply has nothing to load rather than an error to explain.
 */
export function useUniversityDetail(
  universityId: string | null,
): AsyncValueResult<UniversityDetail> {
  const load = useCallback(
    (signal: AbortSignal) =>
      universityId
        ? fetchUniversityDetail({ universityId, signal })
        : Promise.reject(new Error("No university selected")),
    [universityId],
  );

  return useAsyncValue(load, universityId !== null);
}
