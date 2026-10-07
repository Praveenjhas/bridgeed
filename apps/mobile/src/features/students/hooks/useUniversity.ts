import { useEffect, useState } from "react";
import type { University } from "@bridgeed/shared";
import { fetchUniversity } from "../api/students.api";

/**
 * Universities read during this app run, keyed by id.
 *
 * A university is shared by many students and never changes while the app is
 * open, so it is read once and reused. Without this, every row of a connection
 * list would ask for the same university again.
 */
const universityCache = new Map<string, University>();

/**
 * Resolves one university id into a university.
 *
 * Universities are supplementary on every screen that shows them, so a read that
 * fails or is still in flight simply answers null and the caller omits the line.
 * That keeps a decorative field from turning into a screen level error, and it is
 * also why this hook takes no `enabled` flag: a null id already means "nothing to
 * read".
 */
export function useUniversity(universityId: string | null): University | null {
  const [university, setUniversity] = useState<University | null>(() =>
    universityId ? (universityCache.get(universityId) ?? null) : null,
  );

  useEffect(() => {
    if (!universityId) {
      setUniversity(null);
      return;
    }

    const cached = universityCache.get(universityId);

    if (cached) {
      setUniversity(cached);
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    fetchUniversity({ universityId, signal: controller.signal })
      .then((value) => {
        universityCache.set(universityId, value);

        if (isActive) {
          setUniversity(value);
        }
      })
      .catch(() => {
        if (isActive) {
          setUniversity(null);
        }
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [universityId]);

  return university;
}
