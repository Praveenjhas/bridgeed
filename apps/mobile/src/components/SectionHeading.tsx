import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { useTheme } from "@/theme";

export interface SectionHeadingProps {
  title: string;
  /** Supporting line under the title. */
  hint?: string;
  /** Trailing element, for example a link to a full list. */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Label above a group of content.
 *
 * Grouping is explicit rather than implied by spacing alone, which keeps long
 * screens scannable.
 */
export function SectionHeading({
  title,
  hint,
  action,
  style,
}: SectionHeadingProps) {
  const { spacing } = useTheme();

  return (
    <View style={[styles.row, { gap: spacing.md }, style]}>
      <View style={styles.text}>
        <AppText variant="heading">{title}</AppText>
        {hint ? (
          <AppText
            variant="caption"
            tone="muted"
            style={{ marginTop: spacing.xxs }}
          >
            {hint}
          </AppText>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  text: {
    flex: 1,
  },
});
