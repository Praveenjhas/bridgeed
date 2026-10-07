import { useCallback } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { PostDetails } from "@bridgeed/shared";
import {
  AppText,
  Avatar,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  InlineError,
  LoadingState,
  Screen,
  SectionHeading,
} from "@/components";
import {
  CommentComposer,
  CommentRow,
  usePostComments,
  usePostDetails,
} from "@/features/post";
import { useActor } from "@/providers/AuthProvider";
import { useTheme } from "@/theme";
import { formatLongDate } from "@/utils/datetime";

/** The post itself, shown above its conversation. */
function PostBody({ post }: { post: PostDetails }) {
  const { spacing } = useTheme();

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <Avatar
            name={post.author.name}
            imageUrl={post.author.profileImageUrl}
          />
          <View style={{ flex: 1 }}>
            <AppText variant="subheading" numberOfLines={1}>
              {post.author.name}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {`@${post.author.username} · ${post.community.name}`}
            </AppText>
          </View>
        </View>
        <AppText>{post.content}</AppText>
        <Divider />
        <AppText variant="caption" tone="muted">
          {`${post.likeCount} likes · ${post.commentCount} comments · ${formatLongDate(post.createdAt)}`}
        </AppText>
      </View>
    </Card>
  );
}

/**
 * Post detail.
 *
 * It loads the post and its comments separately, because they fail
 * independently: a missing comment page should not hide a post the reader
 * already has, and the composer stays usable while the thread reloads.
 */
export default function PostDetailScreen() {
  const params = useLocalSearchParams();
  const rawPostId = params.postId;
  const postId =
    typeof rawPostId === "string" && rawPostId.length > 0 ? rawPostId : null;

  const { actorId, isConfigured, detail } = useActor();
  const { colors, layout, spacing } = useTheme();
  const details = usePostDetails(postId, actorId);
  const comments = usePostComments(postId, actorId);

  const { refresh: refreshDetails } = details;
  const { refresh: refreshComments } = comments;

  const refreshAll = useCallback(() => {
    refreshDetails();
    refreshComments();
  }, [refreshComments, refreshDetails]);

  const post = details.post;

  if (!isConfigured) {
    return (
      <Screen>
        <EmptyState
          icon="settings-outline"
          title="Tell the app who you are"
          message={detail}
        />
      </Screen>
    );
  }

  if (!post && details.status === "loading") {
    return (
      <Screen>
        <LoadingState label="Loading the post" />
      </Screen>
    );
  }

  if (!post) {
    return (
      <Screen>
        <ErrorState
          message={details.errorMessage ?? "This post could not be loaded."}
          onRetry={refreshDetails}
        />
      </Screen>
    );
  }

  const commentTotal = comments.total ?? post.commentCount;

  return (
    <Screen>
      <FlatList
        data={comments.comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CommentRow comment={item} />}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl
            refreshing={details.isRefreshing || comments.isRefreshing}
            onRefresh={refreshAll}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        contentContainerStyle={{
          padding: layout.screenPadding,
          gap: spacing.lg,
          paddingBottom: spacing.xxl,
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg }}>
            <PostBody post={post} />
            {comments.errorMessage ? (
              <InlineError
                message={comments.errorMessage}
                onRetry={refreshComments}
              />
            ) : null}
            <SectionHeading
              title="Conversation"
              hint={`${commentTotal} ${commentTotal === 1 ? "comment" : "comments"}`}
            />
          </View>
        }
        ListEmptyComponent={
          comments.status === "loading" ? (
            <LoadingState label="Loading comments" />
          ) : (
            <EmptyState
              icon="chatbubble-outline"
              title="No comments yet"
              message="Be the first to reply to this post."
            />
          )
        }
        ListFooterComponent={
          comments.hasMore ? (
            <Button
              label="Load more comments"
              variant="secondary"
              fullWidth
              loading={comments.isLoadingMore}
              onPress={comments.loadMore}
            />
          ) : null
        }
      />
      <View
        style={[
          styles.composerBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            padding: layout.screenPadding,
          },
        ]}
      >
        <CommentComposer
          onSubmit={comments.submit}
          isSubmitting={comments.isSubmitting}
          errorMessage={comments.submitErrorMessage}
          onDismissError={comments.dismissSubmitError}
          disabled={!isConfigured}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  composerBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
