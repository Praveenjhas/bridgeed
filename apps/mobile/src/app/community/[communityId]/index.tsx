import { useCallback, useRef } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import {
  COMMUNITY_MEMBERSHIP_STATUSES,
  COMMUNITY_TYPES,
  type PostListItem,
} from "@bridgeed/shared";
import {
  AppText,
  Button,
  Divider,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SectionHeading,
  SkeletonList,
} from "@/components";
import {
  CommunityMembersPreview,
  CommunityPostComposer,
  MEMBERS_PREVIEW_LIMIT,
  MembershipActions,
  communityTypeLabel,
  describeMembershipStatus,
  formatMemberCount,
  formatPostCount,
  useCommunity,
  useCommunityMembers,
  useCommunityMembership,
  useCommunityPosts,
} from "@/features/communities";
import { FeedListFooter, PostCard } from "@/features/feed";
import { useActor } from "@/providers/AuthProvider";
import { useTheme } from "@/theme";

/**
 * Community detail.
 *
 * One screen shows what the community is, where the reader stands with it, who is
 * in it and what has been posted, in that order, because that is the order of the
 * questions a student has. Posts are a `FlatList` rather than a section inside a
 * `ScrollView`, so an unbounded list stays virtualised.
 *
 * Visibility follows the backend rather than replacing it: the post request is
 * simply not sent until the membership list says the reader is an active member,
 * and a refusal that still arrives (409, 403 or 404) is turned into an
 * explanation instead of an error.
 */
export default function CommunityDetailScreen() {
  const params = useLocalSearchParams();
  const rawCommunityId = params.communityId;
  const communityId =
    typeof rawCommunityId === "string" && rawCommunityId.length > 0
      ? rawCommunityId
      : null;

  const { actorId, isConfigured, detail: actorDetail } = useActor();
  const { colors, layout, spacing } = useTheme();

  const community = useCommunity(communityId);
  const membership = useCommunityMembership(communityId, actorId);
  const detail = community.community;
  const isMember = membership.isMember;
  // A private community hides its roster from everyone else, even though the
  // member endpoint itself would answer: the app does not surface what the
  // community means to keep private.
  const canSeeMembers = isMember || detail?.type === COMMUNITY_TYPES.PUBLIC;
  const members = useCommunityMembers(communityId, {
    enabled: canSeeMembers,
    pageSize: MEMBERS_PREVIEW_LIMIT,
  });
  const posts = useCommunityPosts(communityId, actorId, isMember);
  const listRef = useRef<FlatList<PostListItem>>(null);

  const { refresh: refreshCommunity } = community;
  const { refresh: refreshMembership } = membership;
  const { refresh: refreshMembers } = members;
  const { refresh: refreshPosts, submit } = posts;

  const refreshAll = useCallback(() => {
    refreshCommunity();
    refreshMembership();

    if (canSeeMembers) {
      refreshMembers();
    }

    if (isMember) {
      refreshPosts();
    }
  }, [
    canSeeMembers,
    isMember,
    refreshCommunity,
    refreshMembers,
    refreshMembership,
    refreshPosts,
  ]);

  const openMembers = useCallback(() => {
    if (!communityId) {
      return;
    }

    router.push({
      pathname: "/community/[communityId]/members",
      params: { communityId },
    });
  }, [communityId]);

  const openPost = useCallback((item: PostListItem) => {
    router.push({ pathname: "/post/[postId]", params: { postId: item.id } });
  }, []);

  const handleSubmitPost = useCallback(
    async (content: string) => {
      const created = await submit(content);

      // The list is refreshed from the API by `submit`, so scrolling to the top
      // is what makes the new post visible straight away.
      if (created) {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      }

      return created;
    },
    [submit],
  );

  if (!communityId) {
    return (
      <Screen>
        <EmptyState
          tone="danger"
          icon="link-outline"
          title="This community link is incomplete"
          message="The screen was opened without a community, so there is nothing to show. Go back and pick one from the list."
        />
      </Screen>
    );
  }

  if (!isConfigured) {
    return (
      <Screen>
        <EmptyState
          icon="settings-outline"
          title="Tell the app who you are"
          message={actorDetail}
        />
      </Screen>
    );
  }

  if (!detail && community.status === "loading") {
    return (
      <Screen>
        <LoadingState label="Loading the community" />
      </Screen>
    );
  }

  if (!detail) {
    return (
      <Screen>
        <ErrorState
          message={
            community.errorMessage ?? "This community could not be loaded."
          }
          onRetry={refreshCommunity}
        />
      </Screen>
    );
  }

  const visiblePosts = isMember ? posts.posts : [];
  // 409 is the API's answer for a reader who is not an active member, while 403
  // and 404 cover content the reader may not see at all. All three mean "you are
  // not allowed here", which is a state to explain rather than a failure.
  const isPostsGated =
    posts.errorStatus !== null && [403, 404, 409].includes(posts.errorStatus);

  const postsPlaceholder = (() => {
    if (membership.status === "loading" && !membership.membership) {
      return (
        <LoadingState
          label="Checking your membership"
          // `flex: 0`: inside a list there is no bounded space for a spinner
          // that would otherwise try to fill the screen.
          style={{ flex: 0, paddingVertical: spacing.xxl }}
        />
      );
    }

    if (membership.status === "error" && !membership.membership) {
      return (
        <ErrorState
          message={
            membership.errorMessage ?? "Your membership could not be read."
          }
          onRetry={refreshMembership}
        />
      );
    }

    if (!isMember) {
      if (membership.isBanned) {
        return (
          <EmptyState
            tone="danger"
            icon="ban-outline"
            title="You cannot join this community"
            message={describeMembershipStatus(
              COMMUNITY_MEMBERSHIP_STATUSES.BANNED,
              detail.type,
            )}
          />
        );
      }

      if (membership.isPending) {
        return (
          <EmptyState
            icon="hourglass-outline"
            title="Your request is pending"
            message={describeMembershipStatus(
              COMMUNITY_MEMBERSHIP_STATUSES.PENDING,
              detail.type,
            )}
          />
        );
      }

      if (membership.isRejected) {
        return (
          <EmptyState
            icon="close-circle-outline"
            title="Your request was declined"
            message={describeMembershipStatus(
              COMMUNITY_MEMBERSHIP_STATUSES.REJECTED,
              detail.type,
            )}
          />
        );
      }

      return detail.type === COMMUNITY_TYPES.PRIVATE ? (
        <EmptyState
          icon="lock-closed-outline"
          title="This community is private"
          message="Ask to join and an owner or an admin will review your request. Only members can read and write posts here."
        />
      ) : (
        <EmptyState
          icon="people-outline"
          title="Join to read this community"
          message="Only members can read and write posts here. Use the join button above to get access."
        />
      );
    }

    if (posts.status === "loading" && visiblePosts.length === 0) {
      return (
        <View style={{ paddingTop: spacing.lg }}>
          <SkeletonList count={2} />
        </View>
      );
    }

    if (isPostsGated) {
      return (
        <EmptyState
          icon="lock-closed-outline"
          title="These posts are not available to you"
          message={
            posts.errorMessage ?? "The community did not return its posts."
          }
          action={
            <Button label="Check again" icon="refresh" onPress={refreshPosts} />
          }
        />
      );
    }

    if (posts.status === "error") {
      return (
        <ErrorState
          message={posts.errorMessage ?? "The posts could not be loaded."}
          onRetry={refreshPosts}
        />
      );
    }

    return (
      <EmptyState
        icon="newspaper-outline"
        title="No posts yet"
        message="Nothing has been posted in this community. Write the first post with the composer below."
      />
    );
  })();

  // "IIT Mandi · B.Tech Mechanical Engineering · Thermodynamics", dropping the
  // parts this community does not name. Empty when it has no academic context,
  // which is the case for every community created before the academic graph.
  const academicContextLine = [
    detail.academicContext.university?.name ?? null,
    detail.academicContext.program?.name ?? null,
    detail.academicContext.subject?.name ?? null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  const communityHeader = (
    <View style={{ gap: spacing.lg }}>
      {/* The community's identity, laid out flat like a masthead rather than a
          giant hero card: name, the facts, then the one membership action. */}
      <View style={{ gap: spacing.md }}>
        <AppText variant="title">{detail.name}</AppText>

        <AppText variant="caption" tone="muted">
          {[
            communityTypeLabel(detail.type),
            canSeeMembers && members.total !== null
              ? formatMemberCount(members.total)
              : null,
          ]
            .filter((part): part is string => part !== null)
            .join(" · ")}
        </AppText>

        {detail.description ? (
          <AppText tone="secondary">{detail.description}</AppText>
        ) : null}

        {academicContextLine.length > 0 ? (
          <View style={{ gap: spacing.xxs }}>
            <AppText variant="label" tone="accent">
              Academic context
            </AppText>
            <AppText variant="caption" tone="secondary">
              {academicContextLine}
            </AppText>
          </View>
        ) : null}

        <Divider spacing="sm" />

        <MembershipActions
          communityType={detail.type}
          membership={membership.membership}
          isChecking={membership.status === "loading" && !membership.membership}
          readErrorMessage={
            membership.status === "error" && !membership.membership
              ? membership.errorMessage
              : null
          }
          onRetryRead={refreshMembership}
          canRequestJoin={membership.canRequestJoin}
          canLeave={membership.canLeave}
          isActionPending={membership.isActionPending}
          actionErrorMessage={membership.actionErrorMessage}
          onDismissActionError={membership.dismissActionError}
          onJoin={membership.join}
          onLeave={membership.leave}
        />
      </View>

      {canSeeMembers ? (
        <CommunityMembersPreview
          members={members.members}
          total={members.total}
          onSeeAll={openMembers}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          <SectionHeading title="Members" />
          <AppText variant="caption" tone="muted">
            This community is private, so its member list is only visible to its
            members.
          </AppText>
        </View>
      )}

      <SectionHeading
        title="Posts"
        hint={
          isMember
            ? posts.total !== null
              ? `${formatPostCount(posts.total)} · newest first`
              : "Newest first"
            : "Members only"
        }
      />
    </View>
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: detail.name }} />
      <FlatList
        ref={listRef}
        data={visiblePosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard item={item} variant="flat" onOpen={openPost} />
        )}
        initialNumToRender={4}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        onEndReached={posts.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={
              community.isRefreshing ||
              membership.isRefreshing ||
              members.isRefreshing ||
              posts.isRefreshing
            }
            onRefresh={refreshAll}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListHeaderComponent={communityHeader}
        ListEmptyComponent={postsPlaceholder}
        ListFooterComponent={
          <FeedListFooter
            isLoadingMore={posts.isLoadingMore}
            hasMore={posts.hasMore}
            itemCount={visiblePosts.length}
            loadingLabel="Loading more posts"
            endLabel={`You have reached the end of ${detail.name}.`}
          />
        }
        // Posts share the screen gutter and are separated by a hairline, so the
        // community reads as one column: identity, then discussion.
        ItemSeparatorComponent={() => <Divider />}
        contentContainerStyle={{
          padding: layout.screenPadding,
          paddingBottom: spacing.xxl,
        }}
      />

      {isMember ? (
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
          <CommunityPostComposer
            communityName={detail.name}
            isSubmitting={posts.isSubmitting}
            errorMessage={posts.submitErrorMessage}
            onDismissError={posts.dismissSubmitError}
            onSubmit={handleSubmitPost}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    flex: 1,
  },
  composerBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
