import { useCallback } from "react";
import type { ProgramDetail } from "@bridgeed/shared";
import { useAsyncValue, type AsyncValueResult } from "@/hooks/useAsyncValue";
import { fetchProgramDetail } from "../api/universities.api";

/** One programme with its university and subjects. */
export function useProgramDetail(
  programId: string | null,
): AsyncValueResult<ProgramDetail> {
  const load = useCallback(
    (signal: AbortSignal) =>
      programId
        ? fetchProgramDetail({ programId, signal })
        : Promise.reject(new Error("No program selected")),
    [programId],
  );

  return useAsyncValue(load, programId !== null);
}
