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
 * Placeholder rows for a first load.
 *
 * Showing the shape of the content that is coming keeps the layout stable, so
 * nothing jumps when the data arrives. They are drawn as editorial rows separated
 * by hairlines rather than as a stack of cards, matching the feed and directory
 * they stand in for.
 */
export function SkeletonList({ count, itemHeight, style }: SkeletonListProps) {
  const { colors, layout, radius, spacing } = useTheme();
  const rows = Array.from({ length: count ?? layout.skeletonCards });

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ gap: spacing.lg }, style]}
    >
      {rows.map((_, index) => (
        <View key={index} style={{ gap: spacing.md }}>
          {index > 0 ? (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                width: "100%",
                backgroundColor: colors.borderLight,
              }}
            />
          ) : null}
          <View
            style={[
              styles.row,
              {
                gap: spacing.md,
                minHeight: itemHeight ?? layout.skeletonCardHeight / 1.4,
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
            <View style={{ flex: 1, gap: spacing.sm }}>
              <View
                style={{
                  height: 12,
                  width: "45%",
                  borderRadius: radius.sm,
                  backgroundColor: colors.skeleton,
                }}
              />
              <View
                style={{
                  height: 12,
                  width: "80%",
                  borderRadius: radius.sm,
                  backgroundColor: colors.skeleton,
                }}
              />
              <View
                style={{
                  height: 12,
                  width: "60%",
                  borderRadius: radius.sm,
                  backgroundColor: colors.skeleton,
                }}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
});
