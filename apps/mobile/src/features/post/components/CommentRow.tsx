import { View } from "react-native";
import type { CommentListItem } from "@bridgeed/shared";
import { AppText, Avatar, Icon } from "@/components";
import { useTheme } from "@/theme";
import { formatRelativeTime } from "@/utils/datetime";

export interface CommentRowProps {
  comment: CommentListItem;
}

/**
 * One comment in a thread.
 *
 * The like count is shown as a plain number rather than as a button: the comment
 * listing does not report whether the reading student liked a comment, so a
 * toggle would be guessing at the state. Making it a button later needs the API
 * to return that flag first.
 */
export function CommentRow({ comment }: CommentRowProps) {
  const { layout, spacing } = useTheme();

  return (
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      <Avatar
        name={comment.author.name}
        imageUrl={comment.author.profileImageUrl}
        size="sm"
      />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <AppText variant="caption" tone="secondary" numberOfLines={1}>
          {`${comment.author.name} · ${formatRelativeTime(comment.createdAt)}`}
        </AppText>
        <AppText variant="body">{comment.content}</AppText>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
          }}
        >
          <Icon name="heart-outline" size={layout.icon.sm} tone="textMuted" />
          <AppText variant="caption" tone="muted">
            {String(comment.likeCount)}
          </AppText>
        </View>
      </View>
    </View>
  );
}
