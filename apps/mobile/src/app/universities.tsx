import { useCallback, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { router } from "expo-router";
import type { UniversitySummary } from "@bridgeed/shared";
import {
  AppText,
  Divider,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  Screen,
  SearchField,
  SkeletonList,
  UniversityRow,
} from "@/components";
import { FeedListFooter } from "@/features/feed";
import {
  formatProgramCount,
  formatStudentCount,
  formatUniversityLocation,
  joinMeta,
  useUniversityDirectory,
} from "@/features/universities";
import { useTheme } from "@/theme";

/**
 * Universities directory.
 *
 * It is the academic front door: a searchable, paged list of institutions, each
 * row carrying the place it sits in and how many programmes and students it has
 * on BridgeEd. The search is answered by the API, so a match beyond the loaded
 * page is still found; rows are separated by a hairline so the screen reads as a
 * directory rather than a grid of cards.
 *
 * Its header carries the way into global search, because a student who came here
 * looking for something and did not find it should be one tap from looking for it
 * everywhere.
 */
export default function UniversitiesScreen() {
  const { colors, layout, spacing } = useTheme();
  const [search, setSearch] = useState("");
  const directory = useUniversityDirectory(search);

  const openSearch = useCallback(() => {
    router.push("/search");
  }, []);

  const openUniversity = useCallback((university: UniversitySummary) => {
    router.push({
      pathname: "/universities/[universityId]",
      params: { universityId: university.id },
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: UniversitySummary }) => (
      <UniversityRow
        name={item.name}
        location={formatUniversityLocation(item)}
        description={item.description}
        logoUrl={item.logoUrl}
        meta={joinMeta([
          formatProgramCount(item.programCount),
          formatStudentCount(item.studentCount),
        ])}
        onPress={() => openUniversity(item)}
        accessibilityHint="Opens this university"
      />
    ),
    [openUniversity],
  );

  const trimmedSearch = search.trim();

  const listHeader = (
    <View style={{ gap: spacing.md }}>
      <SearchField
        value={search}
        onChangeText={setSearch}
        onClear={() => setSearch("")}
        placeholder="Search universities..."
      />
      {trimmedSearch.length > 0 ? (
        <AppText variant="caption" tone="muted">
          {directory.total !== null
            ? `${directory.total} ${directory.total === 1 ? "university" : "universities"} match "${trimmedSearch}".`
            : `Searching for "${trimmedSearch}".`}
        </AppText>
      ) : null}
    </View>
  );

  const placeholder = (() => {
    if (directory.status === "loading" && directory.universities.length === 0) {
      return <SkeletonList count={3} />;
    }

    if (directory.status === "error" && directory.universities.length === 0) {
      return (
        <ErrorState
          message={
            directory.errorMessage ?? "The university directory was not loaded."
          }
          onRetry={directory.refresh}
        />
      );
    }

    if (trimmedSearch.length > 0) {
      return (
        <EmptyState
          icon="search-outline"
          title="No matching universities"
          message={`No university matches "${trimmedSearch}". Try a shorter or different name.`}
        />
      );
    }

    return (
      <EmptyState
        icon="school-outline"
        title="No universities listed yet"
        message="Universities appear here as they are added to BridgeEd."
      />
    );
  })();

  return (
    <Screen>
      <PageHeader
        title="Universities"
        subtitle="Browse the academic directory."
        actions={
          <IconButton
            icon="search-outline"
            accessibilityLabel="Search everything"
            onPress={openSearch}
          />
        }
      />
      <FlatList
        data={directory.universities}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        initialNumToRender={8}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={directory.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={directory.isRefreshing}
            onRefresh={directory.refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={placeholder}
        ListFooterComponent={
          <FeedListFooter
            isLoadingMore={directory.isLoadingMore}
            hasMore={directory.hasMore}
            itemCount={directory.universities.length}
            loadingLabel="Loading more universities"
            endLabel="You have seen every university."
          />
        }
        ItemSeparatorComponent={() => <Divider />}
        contentContainerStyle={{
          padding: layout.screenPadding,
          gap: spacing.none,
          paddingBottom: spacing.xxxl,
        }}
      />
    </Screen>
  );
}

