import { Fragment } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, Divider } from "@/components";
import { useTheme } from "@/theme";
import type { ReviewRow } from "../review";
import type { OnboardingStepId } from "../steps";

export interface ReviewSummaryProps {
  rows: ReviewRow[];
  /** Returns to the step a row's answer is typed on. */
  onEdit: (step: OnboardingStepId) => void;
  /** Shown in place of an answer the student skipped. */
  skippedLabel: string;
  editLabel: string;
}

/**
 * The answers, read back before they are sent.
 *
 * Each line is editable, which is what makes Review a last look rather than a
 * dead end: a student who spots a mistake does not have to guess how many times
 * to press Back to reach it.
 */
export function ReviewSummary({
  rows,
  onEdit,
  skippedLabel,
  editLabel,
}: ReviewSummaryProps) {
  const { spacing } = useTheme();

  return (
    <View>
      {rows.map((row, index) => (
        <Fragment key={row.key}>
          {index > 0 ? <Divider spacing="md" /> : null}
          <View style={[styles.row, { gap: spacing.md }]}>
            <View style={styles.rowText}>
              <AppText variant="overline" tone="muted">
                {row.label}
              </AppText>
              <AppText
                variant={row.value === null ? "caption" : "body"}
                tone={row.value === null ? "muted" : "primary"}
              >
                {row.value ?? skippedLabel}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${editLabel} ${row.label}`}
              onPress={() => onEdit(row.step)}
              hitSlop={spacing.sm}
            >
              <AppText variant="caption" tone="accent" style={styles.edit}>
                {editLabel}
              </AppText>
            </Pressable>
          </View>
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  rowText: {
    flex: 1,
  },
  edit: {
    textDecorationLine: "underline",
  },
});
