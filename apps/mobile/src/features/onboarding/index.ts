export {
  ONBOARDING_STEP_COPY,
  ONBOARDING_STEP_COUNT,
  ONBOARDING_STEPS,
  nextStep,
  previousStep,
  stepPosition,
  type OnboardingStepCopy,
  type OnboardingStepId,
} from "./steps";

export {
  BIO_MAX_LENGTH,
  BRANCH_MAX_LENGTH,
  DEGREE_MAX_LENGTH,
  DRAFT_ISSUE_FIELDS,
  GRADUATION_YEAR_MAX,
  GRADUATION_YEAR_MIN,
  LOCATION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  createEmptyDraft,
  isStepComplete,
  toCreateProfileInput,
  validateStep,
  type DraftIssues,
  type OnboardingDraft,
} from "./draft";

export { buildReviewRows, type ReviewLookups, type ReviewRow } from "./review";

export {
  HANDLE_TAKEN_MESSAGE,
  useOnboardingSubmit,
  type OnboardingSubmission,
  type OnboardingSubmitOutcome,
  type OnboardingSubmitState,
} from "./hooks/useOnboardingSubmit";

export {
  OnboardingProgress,
  type OnboardingProgressProps,
} from "./components/OnboardingProgress";
export { BasicsStep } from "./components/BasicsStep";
export { EducationStep } from "./components/EducationStep";
export { TagsStep, type TagsStepProps } from "./components/TagsStep";
export { ReviewStep, type ReviewStepProps } from "./components/ReviewStep";
export {
  UniversityStep,
  type UniversityStepProps,
} from "./components/UniversityStep";
export type { OnboardingStepProps } from "./components/stepProps";

/**
 * The two pickers are generic — a one-of-many list and a many-of-many chip grid
 * — so the profile editor reuses them rather than growing a second set of
 * controls that would drift from these.
 */
export { OptionList, type OptionListProps } from "./components/OptionList";
export { TagPicker, type TagPickerProps } from "./components/TagPicker";
