import { StyleSheet, View } from "react-native";
import { AppText } from "@/components";
import { useTheme } from "@/theme";
import {
  ONBOARDING_STEP_COPY,
  ONBOARDING_STEP_COUNT,
  ONBOARDING_STEPS,
  stepPosition,
  type OnboardingStepId,
} from "../steps";

export interface OnboardingProgressProps {
  currentStep: OnboardingStepId;
}

/**
 * How far through onboarding the student is.
 *
 * It is drawn as one segment per step rather than as a single bar, because the
 * number of steps is small and fixed and the segments say how many are left,
 * which a percentage does not. The current step is filled by the same rule as the
 * ones behind it, so "2 of 5" and the picture cannot disagree.
 */
export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  const { colors, radius, spacing } = useTheme();
  const position = stepPosition(currentStep);
  const copy = ONBOARDING_STEP_COPY[currentStep];

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${position} of ${ONBOARDING_STEP_COUNT}: ${copy.label}`}
      accessibilityValue={{
        min: 1,
        max: ONBOARDING_STEP_COUNT,
        now: position,
      }}
      style={{ gap: spacing.sm }}
    >
      <View style={[styles.row, { gap: spacing.xs }]}>
        {ONBOARDING_STEPS.map((step, index) => (
          <View
            key={step}
            style={[
              styles.segment,
              {
                borderRadius: radius.pill,
                backgroundColor:
                  index < position ? colors.accent : colors.borderStrong,
              },
            ]}
          />
        ))}
      </View>
      <AppText variant="caption" tone="muted">
        {`Step ${position} of ${ONBOARDING_STEP_COUNT} · ${copy.label}`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  segment: {
    flex: 1,
    height: 4,
  },
});
