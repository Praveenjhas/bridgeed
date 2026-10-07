import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme, type ColorName } from "@/theme";

export interface ScreenProps {
  children: ReactNode;
  /** Background slot. Defaults to the app background. */
  background?: ColorName;
  /** Applies the standard horizontal gutter. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Root container of a screen.
 *
 * It owns the background and the horizontal gutter so screens do not each invent
 * their own, and so content can sit edge to edge when a list needs that (pass
 * `padded={false}` and pad the list content instead).
 *
 * Safe area handling is intentionally left to the header and to list content
 * insets: a container that consumes insets would make a sticky header impossible
 * to align with its own top padding.
 */
export function Screen({
  children,
  background = "background",
  padded = false,
  style,
}: ScreenProps) {
  const { colors, layout } = useTheme();

  return (
    <View
      style={[
        { flex: 1, backgroundColor: colors[background] },
        padded ? { paddingHorizontal: layout.screenPadding } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
