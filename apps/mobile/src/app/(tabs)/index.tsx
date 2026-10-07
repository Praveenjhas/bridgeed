import { useCallback, useMemo } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { router } from "expo-router";
import type { FeedItem } from "@bridgeed/shared";
import {
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  InlineError,
  PageHeader,
  Screen,
  SkeletonList,
} from "@/components";
import { resolveApiBaseUrl } from "@/config/env";
import {
  FeedComposePrompt,
  FeedListFooter,
  FeedSummary,
  PostCard,
  useFeed,
} from "@/features/feed";
import { useActor } from "@/providers/AuthProvider";
import { useTheme } from "@/theme";

/**
 * Home screen: the ranked feed.
 *
 * The screen owns nothing but presentation and navigation. Everything about
 * loading, refreshing, paginating and reacting lives in `useFeed`, so the same
 * behaviour is testable and reusable outside a rendered screen.
 */
export default function FeedScreen() {
  const { colors, layout, spacing } = useTheme();
  const { actorId, isConfigured, detail: actorDetail } = useActor();
  const api = useMemo(() => resolveApiBaseUrl(), []);
  const feed = useFeed(actorId);

  const openPost = useCallback((item: FeedItem) => {
    router.push({ pathname: "/post/[postId]", params: { postId: item.id } });
  }, []);

  const openCreatePost = useCallback(() => {
    router.push("/create-post");
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => (
      <PostCard
        item={item}
        onOpen={openPost}
        onToggleLike={feed.toggleLike}
        isLikePending={feed.pendingLikeIds.has(item.id)}
      />
    ),
    [feed.pendingLikeIds, feed.toggleLike, openPost],
  );

  const header = (
    <PageHeader
      title="Feed"
      subtitle="Ranked from your communities, connections and skills"
      showWordmark
      actions={
        <>
          <IconButton
            icon="add"
            accessibilityLabel="Create a post"
            onPress={openCreatePost}
          />
          <IconButton
            icon="refresh"
            accessibilityLabel="Refresh the feed"
            onPress={feed.refresh}
            disabled={feed.isRefreshing}
          />
        </>
      }
    />
  );

  if (!isConfigured) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon="settings-outline"
          title="Tell the app who you are"
          message={
            api.baseUrl ? actorDetail : `${actorDetail}\n\n${api.detail}`
          }
        />
      </Screen>
    );
  }

  if (feed.items.length === 0 && feed.status === "loading") {
    return (
      <Screen>
        {header}
        <View style={{ flex: 1, padding: layout.screenPadding }}>
          <SkeletonList />
        </View>
      </Screen>
    );
  }

  if (feed.items.length === 0 && feed.status === "error") {
    return (
      <Screen>
        {header}
        <ErrorState
          message={feed.errorMessage ?? "The feed could not be loaded."}
          onRetry={feed.refresh}
        />
      </Screen>
    );
  }

  if (feed.items.length === 0) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon="newspaper-outline"
          title="Nothing in your feed yet"
          message="The feed is built from the communities you belong to, your connections and your skills. Join a community or add a connection, then refresh."
          action={
            <View style={{ gap: spacing.sm }}>
              <Button
                label="Create a post"
                icon="add"
                onPress={openCreatePost}
              />
              <Button
                label="Refresh"
                icon="refresh"
                variant="secondary"
                onPress={feed.refresh}
              />
            </View>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      <FlatList
        data={feed.items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        initialNumToRender={4}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefreshing}
            onRefresh={feed.refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: layout.listGap }}>
            <FeedComposePrompt onPress={openCreatePost} />
            {feed.pageMeta ? <FeedSummary meta={feed.pageMeta} /> : null}
            {feed.actionErrorMessage ? (
              <InlineError
                message={feed.actionErrorMessage}
                onDismiss={feed.dismissActionError}
              />
            ) : null}
          </View>
        }
        ListFooterComponent={
          <FeedListFooter
            isLoadingMore={feed.isLoadingMore}
            hasMore={feed.hasMore}
            itemCount={feed.items.length}
          />
        }
        contentContainerStyle={{
          padding: layout.screenPadding,
          gap: layout.listGap,
          paddingBottom: spacing.xxxl,
        }}
      />
    </Screen>
  );
}
