import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { AppText, type TextTone } from "./AppText";
import { Icon, type IconName } from "./Icon";
import { useTheme, type ColorName } from "@/theme";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "md" | "sm";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon. */
  icon?: IconName;
  /**
   * Screen reader label. Defaults to the visible label, and only has to be set
   * where the visible text is terse and the action needs naming in full
   * ("Accept" inside a request card reads better as "Accept connection
   * request").
   */
  accessibilityLabel?: string;
  disabled?: boolean;
  /** Swaps the content for a spinner and blocks presses. */
  loading?: boolean;
  /** Stretches the button to the available width. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

interface VariantTokens {
  background: ColorName;
  pressedBackground: ColorName;
  border: ColorName | null;
  labelTone: TextTone;
  iconTone: ColorName;
}

const VARIANTS: Record<ButtonVariant, VariantTokens> = {
  primary: {
    background: "accent",
    pressedBackground: "accentStrong",
    border: null,
    labelTone: "onAccent",
    iconTone: "onAccent",
  },
  secondary: {
    background: "surface",
    pressedBackground: "surfaceMuted",
    border: "borderStrong",
    labelTone: "primary",
    iconTone: "textPrimary",
  },
  ghost: {
    background: "transparent",
    pressedBackground: "accentSoft",
    border: null,
    labelTone: "accent",
    iconTone: "accent",
  },
};

/**
 * The app's only button.
 *
 * Accessibility state is derived rather than left to callers, and the loading
 * state also disables the button, so a double tap cannot submit twice.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  accessibilityLabel,
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const { colors, layout, radius, spacing, typography } = useTheme();
  const tokens = VARIANTS[variant];
  const isInactive = disabled || loading;
  const sizeStyle: StyleProp<ViewStyle> =
    size === "sm"
      ? {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          minHeight: 36,
        }
      : {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          minHeight: layout.minTouchTarget,
        };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        sizeStyle,
        {
          backgroundColor: pressed
            ? tokens.pressedBackground
            : tokens.background,
          borderRadius: radius.md,
          borderWidth: tokens.border ? StyleSheet.hairlineWidth : 0,
          borderColor: tokens.border ? colors[tokens.border] : undefined,
          gap: spacing.sm,
        },
        fullWidth ? styles.fullWidth : null,
        isInactive ? styles.inactive : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors[tokens.iconTone]} />
      ) : (
        <>
          {icon ? (
            <Icon
              name={icon}
              size={layout.icon.sm}
              color={colors[tokens.iconTone]}
            />
          ) : null}
          <AppText
            tone={tokens.labelTone}
            style={typography.subheading}
            numberOfLines={1}
          >
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  inactive: {
    opacity: 0.55,
  },
});
