import { Text, type TextProps } from "react-native";
import { useTheme, type ColorName, type TypographyToken } from "@/theme";

/** Semantic color slots for text, so callers never pick a raw hex value. */
export type TextTone =
  | "primary"
  | "secondary"
  | "muted"
  | "accent"
  | "danger"
  | "success"
  | "warning"
  | "onAccent";

const TONE_COLORS: Record<TextTone, ColorName> = {
  primary: "textPrimary",
  secondary: "textSecondary",
  muted: "textMuted",
  accent: "accent",
  danger: "danger",
  success: "success",
  warning: "warning",
  onAccent: "onAccent",
};

export interface AppTextProps extends TextProps {
  /** Step on the type scale. Defaults to the reading size. */
  variant?: TypographyToken;
  /** Semantic color slot. Defaults to primary text. */
  tone?: TextTone;
}

/**
 * Every piece of text in the app goes through this component.
 *
 * It exists because React Native has no text cascade: without it, every screen
 * would repeat font sizes and colors, and the type scale would drift within a
 * week. `AppText` is deliberately a thin wrapper: any `Text` prop still works.
 */
export function AppText({
  variant = "body",
  tone = "primary",
  style,
  ...rest
}: AppTextProps) {
  const { colors, typography } = useTheme();

  return (
    <Text
      style={[typography[variant], { color: colors[TONE_COLORS[tone]] }, style]}
      {...rest}
    />
  );
}
