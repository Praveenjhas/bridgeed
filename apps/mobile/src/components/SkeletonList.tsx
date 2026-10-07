import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";

export interface SkeletonListProps {
  /** Number of placeholder cards. Defaults to the shared layout constant. */
  count?: number;
  /** Height of each placeholder. */
  itemHeight?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Placeholder cards for a first load.
 *
 * Showing the shape of the content that is coming keeps the layout stable, so
 * nothing jumps when the data arrives.
 */
export function SkeletonList({ count, itemHeight, style }: SkeletonListProps) {
  const { colors, layout, radius, shadows, spacing } = useTheme();
  const cards = Array.from({ length: count ?? layout.skeletonCards });

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ gap: layout.listGap }, style]}
    >
      {cards.map((_, index) => (
        <View
          key={index}
          style={[
            shadows.card,
            {
              height: itemHeight ?? layout.skeletonCardHeight,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: radius.lg,
              padding: spacing.lg,
              gap: spacing.md,
            },
          ]}
        >
          <View
            style={{
              height: layout.avatar.md,
              width: layout.avatar.md,
              borderRadius: radius.pill,
              backgroundColor: colors.skeleton,
            }}
          />
          <View
            style={{
              height: 12,
              width: "70%",
              borderRadius: radius.sm,
              backgroundColor: colors.skeleton,
            }}
          />
          <View
            style={{
              height: 12,
              width: "45%",
              borderRadius: radius.sm,
              backgroundColor: colors.skeleton,
            }}
          />
        </View>
      ))}
    </View>
  );
}
