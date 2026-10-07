import type { ViewStyle } from "react-native";
import { colors } from "./colors";

/**
 * Elevation tokens.
 *
 * The editorial direction separates surfaces with borders, whitespace and a warm
 * background difference rather than with drop shadows, so there is no default
 * card shadow. `raised` exists for the rare element that genuinely floats above
 * content. Android ignores the shadow props, so each token also carries the
 * equivalent `elevation` value.
 */
export const shadows = {
  /** No elevation, for flat rows and editorial sections. */
  none: {} as ViewStyle,
  /** @deprecated Editorial surfaces are flat; kept so existing call sites still compile. */
  card: {} as ViewStyle,
  /** Elevation for elements that genuinely float above content. */
  raised: {
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  } satisfies ViewStyle,
} as const;

export type ShadowToken = keyof typeof shadows;
