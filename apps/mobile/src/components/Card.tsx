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
 * The standard surface for grouped content.
 *
 * Cards are the only element that carries elevation, which keeps the visual
 * hierarchy flat and predictable: background, card, content.
 */
export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: CardProps) {
  const { colors, radius, shadows, spacing } = useTheme();

  const surfaceStyle: StyleProp<ViewStyle> = [
    styles.base,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    shadows.card,
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
