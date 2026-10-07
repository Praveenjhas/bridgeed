/**
 * The steps of student onboarding, in the order they are walked.
 *
 * The flow is one screen with internal steps rather than one route per step: the
 * answers live in that screen's state, and a step that were a route would either
 * lose the draft on a back gesture or force the draft into a store the rest of
 * the app would then have to know about. Keeping the order in one list means the
 * progress indicator, the back button and the validation cannot disagree about
 * what comes next.
 */
export const ONBOARDING_STEPS = [
  "basics",
  "university",
  "education",
  "tags",
  "review",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length;

/** Everything the header and the progress indicator need to describe a step. */
export interface OnboardingStepCopy {
  /** Short name, for the progress indicator's list of steps. */
  label: string;
  /** Headline of the step. */
  title: string;
  /** One supporting sentence under the headline. */
  subtitle: string;
}

export const ONBOARDING_STEP_COPY: Record<
  OnboardingStepId,
  OnboardingStepCopy
> = {
  basics: {
    label: "You",
    title: "How should people know you?",
    subtitle:
      "Your name and handle are what classmates see on every post, comment and connection.",
  },
  university: {
    label: "University",
    title: "Where do you study?",
    subtitle:
      "Your university is how BridgeEd places you with students you would actually meet.",
  },
  education: {
    label: "Course",
    title: "What are you studying?",
    subtitle:
      "Course details are optional, and only the ones you fill in are ever shown.",
  },
  tags: {
    label: "Skills",
    title: "What are you good at, and into?",
    subtitle:
      "Pick a few skills and interests so the right classmates can find you.",
  },
  review: {
    label: "Review",
    title: "Does this look right?",
    subtitle: "Everything here can be changed later from your profile.",
  },
};

/** One-based position of a step, for "Step 2 of 5". */
export function stepPosition(step: OnboardingStepId): number {
  return ONBOARDING_STEPS.indexOf(step) + 1;
}

/** The step before this one, or null at the start of the flow. */
export function previousStep(step: OnboardingStepId): OnboardingStepId | null {
  const index = ONBOARDING_STEPS.indexOf(step);

  return index > 0 ? ONBOARDING_STEPS[index - 1] : null;
}

/** The step after this one, or null at the end of the flow. */
export function nextStep(step: OnboardingStepId): OnboardingStepId | null {
  const index = ONBOARDING_STEPS.indexOf(step);

  return index >= 0 && index < ONBOARDING_STEP_COUNT - 1
    ? ONBOARDING_STEPS[index + 1]
    : null;
}
