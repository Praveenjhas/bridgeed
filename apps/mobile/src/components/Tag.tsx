import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { useTheme } from "@/theme";

export interface TagProps {
  /** The tag's text, for example a skill or interest name. */
  label: string;
  /**
   * Emphasises the tag in the brand colour. Used for a chosen skill or interest,
   * never for decoration.
   */
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * One skill or interest, as a small outlined tag.
 *
 * A tag looks like a tag: a thin outline, a small radius and normal-case text. It
 * is deliberately quiet — a screen full of filled, saturated pills is the visual
 * noise the editorial direction removes — and a tag is the only thing in the
 * product that is allowed to be pill-like at all.
 */
export function Tag({ label, selected = false, style }: TagProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          borderColor: selected ? colors.accent : colors.border,
          backgroundColor: selected ? colors.accentSoft : colors.transparent,
          borderRadius: radius.pill,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.md,
        },
        style,
      ]}
    >
      <AppText variant="caption" tone={selected ? "accent" : "secondary"}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
