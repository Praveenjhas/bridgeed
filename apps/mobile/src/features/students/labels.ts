import type { StudentProfile } from "@bridgeed/shared";

/**
 * Copy derived from a student profile.
 *
 * A profile only ever holds optional course fields, and a screen should never
 * invent a value for one that is missing, so every helper here answers null
 * rather than a placeholder when there is nothing real to show.
 */

/** `B.Tech · Computer Science`, or null when no course is recorded. */
export function formatCourse(profile: StudentProfile): string | null {
  const parts = [profile.degree, profile.branch].filter(
    (part): part is string =>
      typeof part === "string" && part.trim().length > 0,
  );

  return parts.length > 0 ? parts.join(" · ") : null;
}

/** `Class of 2026`, or null when the graduation year is not recorded. */
export function formatGraduationYear(year: number | null): string | null {
  return year === null ? null : `Class of ${year}`;
}

/**
 * One line that identifies a student inside a list row: their course when it is
 * known, otherwise their location. Null means the profile has neither.
 */
export function formatStudentHint(profile: StudentProfile): string | null {
  return formatCourse(profile) ?? profile.location ?? null;
}
