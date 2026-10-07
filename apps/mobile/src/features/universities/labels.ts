import type { Program, University } from "@bridgeed/shared";

/**
 * Copy derived from the academic entities.
 *
 * Every helper answers null rather than a placeholder when there is nothing real
 * to show, so a screen never invents a location or a degree that the record does
 * not carry.
 */

/** `Bengaluru, Karnataka, India`, or null when the record has no place on it. */
export function formatUniversityLocation(
  university: Pick<University, "city" | "state" | "country">,
): string | null {
  const parts = [university.city, university.state, university.country].filter(
    (part): part is string => typeof part === "string" && part.trim().length > 0,
  );

  return parts.length > 0 ? parts.join(", ") : null;
}

/** `B.Tech · Mechanical Engineering`, or null when neither is recorded. */
export function formatProgramAcademic(
  program: Pick<Program, "degree" | "field">,
): string | null {
  const parts = [program.degree, program.field].filter(
    (part): part is string => typeof part === "string" && part.trim().length > 0,
  );

  return parts.length > 0 ? parts.join(" · ") : null;
}

/** `1 program` / `12 programs`. */
export function formatProgramCount(count: number): string {
  return `${count} ${count === 1 ? "program" : "programs"}`;
}

/** `1 student` / `12 students`. */
export function formatStudentCount(count: number): string {
  return `${count} ${count === 1 ? "student" : "students"}`;
}

/** `1 subject` / `12 subjects`. */
export function formatSubjectCount(count: number): string {
  return `${count} ${count === 1 ? "subject" : "subjects"}`;
}

/** `1 community` / `12 communities`. */
export function formatCommunityCount(count: number): string {
  return `${count} ${count === 1 ? "community" : "communities"}`;
}

/** Joins the parts of a quiet metadata line, dropping the empty ones. */
export function joinMeta(parts: (string | null)[]): string | null {
  const present = parts.filter((part): part is string => part !== null);

  return present.length > 0 ? present.join(" · ") : null;
}
