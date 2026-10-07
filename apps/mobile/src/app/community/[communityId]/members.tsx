import { useCallback } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  COMMUNITY_MEMBERSHIP_STATUSES,
  COMMUNITY_TYPES,
  type CommunityMember,
} from "@bridgeed/shared";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SectionHeading,
  SkeletonList,
} from "@/components";
import {
  MEMBERS_PAGE_LIMIT,
  JoinRequestsCard,
  MemberRow,
  formatMemberCount,
  useCommunity,
  useCommunityMembers,
  useCommunityMembership,
  useMembershipRequestActions,
} from "@/features/communities";
import { FeedListFooter } from "@/features/feed";
import { useActor } from "@/providers/ActorProvider";
import { useTheme } from "@/theme";

/**
 * The member list of a community.
 *
 * It carries two jobs: showing who is here, and — for an owner or an admin — the
 * join requests that decide who gets in next. Both are the same paged endpoint
 * with a different status filter, so they share one hook rather than one screen
 * each.
 *
 * A private community's roster is only shown to its members. The endpoint itself
 * would answer for anybody, but an app that surfaces a private community's
 * members to outsiders has leaked it regardless of what the API allows.
 */
export default function CommunityMembersScreen() {
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
  const canSeeMembers =
    membership.isMember || detail?.type === COMMUNITY_TYPES.PUBLIC;
  const canManageMembers = membership.canManageMembers;

  const members = useCommunityMembers(communityId, {
    enabled: canSeeMembers,
    pageSize: MEMBERS_PAGE_LIMIT,
  });
  const requests = useCommunityMembers(communityId, {
    status: COMMUNITY_MEMBERSHIP_STATUSES.PENDING,
    enabled: canManageMembers,
    pageSize: MEMBERS_PAGE_LIMIT,
  });
  const decisions = useMembershipRequestActions({
    actorId,
    onDecided: requests.refresh,
  });

  const { refresh: refreshCommunity } = community;
  const { refresh: refreshMembership } = membership;
  const { refresh: refreshMembers } = members;
  const { refresh: refreshRequests } = requests;

  const refreshAll = useCallback(() => {
    refreshCommunity();
    refreshMembership();

    if (canSeeMembers) {
      refreshMembers();
    }

    if (canManageMembers) {
      refreshRequests();
    }
  }, [
    canManageMembers,
    canSeeMembers,
    refreshCommunity,
    refreshMembers,
    refreshMembership,
    refreshRequests,
  ]);

  if (!communityId) {
    return (
      <Screen>
        <EmptyState
          tone="danger"
          icon="link-outline"
          title="This member list is incomplete"
          message="The screen was opened without a community, so there is nobody to show."
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

  if (!canSeeMembers) {
    return (
      <Screen>
        <EmptyState
          icon="lock-closed-outline"
          title="Members are visible to members only"
          message={`${detail.name} is a private community, so who belongs to it is only shown to its members.`}
          action={
            <Button
              label="Back to community"
              variant="secondary"
              onPress={() => router.back()}
            />
          }
        />
      </Screen>
    );
  }

  const membersPlaceholder = (() => {
    if (members.status === "loading" && members.members.length === 0) {
      return <SkeletonList count={3} itemHeight={88} />;
    }

    if (members.status === "error" && members.members.length === 0) {
      return (
        <ErrorState
          message={members.errorMessage ?? "The members could not be loaded."}
          onRetry={refreshMembers}
        />
      );
    }

    return (
      <EmptyState
        icon="people-outline"
        title="No members yet"
        message="Nobody has joined this community so far."
      />
    );
  })();

  return (
    <Screen>
      <FlatList
        data={members.members}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: { item: CommunityMember }) => (
          <Card>
            <MemberRow member={item} />
          </Card>
        )}
        initialNumToRender={8}
        onEndReached={members.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={
              community.isRefreshing ||
              membership.isRefreshing ||
              members.isRefreshing ||
              requests.isRefreshing
            }
            onRefresh={refreshAll}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: spacing.lg }}>
            {canManageMembers ? (
              <JoinRequestsCard
                requests={requests.members}
                total={requests.total}
                status={requests.status}
                errorMessage={requests.errorMessage}
                isLoadingMore={requests.isLoadingMore}
                hasMore={requests.hasMore}
                onRefresh={refreshRequests}
                onLoadMore={requests.loadMore}
                pendingMembershipIds={decisions.pendingMembershipIds}
                actionErrorMessage={decisions.actionErrorMessage}
                onDismissActionError={decisions.dismissActionError}
                onDecide={decisions.decide}
              />
            ) : null}

            <SectionHeading
              title="Members"
              hint={
                members.total !== null
                  ? formatMemberCount(members.total)
                  : undefined
              }
            />
          </View>
        }
        ListEmptyComponent={membersPlaceholder}
        ListFooterComponent={
          <FeedListFooter
            isLoadingMore={members.isLoadingMore}
            hasMore={members.hasMore}
            itemCount={members.members.length}
            loadingLabel="Loading more members"
            endLabel="That is everyone in this community."
          />
        }
        contentContainerStyle={{
          padding: layout.screenPadding,
          gap: spacing.md,
          paddingBottom: spacing.xxl,
        }}
      />
    </Screen>
  );
}
