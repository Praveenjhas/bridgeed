import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  COMMUNITY_MEMBERSHIP_STATUSES,
  type Community,
} from "@bridgeed/shared";
import {
  AppText,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  InlineError,
  PageHeader,
  Screen,
  SectionHeading,
  SkeletonList,
} from "@/components";
import { resolveApiBaseUrl } from "@/config/env";
import {
  CommunityCard,
  useCommunities,
  useCommunityMemberships,
} from "@/features/communities";
import { FeedListFooter } from "@/features/feed";
import { useActor } from "@/providers/ActorProvider";
import { useTheme } from "@/theme";

/** Matches a community against the search field, on any text a reader sees. */
function matchesSearch(community: Community, query: string): boolean {
  if (query.length === 0) {
    return true;
  }

  return [community.name, community.slug, community.description ?? ""]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

interface SearchFieldProps {
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  onClear: () => void;
}

function SearchField({
  value,
  placeholder,
  onChangeText,
  onClear,
}: SearchFieldProps) {
  const { colors, layout, radius, spacing, typography } = useTheme();

  return (
    <View
      style={[
        styles.search,
        {
          gap: spacing.sm,
          minHeight: layout.minTouchTarget,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingLeft: spacing.md,
          paddingRight: spacing.xs,
        },
      ]}
    >
      <Icon name="search" size={layout.icon.sm} tone="textMuted" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Search communities"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={[
          styles.searchInput,
          typography.body,
          { color: colors.textPrimary },
        ]}
      />
      {value.length > 0 ? (
        <IconButton
          icon="close-circle"
          accessibilityLabel="Clear the search"
          size={layout.icon.md}
          onPress={onClear}
        />
      ) : null}
    </View>
  );
}

/**
 * Communities tab.
 *
 * It answers two questions in one screen: which communities the reader already
 * belongs to, and which ones exist that they could join. The directory comes
 * from the API page by page, while the memberships come from the student's own
 * membership list, which is what every badge and state on a card is derived
 * from.
 *
 * The search field filters what is already loaded rather than calling a search
 * endpoint, because the API has none; a caption under the field says so, so
 * nobody assumes a match further down the directory was checked.
 */
export default function CommunitiesScreen() {
  const { colors, layout, spacing } = useTheme();
  const { actorId, isConfigured, detail: actorDetail } = useActor();
  const api = useMemo(() => resolveApiBaseUrl(), []);
  const memberships = useCommunityMemberships(actorId);
  const directory = useCommunities(actorId);
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const { membershipFor, refresh: refreshMemberships } = memberships;
  const { refresh: refreshDirectory } = directory;

  const myCommunities = useMemo(
    () =>
      memberships.memberships.filter(
        (membership) =>
          membership.status === COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE &&
          matchesSearch(membership.community, query),
      ),
    [memberships.memberships, query],
  );

  const joinedCommunityIds = useMemo(
    () =>
      new Set(
        memberships.memberships
          .filter(
            (membership) =>
              membership.status === COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
          )
          .map((membership) => membership.communityId),
      ),
    [memberships.memberships],
  );

  const discover = useMemo(
    () =>
      directory.communities.filter(
        (community) =>
          !joinedCommunityIds.has(community.id) &&
          matchesSearch(community, query),
      ),
    [directory.communities, joinedCommunityIds, query],
  );

  const openCommunity = useCallback((community: Community) => {
    router.push({
      pathname: "/community/[communityId]",
      params: { communityId: community.id },
    });
  }, []);

  const refreshAll = useCallback(() => {
    refreshMemberships();
    refreshDirectory();
  }, [refreshDirectory, refreshMemberships]);

  const renderItem = useCallback(
    ({ item }: { item: Community }) => (
      <CommunityCard
        community={item}
        membership={membershipFor(item.id)}
        onPress={openCommunity}
      />
    ),
    [membershipFor, openCommunity],
  );

  const header = (
    <PageHeader
      title="Communities"
      subtitle="Communities you belong to, and ones you can join"
      showWordmark
      actions={
        <IconButton
          icon="refresh"
          accessibilityLabel="Refresh communities"
          onPress={refreshAll}
          disabled={memberships.isRefreshing || directory.isRefreshing}
        />
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

  const discoverPlaceholder = (() => {
    if (query.length > 0 && directory.communities.length > 0) {
      return (
        <EmptyState
          icon="search-outline"
          title="No matching communities"
          message={`Nothing in the communities loaded so far matches “${search.trim()}”. Clear the search to see the whole directory.`}
        />
      );
    }

    if (directory.status === "loading" && directory.communities.length === 0) {
      return <SkeletonList count={3} />;
    }

    if (directory.status === "error" && directory.communities.length === 0) {
      return (
        <ErrorState
          message={
            directory.errorMessage ?? "The community directory was not loaded."
          }
          onRetry={refreshDirectory}
        />
      );
    }

    if (directory.communities.length === 0) {
      return (
        <EmptyState
          icon="people-outline"
          title="No communities yet"
          message="Communities created on this campus show up here, with their type and where you stand with them."
        />
      );
    }

    return (
      <EmptyState
        icon="checkmark-circle-outline"
        title="You are in every community"
        message="There is nothing left to discover, because the directory has no community left for you to join."
      />
    );
  })();

  return (
    <Screen>
      {header}
      <FlatList
        data={discover}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        initialNumToRender={6}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={directory.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={memberships.isRefreshing || directory.isRefreshing}
            onRefresh={refreshAll}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: spacing.xl }}>
            <View style={{ gap: spacing.sm }}>
              <SearchField
                value={search}
                placeholder="Search by name or description"
                onChangeText={setSearch}
                onClear={() => setSearch("")}
              />
              {query.length > 0 ? (
                <AppText variant="caption" tone="muted">
                  {`Filtering the ${directory.communities.length} communities loaded so far.`}
                </AppText>
              ) : null}
            </View>

            {/*
              The reader's own memberships are a bounded, personal list, so they
              are rendered inside the header while the unbounded directory below
              is virtualised by the list itself.
            */}
            <View style={{ gap: layout.listGap }}>
              <SectionHeading
                title="My communities"
                hint={
                  myCommunities.length > 0
                    ? `${myCommunities.length} joined`
                    : undefined
                }
              />
              {memberships.status === "error" &&
              memberships.memberships.length === 0 ? (
                <InlineError
                  message={
                    memberships.errorMessage ??
                    "Your communities could not be loaded."
                  }
                  onRetry={refreshMemberships}
                  retryLabel="Try again"
                />
              ) : null}
              {myCommunities.length === 0 ? (
                <AppText variant="caption" tone="muted">
                  {memberships.status === "loading"
                    ? "Loading your communities"
                    : query.length > 0
                      ? "None of your communities match this search."
                      : "You have not joined a community yet. Join one below and its posts join your feed."}
                </AppText>
              ) : (
                myCommunities.map((membership) => (
                  <CommunityCard
                    key={membership.id}
                    community={membership.community}
                    membership={membership}
                    onPress={openCommunity}
                  />
                ))
              )}
            </View>

            <SectionHeading
              title="Discover communities"
              hint={
                directory.total !== null
                  ? `${discover.length} shown of ${directory.total}`
                  : undefined
              }
            />
          </View>
        }
        ListEmptyComponent={discoverPlaceholder}
        ListFooterComponent={
          <FeedListFooter
            isLoadingMore={directory.isLoadingMore}
            hasMore={directory.hasMore}
            itemCount={discover.length}
            loadingLabel="Loading more communities"
            endLabel="You have seen every community."
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

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
  },
});
