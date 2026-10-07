import { Image, View } from "react-native";
import { AppText } from "./AppText";
import { useTheme } from "@/theme";

export type AvatarSize = "sm" | "md" | "lg";

export interface AvatarProps {
  /** Display name. Its initials are used when there is no picture. */
  name: string;
  imageUrl?: string | null;
  size?: AvatarSize;
}

const INITIAL_FONT_SIZE: Record<AvatarSize, number> = {
  sm: 12,
  md: 14,
  lg: 17,
};

/** Two letters at most, so an avatar never looks crowded. */
export function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return "?";
  }

  const first = parts[0]?.charAt(0) ?? "";
  const last =
    parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";

  return `${first}${last}`.toUpperCase();
}

/**
 * Author avatar.
 *
 * Students appear without profile pictures often, so the fallback is a designed
 * state: initials on a tinted accent background, not a broken image.
 */
export function Avatar({ name, imageUrl, size = "md" }: AvatarProps) {
  const { colors, layout, radius } = useTheme();
  const dimension = layout.avatar[size];
  // A plain object rather than a typed style, because the same shape has to be
  // valid for both `Image` and `View`.
  const shape = {
    width: dimension,
    height: dimension,
    borderRadius: radius.pill,
  };

  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={shape} />;
  }

  return (
    <View
      style={[
        shape,
        {
          backgroundColor: colors.accentSoft,
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      <AppText
        tone="accent"
        style={{ fontSize: INITIAL_FONT_SIZE[size], fontWeight: "600" }}
      >
        {initialsOf(name)}
      </AppText>
    </View>
  );
}
