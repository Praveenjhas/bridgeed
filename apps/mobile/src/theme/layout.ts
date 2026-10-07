import { spacing } from "./spacing";

/**
 * Layout constants shared by every screen, so touch targets, avatars and icons
 * keep the same physical size no matter which feature renders them.
 */
export const layout = {
  /** Minimum pressable size recommended by both Apple and Google. */
  minTouchTarget: 44,
  /**
   * Height of a text field, and of the large button that submits it.
   *
   * One value rather than two, so a stack of inputs and the call to action below
   * them line up on the same rows instead of being a few pixels out.
   */
  controlHeight: 52,
  /** Height of the in-app header used on the feed and detail screens. */
  headerHeight: 56,
  /** Default horizontal gutter between screen edge and content. */
  screenPadding: spacing.lg,
  /** Vertical gap between cards in a list. */
  listGap: spacing.sm,
  /** Avatar sizes, keyed by where they are used. */
  avatar: { sm: 32, md: 40, lg: 48 },
  /** Icon sizes, keyed by the role the icon plays in a row or button. */
  icon: { sm: 16, md: 20, lg: 24 },
  /** Upper bound for content width so tablets do not stretch text lines. */
  maxContentWidth: 680,
  /** Number of placeholder cards shown while the first feed page loads. */
  skeletonCards: 3,
  /** Height of one placeholder card. */
  skeletonCardHeight: 148,
} as const;
