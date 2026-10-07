import { View } from "react-native";
import { AppText, Icon } from "@/components";
import { useTheme } from "@/theme";
import { formatRelativeTime } from "@/utils/datetime";
import type { FeedPageMeta } from "../hooks/useFeed";

export interface FeedSummaryProps {
  meta: FeedPageMeta;
}

/**
 * One line that explains where the feed came from.
 *
 * The feed endpoint reports how many candidates it ranked and when it generated
 * the page. Showing that makes ranking behaviour visible while the product is
 * young, and it is the fastest way to notice that, for example, the actor has no
 * community memberships and the ranking is running on almost nothing.
 */
export function FeedSummary({ meta }: FeedSummaryProps) {
  const { colors, layout, radius, spacing } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
      }}
    >
      <Icon name="sparkles-outline" size={layout.icon.sm} tone="accent" />
      <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
        {`Ranked from ${meta.candidatesConsidered} candidates · updated ${formatRelativeTime(meta.generatedAt)}`}
      </AppText>
    </View>
  );
}
