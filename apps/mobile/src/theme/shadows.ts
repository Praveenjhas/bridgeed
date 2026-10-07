import type { ViewStyle } from "react-native";
import { colors } from "./colors";

/**
 * Elevation tokens.
 *
 * Cards use one soft shadow so content separates from the background without
 * looking heavy. Android ignores the shadow props, so each token also carries
 * the equivalent `elevation` value.
 */
export const shadows = {
  /** No elevation, for flat rows inside a card. */
  none: {} as ViewStyle,
  /** Default card elevation. */
  card: {
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  } satisfies ViewStyle,
  /** Elevation for elements that float above content, such as the composer. */
  raised: {
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  } satisfies ViewStyle,
} as const;

export type ShadowToken = keyof typeof shadows;
