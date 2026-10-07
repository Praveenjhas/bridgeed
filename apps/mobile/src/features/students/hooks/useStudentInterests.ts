import { useCallback } from "react";
import type { Interest } from "@bridgeed/shared";
import { useAsyncValue, type LoadStatus } from "@/hooks/useAsyncValue";
import { fetchStudentInterests } from "../api/students.api";

export interface StudentInterestsState {
  interests: Interest[];
  status: LoadStatus;
  errorMessage: string | null;
  isRefreshing: boolean;
  refresh: () => void;
}

/**
 * The interests of one student.
 *
 * Interests are what a student says they care about, which is the other half of
 * what makes a profile worth reading, so they get their own read and their own
 * section rather than being folded into the skills list.
 */
export function useStudentInterests(
  userId: string | null,
  enabled: boolean = true,
): StudentInterestsState {
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!userId) {
        throw new Error("A student is required to read interests.");
      }

      return fetchStudentInterests({ userId, signal });
    },
    [userId],
  );

  const { data, status, errorMessage, isRefreshing, refresh } = useAsyncValue(
    load,
    enabled && Boolean(userId),
  );

  return {
    interests: data ?? [],
    status,
    errorMessage,
    isRefreshing,
    refresh,
  };
}
