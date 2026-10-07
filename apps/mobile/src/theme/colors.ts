/**
 * BridgeEd color tokens — "Campus Editorial".
 *
 * One brand colour (a deep evergreen) carries selection, links and primary
 * actions; a restrained warm gold is reserved for the brand mark; everything
 * else stays on warm, paper-like neutrals so the product reads as a modern
 * university publication rather than a generic SaaS dashboard. Backgrounds are a
 * warm paper rather than cold grey, primary text is a deep ink green rather than
 * a blue-black, and the red is muted. Values keep body copy at a comfortable
 * contrast ratio on its surface.
 */
export const colors = {
  /** Primary brand colour, used for selection, links and primary actions. */
  accent: "#126B59",
  /** Pressed / emphasized variant of the brand colour. */
  accentStrong: "#0B4D40",
  /** Tinted brand background for chips and selected rows. */
  accentSoft: "#E4F0EB",
  /** Foreground color that is safe on top of `accent`. */
  onAccent: "#FFFFFF",

  /** Restrained warm gold, reserved for the brand mark. */
  gold: "#B9852D",
  /** Tinted gold background, for the brand mark nodes and warm accents. */
  goldSoft: "#F4E9D2",

  /** App background behind all surfaces — warm paper, not cold white. */
  background: "#F7F5EF",
  /** Default card / sheet background. */
  surface: "#FFFFFF",
  /** Secondary background for inset areas such as composer inputs. */
  surfaceMuted: "#EFECE2",
  /** Placeholder blocks while data is loading. */
  skeleton: "#E9E5DA",

  /** Hairline borders and dividers, warm rather than neutral grey. */
  border: "#DDD9CF",
  /** Lighter hairline for dividers between rows of the same group. */
  borderLight: "#ECE9E1",
  /** Borders that need to stay visible on muted surfaces. */
  borderStrong: "#CFC9BB",

  /** Primary reading color — deep ink green. */
  textPrimary: "#17221D",
  /** Supporting copy such as post bodies and metadata. */
  textSecondary: "#59635D",
  /** The quietest text that is still meant to be read. */
  textMuted: "#7B837D",
  /** Disabled controls. */
  textDisabled: "#A7AFA9",

  /** Positive confirmation. */
  success: "#2E7658",
  /** Tinted background for confirmation chips, such as an active membership. */
  successSoft: "#E4F0EB",
  /** Non blocking warning. */
  warning: "#B9852D",
  /** Tinted background for chips that are waiting on something. */
  warningSoft: "#F4E9D2",
  /** Destructive action or failure — a muted, editorial red. */
  danger: "#B74738",
  /** Tinted background for failure banners and error illustrations. */
  dangerSoft: "#F6E5E1",

  /** Scrim value for overlays. */
  overlay: "rgba(23, 34, 29, 0.5)",
  /** Fully transparent, for conditional styling. */
  transparent: "transparent",
} as const;

/** Names of every color token, useful for props that take a token name. */
export type ColorName = keyof typeof colors;

