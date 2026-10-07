import { StyleSheet, View } from "react-native";
import { AppText } from "@/components";
import { useTheme } from "@/theme";

export interface TagListProps {
  /** Names of the traits, for example skill or interest names. */
  names: string[];
  /** Shown instead of the chips when there is nothing to list. */
  emptyMessage: string;
}

/**
 * A wrapped row of pill labels, used for the skills and interests of a profile.
 *
 * The two lists are the same shape (a name per row), so they share one renderer
 * and differ only in their headings and their empty copy.
 */
export function TagList({ names, emptyMessage }: TagListProps) {
  const { colors, radius, spacing } = useTheme();

  if (names.length === 0) {
    return (
      <AppText variant="caption" tone="muted">
        {emptyMessage}
      </AppText>
    );
  }

  return (
    <View style={[styles.row, { gap: spacing.sm }]}>
      {names.map((name) => (
        <View
          key={name}
          style={{
            backgroundColor: colors.surfaceMuted,
            borderRadius: radius.pill,
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.md,
          }}
        >
          <AppText variant="caption" tone="secondary">
            {name}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
});
