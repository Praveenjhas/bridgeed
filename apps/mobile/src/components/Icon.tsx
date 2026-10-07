import Ionicons from "@expo/vector-icons/Ionicons";
import type { ColorValue } from "react-native";
import { useTheme, type ColorName } from "@/theme";

/** Names of the Ionicons glyphs, so a typo becomes a type error. */
export type IconName = keyof typeof Ionicons.glyphMap;

export interface IconProps {
  name: IconName;
  /** Pixel size. Defaults to the in-row icon size. */
  size?: number;
  /** Semantic color slot. Ignored when `color` is given. */
  tone?: ColorName;
  /** Explicit color, used where a navigator hands one down. */
  color?: ColorValue;
}

/**
 * The only icon component in the app.
 *
 * Routing every icon through it keeps one icon family in use and keeps semantic
 * color names (rather than hex values) at the call site.
 */
export function Icon({ name, size, tone = "textSecondary", color }: IconProps) {
  const { colors, layout } = useTheme();

  return (
    <Ionicons
      name={name}
      size={size ?? layout.icon.md}
      color={color ?? colors[tone]}
    />
  );
}
