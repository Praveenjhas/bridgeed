import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";
import {
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";

/**
 * The BridgeEd typeface pairing.
 *
 * Headings and names are set in Manrope — a geometric grotesque with a slightly
 * condensed, editorial voice that reads as institutional rather than playful.
 * Body copy and interface text are set in DM Sans, a low-contrast humanist sans
 * built for small sizes. The pairing gives a clear split between "headline" and
 * "reading" text without either face being decorative.
 *
 * Each weight is a separate family here rather than a `fontWeight`: React Native
 * resolves a custom family by exact registered name, and pairing a custom family
 * with a `fontWeight` is unreliable on Android. Weight is therefore encoded in
 * the family, and the type scale below never sets `fontWeight`.
 */
export const fontFamilies = {
  /** Manrope SemiBold — section headings, names, card titles. */
  heading: "Manrope_600SemiBold",
  /** Manrope Bold — display and page titles. */
  headingBold: "Manrope_700Bold",
  /** DM Sans Regular — post bodies, descriptions, comments. */
  body: "DMSans_400Regular",
  /** DM Sans Medium — captions, metadata, small labels. */
  bodyMedium: "DMSans_500Medium",
  /** DM Sans SemiBold — bold body, button labels, form labels. */
  bodySemiBold: "DMSans_600SemiBold",
} as const;

export type FontFamilyToken = keyof typeof fontFamilies;

/**
 * The map handed to `useFonts` at the root of the app.
 *
 * Keys are the family names used everywhere else, so a family name and the asset
 * it loads cannot drift apart. The weights named here are the ones the type scale
 * uses; the Google Fonts packages expose a whole family through a single barrel,
 * so the bundler pulls both complete sets. That is accepted for now — one obvious
 * import surface is worth more than a marginally smaller bundle.
 */
export const fontAssets = {
  Manrope_600SemiBold,
  Manrope_700Bold,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} as const;
