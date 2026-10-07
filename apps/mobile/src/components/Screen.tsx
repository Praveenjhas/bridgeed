import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type ColorName } from "@/theme";

export interface ScreenProps {
  children: ReactNode;
  /** Background slot. Defaults to the app background. */
  background?: ColorName;
  /** Applies the standard horizontal gutter. */
  padded?: boolean;
  /**
   * Adds the device's top safe area inset as padding.
   *
   * Off by default, because a screen whose first child is a `PageHeader` already
   * receives the inset from it and would otherwise be padded twice. The
   * credential screens turn it on: they have no header at all, so nothing else
   * would keep their content off the status bar.
   */
  safeTop?: boolean;
  /** Adds the device's bottom safe area inset as padding. */
  safeBottom?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Root container of a screen.
 *
 * It owns the background and the horizontal gutter so screens do not each invent
 * their own, and so content can sit edge to edge when a list needs that (pass
 * `padded={false}` and pad the list content instead).
 *
 * Vertical safe area handling is opt in rather than automatic: a container that
 * always consumed the insets would make a sticky header impossible to align with
 * its own top padding, which is why the header owns the top edge on the scrolling
 * screens and `safeTop` exists for the screens that have no header.
 */
export function Screen({
  children,
  background = "background",
  padded = false,
  safeTop = false,
  safeBottom = false,
  style,
}: ScreenProps) {
  const { colors, layout } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        { flex: 1, backgroundColor: colors[background] },
        padded ? { paddingHorizontal: layout.screenPadding } : null,
        safeTop ? { paddingTop: insets.top } : null,
        safeBottom ? { paddingBottom: insets.bottom } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
