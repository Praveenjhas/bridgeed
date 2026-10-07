import type { TextStyle } from "react-native";

/**
 * Type scale.
 *
 * Sizes are absolute numbers because React Native has no cascade: a token is
 * spread into a `Text` style, so it has to carry everything that matters
 * (size, line height, weight). Line heights are sized for reading, not for
 * fitting as much text as possible.
 */
export const typography = {
  /** 28 — screen titles that own the whole header. */
  display: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  /** 22 — page titles inside a scrolling screen. */
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
  /** 17 — card titles and section headers. */
  heading: { fontSize: 17, lineHeight: 23, fontWeight: "600" },
  /** 15 — emphasized labels and author names. */
  subheading: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  /** 15 — default reading size for post bodies and comments. */
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  /** 15 — body copy that needs emphasis without changing size. */
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
  /** 13 — metadata: timestamps, counts and helper text. */
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
  /** 11 — the small uppercase labels above grouped data. */
  overline: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;
