import type { CreateMyStudentProfileInput } from "@/features/students";
import type { OnboardingStepId } from "./steps";

/**
 * Length limits enforced here.
 *
 * The API stores these as plain strings and numbers, so nothing below is a copy
 * of a server rule: they are the limits the form can explain to the student
 * before the request is sent, which is cheaper than a round trip answering with
 * a database truncation.
 */
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const BIO_MAX_LENGTH = 240;
export const DEGREE_MAX_LENGTH = 60;
export const BRANCH_MAX_LENGTH = 60;
export const LOCATION_MAX_LENGTH = 60;
export const GRADUATION_YEAR_MIN = 1950;
export const GRADUATION_YEAR_MAX = 2100;

/**
 * Characters a handle may use.
 *
 * A handle is an identifier rather than a display name — it is what appears after
 * an `@` — so it stays to letters, digits, dots, underscores and hyphens.
 * Anything else is either invisible (a space) or needs escaping wherever it is
 * shown.
 */
export const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * What onboarding collects, held as the student types.
 *
 * Every field is a string, including the graduation year: a form field is text
 * until it is validated, and keeping it that way means a half typed "20" is never
 * silently turned into a number. The tags are ids, because that is what the API
 * attaches; their labels are looked up from the same catalogs the pickers use.
 */
export interface OnboardingDraft {
  name: string;
  username: string;
  bio: string;
  universityId: string | null;
  degree: string;
  branch: string;
  graduationYear: string;
  location: string;
  skillIds: string[];
  interestIds: string[];
}

export function createEmptyDraft(): OnboardingDraft {
  return {
    name: "",
    username: "",
    bio: "",
    universityId: null,
    degree: "",
    branch: "",
    graduationYear: "",
    location: "",
    skillIds: [],
    interestIds: [],
  };
}

/** Messages for the fields a step can reject, absent when the field is fine. */
export interface DraftIssues {
  name?: string;
  username?: string;
  bio?: string;
  degree?: string;
  branch?: string;
  graduationYear?: string;
  location?: string;
}

/**
 * The fields a step can complain about, in the order the flow shows them.
 *
 * The screen uses this to clear exactly the messages an edit has answered: a
 * complaint about the handle should disappear when the handle is retyped and
 * stay put when the name is, which cannot be worked out from the draft alone.
 */
export const DRAFT_ISSUE_FIELDS = [
  "name",
  "username",
  "bio",
  "degree",
  "branch",
  "graduationYear",
  "location",
] as const satisfies readonly (keyof DraftIssues)[];

/**
 * Checks the fields of one step.
 *
 * Only the fields the step shows are checked, so pressing Continue on the
 * university step never complains about a course that has not been typed yet.
 * The steps with nothing to validate — the university and the tag picks, which
 * are optional and cannot be mistyped — return no issues at all.
 */
export function validateStep(
  step: OnboardingStepId,
  draft: OnboardingDraft,
): DraftIssues {
  const issues: DraftIssues = {};

  if (step === "basics") {
    const name = draft.name.trim();

    if (name.length < NAME_MIN_LENGTH) {
      issues.name = `Enter your name (at least ${NAME_MIN_LENGTH} characters).`;
    } else if (name.length > NAME_MAX_LENGTH) {
      issues.name = `Keep your name under ${NAME_MAX_LENGTH} characters.`;
    }

    const username = draft.username.trim();

    if (username.length < USERNAME_MIN_LENGTH) {
      issues.username = `Your handle needs at least ${USERNAME_MIN_LENGTH} characters.`;
    } else if (username.length > USERNAME_MAX_LENGTH) {
      issues.username = `Keep your handle under ${USERNAME_MAX_LENGTH} characters.`;
    } else if (!USERNAME_PATTERN.test(username)) {
      issues.username =
        "Use letters, numbers, dots, underscores or hyphens only.";
    }

    if (draft.bio.trim().length > BIO_MAX_LENGTH) {
      issues.bio = `Keep your bio under ${BIO_MAX_LENGTH} characters.`;
    }
  }

  if (step === "education") {
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
    const parsed = readGraduationYear(year);

    if (year.length > 0 && parsed === null) {
      issues.graduationYear =
        "Enter the year as four digits, for example 2026.";
    } else if (
      parsed !== null &&
      (parsed < GRADUATION_YEAR_MIN || parsed > GRADUATION_YEAR_MAX)
    ) {
      issues.graduationYear = `Enter a year between ${GRADUATION_YEAR_MIN} and ${GRADUATION_YEAR_MAX}.`;
    }
  }

  return issues;
}

/** True when a step has nothing left to complain about. */
export function isStepComplete(
  step: OnboardingStepId,
  draft: OnboardingDraft,
): boolean {
  return Object.keys(validateStep(step, draft)).length === 0;
}

/**
 * Reads the graduation year out of a text field.
 *
 * `null` covers both "left blank" and "not a year". The two are only the same
 * thing on a submit that is already known to be valid, and `validateStep` is what
 * tells them apart while the student is still typing.
 */
export function readGraduationYear(value: string): number | null {
  const trimmed = value.trim();

  if (!/^\d{4}$/.test(trimmed)) {
    return null;
  }

  return Number.parseInt(trimmed, 10);
}

/** Trimmed text, or null when the student left the field empty. */
export function optionalText(value: string): string | null {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Turns the draft into the body of `POST /student-profiles/me`.
 *
 * The owner is deliberately absent from it: the API takes the owner from the
 * bearer token, so nothing typed here can name somebody else's account.
 */
export function toCreateProfileInput(
  draft: OnboardingDraft,
): CreateMyStudentProfileInput {
  return {
    name: draft.name.trim(),
    username: draft.username.trim(),
    bio: optionalText(draft.bio),
    universityId: draft.universityId,
    degree: optionalText(draft.degree),
    branch: optionalText(draft.branch),
    graduationYear: readGraduationYear(draft.graduationYear),
    location: optionalText(draft.location),
  };
}
