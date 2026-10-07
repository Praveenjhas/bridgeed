import type { StudentProfileDetails } from "@bridgeed/shared";
import {
  BIO_MAX_LENGTH,
  BRANCH_MAX_LENGTH,
  DEGREE_MAX_LENGTH,
  GRADUATION_YEAR_MAX,
  GRADUATION_YEAR_MIN,
  LOCATION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
} from "@/features/onboarding";
import type { UpdateMyStudentProfileInput } from "@/features/students";

/**
 * What the editor holds while it is open.
 *
 * Every text field is a string, including the graduation year, so a half-typed
 * "20" is never silently turned into a number. `universityId` and the tag ids
 * are ids, because those are what the API stores; their labels are looked up
 * from the catalogs the pickers already load.
 */
export interface ProfileDraft {
  name: string;
  bio: string;
  degree: string;
  branch: string;
  graduationYear: string;
  location: string;
  universityId: string | null;
  skillIds: string[];
  interestIds: string[];
}

/** Messages for the fields the form can reject, absent when the field is fine. */
export interface ProfileFormIssues {
  name?: string;
  bio?: string;
  degree?: string;
  branch?: string;
  graduationYear?: string;
  location?: string;
}

/** The fields the form can complain about, so an edit clears the right one. */
export const ISSUE_FIELDS = [
  "name",
  "bio",
  "degree",
  "branch",
  "graduationYear",
  "location",
] as const satisfies readonly (keyof ProfileFormIssues)[];

/** Turns a loaded profile into the editor's starting draft. */
export function draftFromProfile(profile: StudentProfileDetails): ProfileDraft {
  return {
    name: profile.name,
    bio: profile.bio ?? "",
    degree: profile.degree ?? "",
    branch: profile.branch ?? "",
    graduationYear:
      profile.graduationYear === null ? "" : String(profile.graduationYear),
    location: profile.location ?? "",
    universityId: profile.universityId,
    skillIds: profile.skills.map((skill) => skill.id),
    interestIds: profile.interests.map((interest) => interest.id),
  };
}

/** Trimmed text, or null when the field was left empty. */
export function optionalText(value: string): string | null {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

/** `null` covers both "left blank" and "not a four-digit year". */
export function readGraduationYear(value: string): number | null {
  const trimmed = value.trim();

  return /^\d{4}$/.test(trimmed) ? Number.parseInt(trimmed, 10) : null;
}

/**
 * Checks the draft against the same limits the API enforces.
 *
 * The rules mirror onboarding's because it is the same profile: the difference
 * is only that this screen edits one document instead of walking a flow.
 */
export function validateProfileDraft(draft: ProfileDraft): ProfileFormIssues {
  const issues: ProfileFormIssues = {};
  const name = draft.name.trim();

  if (name.length < NAME_MIN_LENGTH) {
    issues.name = `Enter your name (at least ${NAME_MIN_LENGTH} characters).`;
  } else if (name.length > NAME_MAX_LENGTH) {
    issues.name = `Keep your name under ${NAME_MAX_LENGTH} characters.`;
  }

  if (draft.bio.trim().length > BIO_MAX_LENGTH) {
    issues.bio = `Keep your bio under ${BIO_MAX_LENGTH} characters.`;
  }

  if (draft.degree.trim().length > DEGREE_MAX_LENGTH) {
    issues.degree = `Keep this under ${DEGREE_MAX_LENGTH} characters.`;
  }

  if (draft.branch.trim().length > BRANCH_MAX_LENGTH) {
    issues.branch = `Keep this under ${BRANCH_MAX_LENGTH} characters.`;
  }

  if (draft.location.trim().length > LOCATION_MAX_LENGTH) {
    issues.location = `Keep this under ${LOCATION_MAX_LENGTH} characters.`;
  }

  const year = draft.graduationYear.trim();

  if (year.length > 0) {
    const parsed = readGraduationYear(year);

    if (parsed === null) {
      issues.graduationYear = "Enter the year as four digits, for example 2026.";
    } else if (parsed < GRADUATION_YEAR_MIN || parsed > GRADUATION_YEAR_MAX) {
      issues.graduationYear = `Enter a year between ${GRADUATION_YEAR_MIN} and ${GRADUATION_YEAR_MAX}.`;
    }
  }

  return issues;
}

/** Turns the draft into the body of `PATCH /student-profiles/me`. */
export function toProfileUpdateInput(
  draft: ProfileDraft,
): UpdateMyStudentProfileInput {
  return {
    name: draft.name.trim(),
    bio: optionalText(draft.bio),
    universityId: draft.universityId,
    degree: optionalText(draft.degree),
    branch: optionalText(draft.branch),
    graduationYear: readGraduationYear(draft.graduationYear),
    location: optionalText(draft.location),
  };
}
