/**
 * BridgeEd color tokens.
 *
 * One accent carries the brand; everything else stays on neutral surfaces so the
 * product reads as calm and academic rather than consumer-social. Values are
 * picked so that body copy keeps a comfortable contrast ratio on its surface.
 */
export const colors = {
  /** Primary brand accent, used for selection, links and primary actions. */
  accent: "#1F5AE0",
  /** Pressed / emphasized variant of the accent. */
  accentStrong: "#1748B8",
  /** Tinted accent background for chips and selected rows. */
  accentSoft: "#EAF0FE",
  /** Foreground color that is safe on top of `accent`. */
  onAccent: "#FFFFFF",

  /** App background behind all surfaces. */
  background: "#F6F7F9",
  /** Default card / sheet background. */
  surface: "#FFFFFF",
  /** Secondary background for inset areas such as composer inputs. */
  surfaceMuted: "#EEF1F5",
  /** Placeholder blocks while data is loading. */
  skeleton: "#E8EBF0",

  /** Hairline borders and dividers. */
  border: "#E3E7ED",
  /** Borders that need to stay visible on muted surfaces. */
  borderStrong: "#CDD4DE",

  /** Primary reading color. */
  textPrimary: "#131A24",
  /** Supporting copy such as post bodies and metadata. */
  textSecondary: "#4A5464",
  /** The quietest text that is still meant to be read. */
  textMuted: "#6B7686",
  /** Disabled controls. */
  textDisabled: "#9AA4B2",

  /** Positive confirmation. */
  success: "#1B7F5A",
  /** Tinted background for confirmation chips, such as an active membership. */
  successSoft: "#E6F4EE",
  /** Non blocking warning. */
  warning: "#B25E09",
  /** Tinted background for chips that are waiting on something. */
  warningSoft: "#FBF0E1",
  /** Destructive action or failure. */
  danger: "#C0392B",
  /** Tinted background for failure banners and error illustrations. */
  dangerSoft: "#FDECEA",

  /** Scrim value for overlays. */
  overlay: "rgba(19, 26, 36, 0.45)",
  /** Fully transparent, for conditional styling. */
  transparent: "transparent",
} as const;

/** Names of every color token, useful for props that take a token name. */
export type ColorName = keyof typeof colors;
