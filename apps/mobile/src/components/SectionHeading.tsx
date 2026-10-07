import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { useTheme } from "@/theme";

export interface SectionHeadingProps {
  title: string;
  /** Supporting line under the title. */
  hint?: string;
  /**
   * A small kicker above the title, for example "Your feed". Sentence case, not
   * uppercase: the editorial direction keeps labels readable rather than shouting.
   */
  eyebrow?: string;
  /** Renders the title at the large section size instead of the default. */
  size?: "md" | "lg";
  /** Trailing element, for example a link to a full list. */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Label above a group of content.
 *
 * Grouping is explicit rather than implied by spacing alone, which keeps long
 * screens scannable. A section is not automatically a card: the heading and the
 * space around it do the work that a box used to.
 */
export function SectionHeading({
  title,
  hint,
  eyebrow,
  size = "md",
  action,
  style,
}: SectionHeadingProps) {
  const { spacing } = useTheme();

  return (
    <View style={[styles.row, { gap: spacing.md }, style]}>
      <View style={styles.text}>
        {eyebrow ? (
          <AppText variant="label" tone="accent">
            {eyebrow}
          </AppText>
        ) : null}
        <AppText
          variant={size === "lg" ? "heading" : "subheading"}
          style={eyebrow ? { marginTop: spacing.xxs } : undefined}
        >
          {title}
        </AppText>
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
