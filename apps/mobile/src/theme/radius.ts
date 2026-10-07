/**
 * Border radii.
 *
 * A deliberately small set. Corners are confident rather than soft: BridgeEd is
 * an editorial, academic product, so surfaces should feel precise. The fully
 * rounded `pill` is reserved for things that are semantically round or pill —
 * avatars, status badges and compact tag filters — and is never used just to
 * make a rectangle friendlier.
 */
export const radius = {
  none: 0,
  /** 8 — small controls, chips and tags. */
  sm: 8,
  /** 10 — buttons, inputs and list rows. */
  md: 10,
  /** 12 — cards. */
  lg: 12,
  /** 16 — large surfaces such as sheets and hero blocks. */
  xl: 16,
  /** Fully rounded, for avatars and semantic pills only. */
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;
