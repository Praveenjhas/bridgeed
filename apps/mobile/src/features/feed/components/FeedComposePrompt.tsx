import { Pressable, StyleSheet, View } from "react-native";
import { AppText, Icon } from "@/components";
import { useTheme } from "@/theme";

export interface FeedComposePromptProps {
  onPress: () => void;
}

/**
 * The feed's inline "create post" affordance.
 *
 * It is one quiet editorial row — a shortcut to the composer rather than a card —
 * so the feed opens with a line of invitation instead of a boxed widget. It opens
 * the full composer because a post has to choose a community, which deserves its
 * own screen.
 */
export function FeedComposePrompt({ onPress }: FeedComposePromptProps) {
  const { colors, layout, radius, spacing } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Share something with your community"
      accessibilityHint="Opens the composer to write a post"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          gap: spacing.md,
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
        },
      ]}
    >
      <Icon name="create-outline" size={layout.icon.md} tone="accent" />
      <AppText variant="body" tone="muted" style={styles.text} numberOfLines={1}>
        Share something with your community…
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
  },
});
