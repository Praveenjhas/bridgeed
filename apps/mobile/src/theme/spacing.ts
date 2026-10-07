/**
 * Eight point spacing scale. Every padding, margin and gap in the app comes from
 * here, so spacing stays rhythmic instead of drifting per screen: 4, 8, 12, 16,
 * 20, 24, 32, 40, with a single 2px step kept for hairline icon nudges only.
 */
export const spacing = {
  none: 0,
  /** 2 — hairline adjustments only, mostly inside icon buttons. */
  xxs: 2,
  /** 4 — gap between an icon and its label. */
  xs: 4,
  /** 8 — default gap between related elements. */
  sm: 8,
  /** 12 — gap between separate elements of one group. */
  md: 12,
  /** 16 — default card padding and screen gutter. */
  lg: 16,
  /** 20 — section separation inside a card. */
  xl: 20,
  /** 24 — separation between groups. */
  xxl: 24,
  /** 32 — empty state and hero spacing. */
  xxxl: 32,
  /** 40 — the largest rhythm step, for entry and empty surfaces. */
  huge: 40,
} as const;

export type SpacingToken = keyof typeof spacing;
