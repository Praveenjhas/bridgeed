import { useCallback } from "react";
import type { Skill } from "@bridgeed/shared";
import { useAsyncValue, type LoadStatus } from "@/hooks/useAsyncValue";
import { fetchStudentSkills } from "../api/students.api";

export interface StudentSkillsState {
  skills: Skill[];
  status: LoadStatus;
  errorMessage: string | null;
  isRefreshing: boolean;
  refresh: () => void;
}

/**
 * The skills of one student.
 *
 * Skills are a profile attribute rather than something the profile endpoint
 * returns, which is why they are read separately and why their failure is
 * reported on their own section instead of hiding the profile.
 */
export function useStudentSkills(
  userId: string | null,
  enabled: boolean = true,
): StudentSkillsState {
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!userId) {
        throw new Error("A student is required to read skills.");
      }

      return fetchStudentSkills({ userId, signal });
    },
    [userId],
  );

  const { data, status, errorMessage, isRefreshing, refresh } = useAsyncValue(
    load,
    enabled && Boolean(userId),
  );

  return { skills: data ?? [], status, errorMessage, isRefreshing, refresh };
}
