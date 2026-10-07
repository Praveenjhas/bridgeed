import { StyleSheet, View } from "react-native";
import { AppText, Tag } from "@/components";
import { useTheme } from "@/theme";

export interface TagListProps {
  /** Names of the traits, for example skill or interest names. */
  names: string[];
  /** Shown instead of the tags when there is nothing to list. */
  emptyMessage: string;
}

/**
 * A wrapped row of tags, used for the skills and interests of a profile.
 *
 * The two lists are the same shape (a name per row), so they share one renderer
 * and differ only in their headings and their empty copy. Each item is the shared
 * `Tag` primitive, so a skill always looks like a skill.
 */
export function TagList({ names, emptyMessage }: TagListProps) {
  const { spacing } = useTheme();

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
        <Tag key={name} label={name} />
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
