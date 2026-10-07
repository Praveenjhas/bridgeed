import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import {
  FEED_REASON_CODES,
  type ContentAuthor,
  type FeedReasonCode,
} from "@bridgeed/shared";
import { AppText, Avatar, Card, Icon, type IconName } from "@/components";
import { useTheme } from "@/theme";
import { formatRelativeTime } from "@/utils/datetime";

/** Short, human labels for the ranking reasons the API reports. */
const REASON_LABELS: Record<FeedReasonCode, string> = {
  [FEED_REASON_CODES.AUTHORED_BY_ME]: "yours",
  [FEED_REASON_CODES.ALREADY_ENGAGED]: "you engaged",
  [FEED_REASON_CODES.FROM_CONNECTION]: "connection",
  [FEED_REASON_CODES.SHARED_SKILL]: "shared skill",
  [FEED_REASON_CODES.SHARED_INTEREST]: "shared interest",
  [FEED_REASON_CODES.IN_MY_COMMUNITY]: "your community",
  [FEED_REASON_CODES.POPULAR]: "popular",
  [FEED_REASON_CODES.RECENT]: "recent",
};

/** How many reasons are shown before the list is summarised. */
const MAX_VISIBLE_REASONS = 3;

interface PostActionProps {
  icon: IconName;
  label: string;
  accessibilityLabel: string;
  /**
   * Omitted when the listing cannot report this action's state, which turns the
   * element into a plain statistic instead of a toggle that would be guessing.
   */
  onPress?: () => void;
  isActive?: boolean;
  isPending?: boolean;
  /** Glyph used when the action is active, for example a filled heart. */
  activeIcon?: IconName;
}

function PostAction({
  icon,
  activeIcon,
  label,
  accessibilityLabel,
  onPress,
  isActive = false,
  isPending = false,
}: PostActionProps) {
  const { colors, layout, radius, spacing } = useTheme();
  const tone = isActive ? "accent" : "textMuted";

  const content = (
    <>
      {isPending ? (
        <ActivityIndicator size="small" color={colors.textMuted} />
      ) : (
        <Icon
          name={isActive ? (activeIcon ?? icon) : icon}
          size={layout.icon.md}
          tone={tone}
        />
      )}
      <AppText variant="caption" tone={isActive ? "accent" : "muted"}>
        {label}
      </AppText>
    </>
  );

  const layoutStyle = [
    styles.action,
    {
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingRight: spacing.lg,
      borderRadius: radius.sm,
    },
  ];

  if (!onPress) {
    return <View style={layoutStyle}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isActive, busy: isPending }}
      disabled={isPending}
      onPress={onPress}
      style={({ pressed }) => [
        layoutStyle,
        { opacity: pressed ? 0.6 : 1 },
        isPending ? { opacity: 0.6 } : null,
      ]}
    >
      {content}
    </Pressable>
  );
}

/**
 * The part of a post this card renders.
 *
 * It is a view model rather than one backend contract, because the card is used
 * by two listings that return different payloads: the ranked feed, which reports
 * ranking metadata and the reader's like, and a community listing, which reports
 * neither. Everything optional below is genuinely absent from the community
 * listing, so the card hides it instead of inventing a value.
 */
export interface PostCardItem {
  id: string;
  content: string;
  createdAt: string;
  author: ContentAuthor;
  likeCount: number;
  commentCount: number;
  /** True when the reader already liked the post. Feed items only. */
  hasReacted?: boolean;
  /** One based rank inside the page. Feed items only. */
  rank?: number;
  /** Ranking reasons. Feed items only. */
  reasons?: readonly FeedReasonCode[];
  /** Community the post belongs to. Feed items only. */
  community?: { name: string } | null;
}

export interface PostCardProps<Item extends PostCardItem> {
  item: Item;
  /** Opens the post and its comments. */
  onOpen: (item: Item) => void;
  /**
   * Toggles the actor's like on this post. Omit it when the listing does not
   * report whether the reader already liked the post: the card then shows the
   * like count as a plain number.
   */
  onToggleLike?: (item: Item) => void;
  /** True while this post's like request is in flight. */
  isLikePending?: boolean;
  /** Hides the ranking line, for screens where the feed score is irrelevant. */
  showRanking?: boolean;
  /**
   * `card` (default) boxes the post on its own surface; `flat` drops the card
   * chrome so consecutive posts can be separated by a divider instead, which is
   * how the feed and a community's posts read as one editorial column.
   */
  variant?: "card" | "flat";
}

/**
 * One post in a listing.
 *
 * The card renders exactly what the listing returns, including the ranking
 * explanation when there is one, so it is obvious why a post is in front of the
 * reader instead of that logic being invisible.
 */
export function PostCard<Item extends PostCardItem>({
  item,
  onOpen,
  onToggleLike,
  isLikePending = false,
  showRanking = true,
  variant = "flat",
}: PostCardProps<Item>) {
  const { colors, spacing } = useTheme();
  const isLiked = item.hasReacted === true;
  const communityName = item.community?.name ?? null;
  const visibleReasons = (item.reasons ?? [])
    .slice(0, MAX_VISIBLE_REASONS)
    .map((reason) => REASON_LABELS[reason] ?? reason);
  const metaParts = [
    communityName ?? `@${item.author.username}`,
    formatRelativeTime(item.createdAt),
  ];

  const accessibilityLabel = communityName
    ? `Post by ${item.author.name} in ${communityName}`
    : `Post by ${item.author.name}`;

  const body = (
    <View style={{ gap: spacing.sm }}>
        <View style={[styles.header, { gap: spacing.md }]}>
          <Avatar
            name={item.author.name}
            imageUrl={item.author.profileImageUrl}
          />
          <View style={styles.headerText}>
            <AppText variant="subheading" numberOfLines={1}>
              {item.author.name}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {metaParts.join(" · ")}
            </AppText>
          </View>
          {showRanking && typeof item.rank === "number" ? (
            <AppText variant="caption" tone="muted">
              {`#${item.rank}`}
            </AppText>
          ) : null}
        </View>

        <AppText>{item.content}</AppText>

      {showRanking && visibleReasons.length > 0 ? (
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {`Ranked for you · ${visibleReasons.join(", ")}`}
        </AppText>
      ) : null}

      <View style={[styles.footer, { marginTop: spacing.xxs }]}>
        <PostAction
          icon="heart-outline"
          activeIcon="heart"
          label={String(item.likeCount)}
          isActive={isLiked}
          isPending={isLikePending}
          accessibilityLabel={
            isLiked
              ? `Remove your like, ${item.likeCount} likes`
              : `Like this post, ${item.likeCount} likes`
          }
          onPress={onToggleLike ? () => onToggleLike(item) : undefined}
        />
        <PostAction
          icon="chatbubble-outline"
          label={String(item.commentCount)}
          accessibilityLabel={`Open ${item.commentCount} comments`}
          onPress={() => onOpen(item)}
        />
      </View>
    </View>
  );

  // The flat form is the default for the feed and a community's posts, where
  // items are separated by a divider rather than each boxed in its own card. It
  // keeps the post as the unit of content and lets type, colour and space work.
  if (variant === "flat") {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Opens the post and its comments"
        onPress={() => onOpen(item)}
        style={({ pressed }) => ({
          gap: spacing.md,
          // Vertical only: the list already applies the screen gutter, so the
          // post's content lines up with the header above it.
          paddingVertical: spacing.lg,
          backgroundColor: pressed ? colors.surfaceMuted : colors.transparent,
        })}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <Card
      onPress={() => onOpen(item)}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens the post and its comments"
    >
      {body}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
  },
  spacer: {
    flex: 1,
  },
});
