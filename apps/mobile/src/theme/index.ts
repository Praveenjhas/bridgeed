import { colors, type ColorName } from "./colors";
import { layout } from "./layout";
import { radius, type RadiusToken } from "./radius";
import { shadows, type ShadowToken } from "./shadows";
import { spacing, type SpacingToken } from "./spacing";
import { typography, type TypographyToken } from "./typography";

/**
 * The complete set of design tokens.
 *
 * Tokens are grouped by concern (color, space, type, elevation) and never by
 * screen, so a screen can be restyled without adding anything here.
 */
export interface Theme {
  readonly colors: typeof colors;
  readonly spacing: typeof spacing;
  readonly typography: typeof typography;
  readonly radius: typeof radius;
  readonly shadows: typeof shadows;
  readonly layout: typeof layout;
}

export const theme: Theme = {
  colors,
  spacing,
  typography,
  radius,
  shadows,
  layout,
};

/**
 * Single way for a component to read the theme.
 *
 * It is a plain function returning a module level object for now: BridgeEd has
 * exactly one visual identity, and the indirection means a provider (for
 * instance for a future dark mode or a high contrast mode) can be introduced
 * later without touching a single call site.
 */
export function useTheme(): Theme {
  return theme;
}

export { colors, layout, radius, shadows, spacing, typography };
export type {
  ColorName,
  RadiusToken,
  ShadowToken,
  SpacingToken,
  TypographyToken,
};
