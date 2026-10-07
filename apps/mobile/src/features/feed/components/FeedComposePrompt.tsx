import { StyleSheet, View } from "react-native";
import { AppText, Card, Icon } from "@/components";
import { useTheme } from "@/theme";

export interface FeedComposePromptProps {
  onPress: () => void;
}

/**
 * The feed's inline "create post" affordance.
 *
 * It sits at the top of the feed so writing something is the first thing on
 * offer, and it opens the composer rather than writing inline: a post has to
 * choose a community, which deserves a full screen instead of a widget squeezed
 * between cards. It is a card, so it reads as a place to put something rather
 * than as a statistic.
 */
export function FeedComposePrompt({ onPress }: FeedComposePromptProps) {
  const { colors, layout, radius, spacing } = useTheme();

  return (
    <Card
      onPress={onPress}
      accessibilityLabel="Create a post"
      accessibilityHint="Opens the composer to write a post"
    >
      <View style={[styles.row, { gap: spacing.md }]}>
        <View
          style={[
            styles.icon,
            {
              backgroundColor: colors.accentSoft,
              borderRadius: radius.pill,
              width: layout.icon.lg * 2,
              height: layout.icon.lg * 2,
            },
          ]}
        >
          <Icon name="create-outline" size={layout.icon.md} tone="accent" />
        </View>
        <View style={styles.text}>
          <AppText variant="bodyStrong">Share something</AppText>
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            Ask a question, share a resource, or start a study discussion with
            your communities.
          </AppText>
        </View>
        <Icon name="add-circle" size={layout.icon.lg} tone="accent" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
  },
});
