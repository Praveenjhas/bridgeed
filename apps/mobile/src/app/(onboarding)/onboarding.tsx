import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { AppText, Button, InlineError, Screen } from "@/components";
import {
  BasicsStep,
  DRAFT_ISSUE_FIELDS,
  EducationStep,
  HANDLE_TAKEN_MESSAGE,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_COPY,
  OnboardingProgress,
  ReviewStep,
  TagsStep,
  UniversityStep,
  buildReviewRows,
  createEmptyDraft,
  isStepComplete,
  nextStep,
  previousStep,
  toCreateProfileInput,
  useOnboardingSubmit,
  validateStep,
  type DraftIssues,
  type OnboardingDraft,
  type OnboardingStepId,
} from "@/features/onboarding";
import { useInterests, useSkills, useUniversities } from "@/features/students";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/theme";
import { toUserMessage } from "@/utils/errors";

/** The step that finishes the flow instead of continuing it. */
const REVIEW_STEP: OnboardingStepId = "review";

/**
 * Student onboarding.
 *
 * One screen walking five steps, and the only screen a signed-in student without
 * a profile can reach: the root layout keeps the tabs out of the tree until the
 * profile exists, so this is not a prompt that can be dismissed, it is the app's
 * only route. Signing out is the one exit, and it is offered on every step,
 * because a student who signed in as the wrong account should be able to leave
 * without pretending to be someone they are not.
 *
 * The draft lives here rather than in each step, which is what lets a student
 * move backwards without losing an answer, and the steps are rendered rather
 * than routed for the same reason. Nothing is written until the final step, and
 * from there the whole profile is created in one request.
 */
export default function OnboardingScreen() {
  const { layout, spacing } = useTheme();
  const { logout } = useAuth();
  const [step, setStep] = useState<OnboardingStepId>("basics");
  const [draft, setDraft] = useState<OnboardingDraft>(createEmptyDraft);
  const [issues, setIssues] = useState<DraftIssues>({});
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const { submit, isSubmitting, errorMessage, dismissError } =
    useOnboardingSubmit();

  // The three lists the flow picks from are read while the student types their
  // name: no picker can be filled any other way, and reading them up front means
  // a step never opens onto a spinner where its options should be.
  const universities = useUniversities();
  const skills = useSkills();
  const interests = useInterests();

  const copy = ONBOARDING_STEP_COPY[step];
  const isReview = step === REVIEW_STEP;

  const edit = useCallback((patch: Partial<OnboardingDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));

    // Only the complaints the edit answers are dropped: a message about the
    // handle goes when the handle is retyped, and stays while the name changes.
    setIssues((current) => {
      const next: DraftIssues = { ...current };

      for (const field of DRAFT_ISSUE_FIELDS) {
        if (field in patch) {
          next[field] = undefined;
        }
      }

      return next;
    });
  }, []);

  const goToStep = useCallback((target: OnboardingStepId) => {
    setStep(target);
    setIssues({});
  }, []);

  const handleContinue = useCallback(() => {
    const found = validateStep(step, draft);

    if (Object.keys(found).length > 0) {
      setIssues(found);

      return;
    }

    const target = nextStep(step);

    if (target !== null) {
      goToStep(target);
    }
  }, [draft, goToStep, step]);

  const handleBack = useCallback(() => {
    const target = previousStep(step);

    if (target !== null) {
      goToStep(target);
    }
  }, [goToStep, step]);

  const handleFinish = useCallback(async () => {
    // Review can only be reached through the earlier steps, but an answer can be
    // cleared with Back and then walked past again, so the whole draft is checked
    // before anything is sent and the student is returned to what needs fixing.
    const incomplete = ONBOARDING_STEPS.find(
      (candidate) => !isStepComplete(candidate, draft),
    );

    if (incomplete !== undefined) {
      setIssues(validateStep(incomplete, draft));
      setStep(incomplete);

      return;
    }

    const outcome = await submit({
      profile: toCreateProfileInput(draft),
      skillIds: draft.skillIds,
      interestIds: draft.interestIds,
    });

    if (outcome.kind === "handle-taken") {
      setIssues({ username: HANDLE_TAKEN_MESSAGE });
      setStep("basics");
    }

    // A successful submit publishes the profile, which unmounts this screen.
  }, [draft, submit]);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      await logout();
      // The guard swaps this screen for sign-in, so nothing below is seen.
    } catch (error) {
      setSignOutError(toUserMessage(error));
      setIsSigningOut(false);
    }
  }, [logout]);

  // The ids the draft holds are turned into names for Review, from the same
  // catalogs the pickers show.
  const reviewRows = useMemo(() => {
    const university =
      universities.items.find((item) => item.id === draft.universityId) ?? null;

    return buildReviewRows(draft, {
      universityName: university?.name ?? null,
      skillNames: skills.items
        .filter((item) => draft.skillIds.includes(item.id))
        .map((item) => item.name),
      interestNames: interests.items
        .filter((item) => draft.interestIds.includes(item.id))
        .map((item) => item.name),
    });
  }, [draft, interests.items, skills.items, universities.items]);

  // One body per step, keyed by the step, so the compiler guarantees every step
  // in the flow renders something and none of them is reachable without a body.
  const stepBody: Record<OnboardingStepId, ReactNode> = {
    basics: (
      <BasicsStep
        draft={draft}
        issues={issues}
        onEdit={edit}
        isBusy={isSubmitting}
      />
    ),
    university: (
      <UniversityStep
        draft={draft}
        issues={issues}
        onEdit={edit}
        isBusy={isSubmitting}
        catalog={universities}
      />
    ),
    education: (
      <EducationStep
        draft={draft}
        issues={issues}
        onEdit={edit}
        isBusy={isSubmitting}
      />
    ),
    tags: (
      <TagsStep
        draft={draft}
        issues={issues}
        onEdit={edit}
        isBusy={isSubmitting}
        skills={skills}
        interests={interests}
      />
    ),
    review: (
      <ReviewStep
        rows={reviewRows}
        onEdit={goToStep}
        errorMessage={errorMessage}
        onDismissError={dismissError}
      />
    ),
  };

  return (
    <Screen safeTop safeBottom>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.fill}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              width: "100%",
              maxWidth: layout.maxContentWidth,
              alignSelf: "center",
              paddingHorizontal: layout.screenPadding,
              paddingTop: spacing.xl,
              paddingBottom: spacing.xxl,
              gap: spacing.xl,
            }}
          >
            <View style={{ gap: spacing.md }}>
              <View style={[styles.headerRow, { gap: spacing.md }]}>
                <AppText variant="overline" tone="accent">
                  BridgeEd
                </AppText>
                <Button
                  label="Sign out"
                  variant="ghost"
                  size="sm"
                  accessibilityLabel="Sign out of your account"
                  onPress={handleSignOut}
                  loading={isSigningOut}
                />
              </View>

              <OnboardingProgress currentStep={step} />
            </View>

            <View style={{ gap: spacing.xs }}>
              <AppText variant="title" accessibilityRole="header">
                {copy.title}
              </AppText>
              <AppText variant="body" tone="secondary">
                {copy.subtitle}
              </AppText>
            </View>

            {stepBody[step]}

            <View style={{ gap: spacing.sm }}>
              {signOutError !== null ? (
                <InlineError
                  message={signOutError}
                  onDismiss={() => setSignOutError(null)}
                />
              ) : null}

              {isReview ? (
                <Button
                  label="Finish and enter BridgeEd"
                  icon="checkmark-circle-outline"
                  size="lg"
                  fullWidth
                  onPress={handleFinish}
                  loading={isSubmitting}
                />
              ) : (
                <Button
                  label="Continue"
                  icon="arrow-forward-outline"
                  size="lg"
                  fullWidth
                  onPress={handleContinue}
                  disabled={isSubmitting}
                />
              )}

              {previousStep(step) !== null ? (
                <Button
                  label="Back"
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onPress={handleBack}
                  disabled={isSubmitting}
                />
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
