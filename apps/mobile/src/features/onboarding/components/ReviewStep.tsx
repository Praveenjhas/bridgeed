import { View } from "react-native";
import { AppText, Card, InlineError } from "@/components";
import { useTheme } from "@/theme";
import type { ReviewRow } from "../review";
import type { OnboardingStepId } from "../steps";
import { ReviewSummary } from "./ReviewSummary";

export interface ReviewStepProps {
  rows: ReviewRow[];
  /** Sends the student back to the step a line is edited on. */
  onEdit: (step: OnboardingStepId) => void;
  /** Message from the last failed submit, when there is one. */
  errorMessage: string | null;
  onDismissError: () => void;
}

/**
 * The last look before the profile is created.
 *
 * It shows exactly what will be sent, including the answers that were skipped, so
 * that "finish" is a decision rather than a guess. Nothing is written from here:
 * the button that submits lives in the flow's footer, so this step cannot create
 * a profile on its own.
 */
export function ReviewStep({
  rows,
  onEdit,
  errorMessage,
  onDismissError,
}: ReviewStepProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ padding: spacing.lg }}>
        <ReviewSummary
          rows={rows}
          onEdit={onEdit}
          skippedLabel="Not added"
          editLabel="Edit"
        />
      </Card>

      <AppText variant="caption" tone="muted">
        Finishing creates your profile and saves the skills and interests you
        chose. Everything here can be changed later.
      </AppText>

      {errorMessage !== null ? (
        <InlineError message={errorMessage} onDismiss={onDismissError} />
      ) : null}
    </View>
  );
}
