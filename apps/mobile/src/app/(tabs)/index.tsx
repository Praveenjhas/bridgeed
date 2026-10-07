import { useCallback, useMemo } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FeedItem } from "@bridgeed/shared";
import {
  AppText,
  Avatar,
  BrandWordmark,
  Button,
  Divider,
  EmptyState,
  ErrorState,
  IconButton,
  InlineError,
  Screen,
  SectionHeading,
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
import { useStudentProfileStatus } from "@/providers/StudentProfileProvider";
import { useTheme } from "@/theme";

/** A time-of-day greeting, so the top of the feed says hello like a person. */
function greetingFor(date: Date): string {
  const hour = date.getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

/**
 * Home screen: the ranked feed.
 *
 * The screen owns nothing but presentation and navigation. Everything about
 * loading, refreshing, paginating and reacting lives in `useFeed`, so the same
 * behaviour is testable and reusable outside a rendered screen.
 */
export default function FeedScreen() {
  const { colors, layout, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { actorId, isConfigured, detail: actorDetail } = useActor();
  const { profile } = useStudentProfileStatus();
  const api = useMemo(() => resolveApiBaseUrl(), []);
  const feed = useFeed(actorId);

  const firstName = profile?.name.trim().split(/\s+/)[0] ?? "there";
  const greeting = greetingFor(new Date());

  const openPost = useCallback((item: FeedItem) => {
    router.push({ pathname: "/post/[postId]", params: { postId: item.id } });
  }, []);

  const openCreatePost = useCallback(() => {
    router.push("/create-post");
  }, []);

  const openProfile = useCallback(() => {
    router.push("/(tabs)/profile");
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => (
      <PostCard
        item={item}
        variant="flat"
        onOpen={openPost}
        onToggleLike={feed.toggleLike}
        isLikePending={feed.pendingLikeIds.has(item.id)}
      />
    ),
    [feed.pendingLikeIds, feed.toggleLike, openPost],
  );

  // The home header is an editorial masthead: the wordmark and the reader's own
  // face, then a greeting and the question the composer answers. No page title
  // and no bar, so the feed opens like the front of a publication.
  const header = (
    <View
      style={{
        paddingTop: insets.top + spacing.lg,
        paddingHorizontal: layout.screenPadding,
        gap: spacing.xl,
      }}
    >
      <View style={styles.masthead}>
        <BrandWordmark size="md" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
          onPress={openProfile}
          hitSlop={spacing.sm}
        >
          <Avatar
            name={profile?.name ?? "You"}
            imageUrl={profile?.profileImageUrl}
            size="md"
          />
        </Pressable>
      </View>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">{`${greeting}, ${firstName}`}</AppText>
        <AppText variant="body" tone="secondary">
          What&apos;s happening on campus?
        </AppText>
      </View>
    </View>
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
          <View style={{ gap: spacing.lg }}>
            <FeedComposePrompt onPress={openCreatePost} />
            {feed.pageMeta ? <FeedSummary meta={feed.pageMeta} /> : null}
            {feed.actionErrorMessage ? (
              <InlineError
                message={feed.actionErrorMessage}
                onDismiss={feed.dismissActionError}
              />
            ) : null}
            <SectionHeading
              title="Your feed"
              action={
                <IconButton
                  icon="refresh"
                  accessibilityLabel="Refresh the feed"
                  onPress={feed.refresh}
                  disabled={feed.isRefreshing}
                />
              }
            />
          </View>
        }
        ListFooterComponent={
          <FeedListFooter
            isLoadingMore={feed.isLoadingMore}
            hasMore={feed.hasMore}
            itemCount={feed.items.length}
          />
        }
        // Posts are separated by a hairline rather than by a gap between cards,
        // so the feed reads as one continuous editorial column.
        ItemSeparatorComponent={() => <Divider />}
        contentContainerStyle={{
          padding: layout.screenPadding,
          paddingBottom: spacing.xxxl,
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  masthead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
