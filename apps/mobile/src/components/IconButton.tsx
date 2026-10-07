import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Icon, type IconName } from "./Icon";
import { useTheme, type ColorName } from "@/theme";

export interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  /** Required, because an icon on its own says nothing to a screen reader. */
  accessibilityLabel: string;
  tone?: ColorName;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A single tappable icon, sized to the minimum touch target.
 *
 * The visible glyph stays small while the press area does not, which is why the
 * padding is not left to the caller.
 */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = "textSecondary",
  size,
  disabled = false,
  style,
}: IconButtonProps) {
  const { colors, layout, radius, spacing } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={spacing.sm}
      style={({ pressed }) => [
        styles.base,
        {
          minWidth: layout.minTouchTarget,
          minHeight: layout.minTouchTarget,
          borderRadius: radius.pill,
          backgroundColor: pressed ? colors.surfaceMuted : colors.transparent,
        },
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Icon name={icon} size={size ?? layout.icon.lg} tone={tone} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.4,
  },
});
