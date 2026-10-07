import { ActivityIndicator, View } from "react-native";
import { AppText } from "@/components";
import { useTheme } from "@/theme";

export interface FeedListFooterProps {
  isLoadingMore: boolean;
  hasMore: boolean;
  /** Number of items currently listed. */
  itemCount: number;
  /** Copy shown while the next page is loading. */
  loadingLabel?: string;
  /** Copy shown once the list is exhausted. */
  endLabel?: string;
}

/**
 * Bottom of a paginated list.
 *
 * It distinguishes "still loading" from "nothing left", because a list that
 * simply stops is indistinguishable from a list that failed to load. The copy is
 * overridable so the same footer can end a feed, a community or a member list
 * without a second implementation.
 */
export function FeedListFooter({
  isLoadingMore,
  hasMore,
  itemCount,
  loadingLabel = "Loading more posts",
  endLabel = "You have reached the end of your feed.",
}: FeedListFooterProps) {
  const { colors, spacing } = useTheme();

  if (isLoadingMore) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          paddingVertical: spacing.xl,
        }}
      >
        <ActivityIndicator size="small" color={colors.accent} />
        <AppText variant="caption" tone="secondary">
          {loadingLabel}
        </AppText>
      </View>
    );
  }

  if (!hasMore && itemCount > 0) {
    return (
      <View style={{ paddingVertical: spacing.xl, alignItems: "center" }}>
        <AppText variant="caption" tone="muted">
          {endLabel}
        </AppText>
      </View>
    );
  }

  return null;
}
