import type { TextStyle } from "react-native";
import { fontFamilies } from "./fonts";

/**
 * Type scale — "Campus Editorial".
 *
 * Sizes are absolute numbers because React Native has no cascade: a token is
 * spread into a `Text` style, so it has to carry everything that matters
 * (family, size, line height, tracking). Line heights are sized for reading, not
 * for fitting as much text as possible.
 *
 * Hierarchy is carried by family, size, weight and space — never by badges or
 * uppercase decoration. Headings are Manrope, reading and interface text is DM
 * Sans. No token sets `fontWeight`: weight lives in the family name (see
 * `fonts.ts`).
 *
 * The names read as: display = Display, title = H1, heading = H2,
 * subheading = H3, body/bodyStrong = Body, caption = Caption/Body Small,
 * overline = Label, button = Button.
 */
export const typography = {
  /** 32 — the largest statement, used on auth and entry surfaces. */
  display: {
    fontFamily: fontFamilies.headingBold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.6,
  },
  /** 28 — a screen title that owns a header. */
  title: {
    fontFamily: fontFamilies.headingBold,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  /** 22 — a large section title. */
  heading: {
    fontFamily: fontFamilies.headingBold,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.4,
  },
  /** 18 — a section heading, and the name on an identity row. */
  subheading: {
    fontFamily: fontFamilies.headingBold,
    fontSize: 18,
    lineHeight: 25,
    letterSpacing: -0.2,
  },
  /** 15.5 — default reading size for post bodies and comments. */
  body: { fontFamily: fontFamilies.body, fontSize: 15.5, lineHeight: 24 },
  /** 15.5 — body copy that needs emphasis without changing size. */
  bodyStrong: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 15.5,
    lineHeight: 24,
  },
  /** 13 — metadata: timestamps, counts and helper text. */
  caption: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
  },
  /** 12 — a small label without uppercase decoration. */
  overline: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  /** 12 — a form label or a very small tag. */
  label: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  /** 15 — the label inside a button. */
  button: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;

