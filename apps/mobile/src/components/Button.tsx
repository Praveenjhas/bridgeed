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
export type ButtonSize = "lg" | "md" | "sm";

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
 * The look of a button that cannot be pressed.
 *
 * It keeps the button's shape and adds an outline instead of only fading, so it
 * stays recognisably a button — on the grey row inside a composer just as much
 * as on the white card of the sign in form, which is where a fill-only treatment
 * disappears. The label drops to `muted`, which holds about 4:1 on the fill: low
 * enough to read as unavailable, high enough to still be read.
 */
const DISABLED = {
  background: "surfaceMuted",
  border: "borderStrong",
  labelTone: "muted",
  iconTone: "textMuted",
} as const satisfies {
  background: ColorName;
  border: ColorName;
  labelTone: TextTone;
  iconTone: ColorName;
};

/**
 * The app's only button.
 *
 * Accessibility state is derived rather than left to callers. `loading` blocks
 * presses too, so a double tap cannot submit twice, but it keeps the button at
 * full strength: dimming a control that is mid-request reads as "broken", not
 * "busy". The spinner is placed beside the label rather than replacing it, so
 * the button keeps its width and the user can still see what they pressed.
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
  // A mid-request button is busy, not unavailable, so the muted palette is kept
  // for a genuinely disabled control.
  const isDisabledStyle = disabled && !loading;
  const labelTone = isDisabledStyle ? DISABLED.labelTone : tokens.labelTone;
  const iconTone = isDisabledStyle ? DISABLED.iconTone : tokens.iconTone;
  const hasBorder = isDisabledStyle || tokens.border !== null;

  const sizeStyle: StyleProp<ViewStyle> =
    size === "sm"
      ? {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          minHeight: 36,
        }
      : size === "lg"
        ? {
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.xl,
            minHeight: layout.controlHeight,
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
          // The variant table holds colour *names*, not values, so they have to
          // be resolved through the palette. Passing a name straight through made
          // `processColor` drop the fill: the button then rendered as a white
          // label on the light background, with no pressed state either, so a tap
          // looked like it had not registered at all.
          backgroundColor: isDisabledStyle
            ? colors[DISABLED.background]
            : colors[pressed ? tokens.pressedBackground : tokens.background],
          borderRadius: radius.md,
          borderWidth: hasBorder
            ? isDisabledStyle
              ? 1
              : StyleSheet.hairlineWidth
            : 0,
          borderColor: isDisabledStyle
            ? colors[DISABLED.border]
            : tokens.border
              ? colors[tokens.border]
              : undefined,
          gap: spacing.sm,
        },
        fullWidth ? styles.fullWidth : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors[iconTone]} />
      ) : icon ? (
        <Icon name={icon} size={layout.icon.sm} color={colors[iconTone]} />
      ) : null}
      <AppText tone={labelTone} style={typography.subheading} numberOfLines={1}>
        {label}
      </AppText>
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
});
