import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText, type TextTone } from "./AppText";
import { Icon, type IconName } from "./Icon";
import { useTheme, type ColorName } from "@/theme";

/**
 * Semantic color slots for a badge. The list is deliberately short: a badge
 * labels a state at a glance, and a new color per state would turn a screen into
 * a legend nobody reads.
 */
export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

interface ToneTokens {
  background: ColorName;
  text: TextTone;
  icon: ColorName;
}

const TONES: Record<BadgeTone, ToneTokens> = {
  neutral: {
    background: "surfaceMuted",
    text: "secondary",
    icon: "textSecondary",
  },
  accent: { background: "accentSoft", text: "accent", icon: "accent" },
  success: { background: "successSoft", text: "success", icon: "success" },
  warning: { background: "warningSoft", text: "warning", icon: "warning" },
  danger: { background: "dangerSoft", text: "danger", icon: "danger" },
};

export interface BadgeProps {
  /** Short label, for example "Private", "Joined" or "Owner". */
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

/**
 * Small tinted pill that labels a state.
 *
 * The label uses the overline style, which keeps badges reading as metadata
 * instead of content, and the pill is intentionally not pressable: a badge that
 * looks like a button is the quickest way to make a screen feel unreliable.
 */
export function Badge({ label, tone = "neutral", icon, style }: BadgeProps) {
  const { colors, layout, radius, spacing } = useTheme();
  const tokens = TONES[tone];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors[tokens.background],
          borderRadius: radius.pill,
          gap: spacing.xs,
          paddingVertical: spacing.xxs,
          paddingHorizontal: spacing.sm,
        },
        style,
      ]}
    >
      {icon ? (
        <Icon name={icon} size={layout.icon.sm} tone={tokens.icon} />
      ) : null}
      <AppText variant="overline" tone={tokens.text} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
});
