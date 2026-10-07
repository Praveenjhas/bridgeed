/**
 * Four point spacing scale. Every padding, margin and gap in the app comes from
 * here, so spacing stays rhythmic instead of drifting per screen.
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
  /** 24 — separation between card groups. */
  xxl: 24,
  /** 32 — empty state and hero spacing. */
  xxxl: 32,
} as const;

export type SpacingToken = keyof typeof spacing;
