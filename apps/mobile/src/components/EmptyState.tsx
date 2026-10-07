import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";
import { useTheme } from "@/theme";

export interface EmptyStateProps {
  title: string;
  message: string;
  icon?: IconName;
  /** Rendered under the message, usually a single button. */
  action?: ReactNode;
  /** Switches the illustration between neutral and failure styling. */
  tone?: "neutral" | "danger";
  style?: StyleProp<ViewStyle>;
}

/**
 * Centered explanation for a screen with nothing to show.
 *
 * Empty states say what happened and what to do next; a spinner sitting forever
 * on an empty list is the failure mode this replaces.
 */
export function EmptyState({
  title,
  message,
  icon = "information-circle-outline",
  action,
  tone = "neutral",
  style,
}: EmptyStateProps) {
  const { colors, layout, radius, spacing } = useTheme();
  const isDanger = tone === "danger";
  const circleSize = layout.icon.lg * 2.5;

  return (
    <View
      style={[
        {
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: spacing.xxxl,
          paddingHorizontal: spacing.xl,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      <View
        style={{
          width: circleSize,
          height: circleSize,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDanger ? colors.dangerSoft : colors.surfaceMuted,
          marginBottom: spacing.xs,
        }}
      >
        <Icon
          name={icon}
          size={layout.icon.lg}
          tone={isDanger ? "danger" : "textMuted"}
        />
      </View>
      <AppText variant="heading" style={{ textAlign: "center" }}>
        {title}
      </AppText>
      <AppText variant="body" tone="secondary" style={{ textAlign: "center" }}>
        {message}
      </AppText>
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
  );
}
