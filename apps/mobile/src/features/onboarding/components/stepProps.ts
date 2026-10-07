import type { DraftIssues, OnboardingDraft } from "../draft";

/**
 * What every onboarding step is handed.
 *
 * A step owns no state: it renders the part of the draft it is responsible for
 * and reports a change back. That is what lets the flow keep every answer when
 * the student moves between steps, and lets the same draft be validated by the
 * step that is showing and again by the submit.
 */
export interface OnboardingStepProps {
  draft: OnboardingDraft;
  /** Messages for the fields of this step, when a value was rejected. */
  issues: DraftIssues;
  /** Merges a change into the draft. */
  onEdit: (patch: Partial<OnboardingDraft>) => void;
  /** True while the profile is being submitted, which locks the inputs. */
  isBusy: boolean;
}
