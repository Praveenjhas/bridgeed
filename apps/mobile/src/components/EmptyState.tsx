import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";
import { useTheme } from "@/theme";

export interface EmptyStateProps {
  title: string;
  message: string;
  /** Optional small standing glyph, drawn on its own rather than in a circle. */
  icon?: IconName;
  /** Rendered under the message, usually a single button. */
  action?: ReactNode;
  /** Switches the glyph between neutral and failure styling. */
  tone?: "neutral" | "danger";
  style?: StyleProp<ViewStyle>;
}

/**
 * Editorial explanation for a screen with nothing to show.
 *
 * Empty states are human and lead somewhere: a short title, one honest sentence,
 * and often a single next step. There is no decorative illustration and no icon
 * inside a coloured circle — under the "Campus Editorial" direction an oversized
 * graphic is exactly the noise this replaces.
 */
export function EmptyState({
  title,
  message,
  icon,
  action,
  tone = "neutral",
  style,
}: EmptyStateProps) {
  const { layout, spacing } = useTheme();
  const isDanger = tone === "danger";

  return (
    <View
      style={[
        {
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: spacing.huge,
          paddingHorizontal: spacing.xl,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={layout.icon.lg}
          tone={isDanger ? "danger" : "accent"}
          style={{ marginBottom: spacing.xs }}
        />
      ) : null}
      <AppText variant="subheading" style={{ textAlign: "center" }}>
        {title}
      </AppText>
      <AppText variant="body" tone="secondary" style={{ textAlign: "center" }}>
        {message}
      </AppText>
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
  );
}
