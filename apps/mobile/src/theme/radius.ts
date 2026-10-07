/**
 * Border radii. Corners stay moderate: BridgeEd is a utility product for
 * students and staff, so surfaces should feel precise rather than playful.
 */
export const radius = {
  none: 0,
  /** 6 — chips, tags and small badges. */
  sm: 6,
  /** 10 — buttons, inputs and list rows. */
  md: 10,
  /** 14 — cards and sheets. */
  lg: 14,
  /** Fully rounded, for pills and avatars. */
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;
