import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme";

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** When provided the whole card becomes one accessible press target. */
  onPress?: () => void;
  /** Label read by screen readers for a pressable card. */
  accessibilityLabel?: string;
  /** Groups nested controls under the card's label for assistive tech. */
  accessibilityHint?: string;
}

/**
 * The standard surface for genuinely grouped content.
 *
 * Cards are flat: separated from the paper background by a hairline border, not
 * by a drop shadow. Under the "Campus Editorial" direction most content belongs
 * in rows and dividers instead of a card, so this is used deliberately for a
 * distinct object or an important callout, never as the default wrapper for
 * every section.
 */
export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: CardProps) {
  const { colors, radius, spacing } = useTheme();

  const surfaceStyle: StyleProp<ViewStyle> = [
    styles.base,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    style,
  ];

  if (!onPress) {
    return <View style={surfaceStyle}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        surfaceStyle,
        pressed ? { backgroundColor: colors.surfaceMuted } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
