import { formatGraduationYear } from "@/features/students";
import {
  optionalText,
  readGraduationYear,
  type OnboardingDraft,
} from "./draft";
import type { OnboardingStepId } from "./steps";

/** One line of the Review step: a label, the answer, and where to change it. */
export interface ReviewRow {
  key: string;
  label: string;
  /** The answer as it will be saved, or null when the student skipped it. */
  value: string | null;
  /** The step the answer is typed on, so Review can send them back to it. */
  step: OnboardingStepId;
}

/** What the draft's ids resolve to, so Review can show names instead. */
export interface ReviewLookups {
  /** Name of the university the draft points at, or null when none is chosen. */
  universityName: string | null;
  skillNames: string[];
  interestNames: string[];
}

/**
 * Turns the draft into the lines Review shows.
 *
 * The rows are built from the same helpers the pickers and the submit use, so
 * Review cannot show a value that is formatted differently from the one that will
 * be saved. An answer the student skipped stays null rather than becoming an
 * empty box, which is what lets Review say "Not added" instead of nothing at all.
 */
export function buildReviewRows(
  draft: OnboardingDraft,
  lookups: ReviewLookups,
): ReviewRow[] {
  return [
    {
      key: "name",
      label: "Name",
      value: optionalText(draft.name),
      step: "basics",
    },
    {
      key: "username",
      label: "Handle",
      value: handleText(draft.username),
      step: "basics",
    },
    {
      key: "bio",
      label: "Bio",
      value: optionalText(draft.bio),
      step: "basics",
    },
    {
      key: "university",
      label: "University",
      value: chosenName(draft.universityId, lookups.universityName),
      step: "university",
    },
    {
      key: "course",
      label: "Course",
      value: courseText(draft.degree, draft.branch),
      step: "education",
    },
    {
      key: "graduationYear",
      label: "Graduation",
      value: formatGraduationYear(readGraduationYear(draft.graduationYear)),
      step: "education",
    },
    {
      key: "location",
      label: "Location",
      value: optionalText(draft.location),
      step: "education",
    },
    {
      key: "skills",
      label: "Skills",
      value: formatTagSelection(draft.skillIds, lookups.skillNames),
      step: "tags",
    },
    {
      key: "interests",
      label: "Interests",
      value: formatTagSelection(draft.interestIds, lookups.interestNames),
      step: "tags",
    },
  ];
}

function handleText(username: string): string | null {
  const trimmed = username.trim();

  return trimmed.length > 0 ? `@${trimmed}` : null;
}

/** `B.Tech · Computer Science`, matching how the profile screen shows a course. */
function courseText(degree: string, branch: string): string | null {
  const parts = [degree, branch]
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The name behind an id the student picked, for a catalog that may still be
 * loading.
 *
 * A chosen university is never described as "not added": if the id is there and
 * the name has not arrived yet, the line says so plainly rather than suggesting
 * the answer was lost.
 */
function chosenName(id: string | null, name: string | null): string | null {
  if (id === null) {
    return null;
  }

  return name ?? "Selected";
}

/**
 * How a chosen set of tags reads.
 *
 * Names are preferred, and when the catalog has not resolved every id yet the
 * count stands in for them — nothing the student picked should look like it was
 * dropped on the way to Review.
 */
function formatTagSelection(
  selectedIds: string[],
  names: string[],
): string | null {
  if (selectedIds.length === 0) {
    return null;
  }

  return names.length === selectedIds.length
    ? names.join(", ")
    : `${selectedIds.length} selected`;
}
