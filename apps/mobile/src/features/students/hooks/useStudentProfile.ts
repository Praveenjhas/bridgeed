import { useCallback } from "react";
import type { StudentProfile } from "@bridgeed/shared";
import { useAsyncValue, type LoadStatus } from "@/hooks/useAsyncValue";
import { fetchStudentProfile } from "../api/students.api";

export interface StudentProfileState {
  profile: StudentProfile | null;
  status: LoadStatus;
  errorMessage: string | null;
  isRefreshing: boolean;
  refresh: () => void;
}

/**
 * Loads one student profile.
 *
 * The id comes from the route, so `enabled` keeps the hook quiet until there is
 * one. The API's own message is kept: a student that does not exist answers
 * "Student profile not found", which is what a reader should see on a profile
 * they reached from a stale link.
 */
export function useStudentProfile(
  userId: string | null,
  enabled: boolean = true,
): StudentProfileState {
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!userId) {
        throw new Error("A student is required to read a profile.");
      }

      return fetchStudentProfile({ userId, signal });
    },
    [userId],
  );

  const { data, status, errorMessage, isRefreshing, refresh } = useAsyncValue(
    load,
    enabled && Boolean(userId),
  );

  return { profile: data, status, errorMessage, isRefreshing, refresh };
}
