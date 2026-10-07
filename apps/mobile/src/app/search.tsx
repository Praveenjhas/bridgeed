import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  SEARCH_TYPES,
  type CommunitySearchResult,
  type ProgramSearchResult,
  type SearchResultCounts,
  type SearchResultGroups,
  type SearchType,
  type StudentSearchResult,
  type SubjectSearchResult,
  type UniversitySearchResult,
} from "@bridgeed/shared";
import {
  AppText,
  CommunityRow,
  Divider,
  EmptyState,
  ErrorState,
  Icon,
  InlineError,
  ProgramRow,
  Screen,
  SearchField,
  SectionHeading,
  SkeletonList,
  StudentRow,
  SubjectRow,
  Tag,
  UniversityRow,
} from "@/components";
import { formatMemberCount } from "@/features/communities";
import { FeedListFooter } from "@/features/feed";
import {
  ExploreRow,
  MIN_SEARCH_TERM_LENGTH,
  SEARCH_DEBOUNCE_MS,
  SEARCH_GROUP_BY_TYPE,
  SEARCH_TYPE_LABELS,
  SEARCH_TYPES_IN_ORDER,
  describeSearchSummary,
  formatSearchCount,
  useSearch,
} from "@/features/search";
import { formatGraduationYear } from "@/features/students";
import {
  formatProgramAcademic,
  formatUniversityLocation,
  joinMeta,
} from "@/features/universities";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTheme } from "@/theme";

/**
 * One row of the search list: either the heading of a category or one result.
 *
 * A search answer is five groups rather than one list, so the list is built from
 * a discriminated union of headings and rows and drawn by a single `FlatList`.
 * That keeps the screen virtualised without a `SectionList`, and it is what lets
 * a heading carry the count behind the preview while its rows are ordinary
 * directory rows.
 */
type SearchListItem =
  | {
      key: string;
      kind: "heading";
      type: SearchType;
      shown: number;
      count: number | null;
    }
  | { key: string; kind: "university"; row: UniversitySearchResult }
  | { key: string; kind: "program"; row: ProgramSearchResult }
  | { key: string; kind: "subject"; row: SubjectSearchResult }
  | { key: string; kind: "community"; row: CommunitySearchResult }
  | { key: string; kind: "student"; row: StudentSearchResult };

function headingItem(
  type: SearchType,
  shown: number,
  counts: SearchResultCounts | null,
): SearchListItem {
  return {
    key: `heading:${type}`,
    kind: "heading",
    type,
    shown,
    count: counts === null ? null : counts[SEARCH_GROUP_BY_TYPE[type]],
  };
}

/**
 * Flattens the grouped answer into the rows the list draws.
 *
 * A grouped read shows a section per category that matched something, so empty
 * categories are left out rather than drawn as five empty headings. A typed read
 * shows only its own category — the one the reader asked for — and the empty
 * answer for it is handled by the screen's empty state instead.
 */
function buildItems(
  groups: SearchResultGroups,
  counts: SearchResultCounts | null,
  only: SearchType | null,
): SearchListItem[] {
  const types = only === null ? SEARCH_TYPES_IN_ORDER : [only];
  const items: SearchListItem[] = [];

  for (const type of types) {
    const count = counts === null ? null : counts[SEARCH_GROUP_BY_TYPE[type]];

    if (only === null && (count === null || count === 0)) {
      continue;
    }

    switch (type) {
      case SEARCH_TYPES.UNIVERSITY: {
        items.push(headingItem(type, groups.universities.length, counts));
        groups.universities.forEach((row) =>
          items.push({
            key: `university:${row.id}`,
            kind: "university",
            row,
          }),
        );
        break;
      }
      case SEARCH_TYPES.PROGRAM: {
        items.push(headingItem(type, groups.programs.length, counts));
        groups.programs.forEach((row) =>
          items.push({ key: `program:${row.id}`, kind: "program", row }),
        );
        break;
      }
      case SEARCH_TYPES.SUBJECT: {
        items.push(headingItem(type, groups.subjects.length, counts));
        groups.subjects.forEach((row) =>
          items.push({ key: `subject:${row.id}`, kind: "subject", row }),
        );
        break;
      }
      case SEARCH_TYPES.COMMUNITY: {
        items.push(headingItem(type, groups.communities.length, counts));
        groups.communities.forEach((row) =>
          items.push({ key: `community:${row.id}`, kind: "community", row }),
        );
        break;
      }
      case SEARCH_TYPES.STUDENT: {
        items.push(headingItem(type, groups.students.length, counts));
        groups.students.forEach((row) =>
          items.push({ key: `student:${row.userId}`, kind: "student", row }),
        );
        break;
      }
    }
  }

  return items;
}

/**
 * Global search.
 *
 * One field asks one question of the whole academic graph, and the answer comes
 * back grouped: universities, programs, subjects, communities and students. The
 * screen has three states, and they follow the reader rather than the other way
 * round. Before anything is typed it offers the five categories, so the search can
 * be narrowed before it starts. Once a term is typed it shows the grouped preview,
 * each section stating how many matches exist behind the five rows it shows, with
 * a "See all" that opens that category as a paged list. Choosing a category turns
 * the same screen into that list — one endpoint, one screen, no second search
 * surface.
 *
 * A subject has no screen of its own in v1, so its rows are not pressable: the
 * section's "See all" pages the subject catalog instead of inventing a detail page
 * the API does not serve. Every other row opens what it names.
 *
 * The screen keeps the native stack header it was pushed with, so a back gesture
 * and a back button are always available; the search field is the first thing
 * under it rather than a second title.
 */
export default function SearchScreen() {
  const { colors, layout, spacing } = useTheme();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SearchType | null>(null);

  const debounced = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  // Clearing the field takes effect at once: waiting for the debounce to expire
  // would leave rows on screen under an empty field for a moment.
  const term = query.trim().length === 0 ? "" : debounced;
  const search = useSearch(term, type);

  const searchedTerm = term.trim();
  const isIdle = searchedTerm.length < MIN_SEARCH_TERM_LENGTH;

  const items = useMemo(
    () =>
      search.results === null
        ? []
        : buildItems(search.results, search.counts, type),
    [search.counts, search.results, type],
  );

  const openUniversity = useCallback((row: UniversitySearchResult) => {
    router.push({
      pathname: "/universities/[universityId]",
      params: { universityId: row.id },
    });
  }, []);

  const openProgram = useCallback((row: ProgramSearchResult) => {
    router.push({
      pathname: "/programs/[programId]",
      params: { programId: row.id },
    });
  }, []);

  const openCommunity = useCallback((row: CommunitySearchResult) => {
    router.push({
      pathname: "/community/[communityId]",
      params: { communityId: row.id },
    });
  }, []);

  const openStudent = useCallback((row: StudentSearchResult) => {
    router.push({
      pathname: "/student/[studentId]",
      params: { studentId: row.userId },
    });
  }, []);

  const clearQuery = useCallback(() => setQuery(""), []);

  const renderItem = useCallback(
    ({ item }: { item: SearchListItem }) => {
      switch (item.kind) {
        case "heading": {
          const label = SEARCH_TYPE_LABELS[item.type];
          const canShowAll =
            type === null && item.count !== null && item.count > item.shown;

          return (
            <View style={{ paddingTop: spacing.sm }}>
              <SectionHeading
                title={label}
                hint={
                  item.count === null
                    ? undefined
                    : formatSearchCount(item.type, item.count)
                }
                action={
                  canShowAll ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Show every matching ${label.toLowerCase()}`}
                      onPress={() => setType(item.type)}
                      style={({ pressed }) => [
                        styles.showAll,
                        { gap: spacing.xxs, opacity: pressed ? 0.6 : 1 },
                      ]}
                    >
                      <AppText variant="caption" tone="accent">
                        See all {item.count}
                      </AppText>
                      <Icon name="chevron-forward" size={14} tone="accent" />
                    </Pressable>
                  ) : null
                }
              />
            </View>
          );
        }

        case "university":
          return (
            <UniversityRow
              name={item.row.name}
              location={formatUniversityLocation(item.row)}
              logoUrl={item.row.logoUrl}
              onPress={() => openUniversity(item.row)}
              accessibilityHint="Opens this university"
            />
          );

        case "program":
          return (
            <ProgramRow
              name={item.row.name}
              meta={formatProgramAcademic(item.row)}
              description={item.row.universityName}
              onPress={() => openProgram(item.row)}
              accessibilityHint="Opens this program"
            />
          );

        case "subject":
          // A subject has no screen of its own in v1: the catalog is the subject
          // surface, so the row reports what matched rather than pretending there
          // is a detail page to open.
          return <SubjectRow name={item.row.name} />;

        case "community":
          return (
            <CommunityRow
              name={item.row.name}
              description={item.row.description}
              meta={joinMeta([
                formatMemberCount(item.row.memberCount),
                item.row.academicContext.university?.name ?? null,
              ])}
              onPress={() => openCommunity(item.row)}
              accessibilityHint="Opens this community"
            />
          );

        case "student":
          return (
            <StudentRow
              name={item.row.name}
              username={item.row.username}
              imageUrl={item.row.profileImageUrl}
              meta={item.row.universityName}
              secondary={joinMeta([
                item.row.programName,
                formatGraduationYear(item.row.graduationYear),
              ])}
              onPress={() => openStudent(item.row)}
              accessibilityHint="Opens this student's profile"
            />
          );
      }
    },
    [openCommunity, openProgram, openStudent, openUniversity, spacing.sm, type],
  );

  // The field is the screen's title, so nothing is drawn above it. The category
  // picker and the filter chips are the same five categories in two shapes: one to
  // choose before a term exists, one to change the category without retyping.
  const header = (
    <View style={{ gap: spacing.lg }}>
      <SearchField
        value={query}
        onChangeText={setQuery}
        onClear={clearQuery}
        placeholder="Search BridgeEd"
        accessibilityLabel="Search universities, programs, subjects, communities and students"
        autoFocus
      />

      {isIdle ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeading
            title="Search inside one category"
            hint={
              query.trim().length === 0
                ? "Everything is searched by default. Pick a category to look in one place."
                : `Type at least ${MIN_SEARCH_TERM_LENGTH} characters to search.`
            }
          />
          {SEARCH_TYPES_IN_ORDER.map((option) => (
            <ExploreRow
              key={option}
              type={option}
              selected={type === option}
              onPress={setType}
            />
          ))}
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              gap: spacing.sm,
              paddingRight: spacing.md,
            }}
          >
            {[null, ...SEARCH_TYPES_IN_ORDER].map((option) => {
              const label =
                option === null ? "All" : SEARCH_TYPE_LABELS[option];
              const isSelected = option === type;

              return (
                <Pressable
                  key={option ?? "all"}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={label}
                  onPress={() => setType(option)}
                  style={({ pressed }) => (pressed ? styles.pressed : null)}
                >
                  <Tag label={label} selected={isSelected} />
                </Pressable>
              );
            })}
          </ScrollView>

          <AppText variant="caption" tone="muted">
            {describeSearchSummary(
              search.pagination?.total ?? null,
              searchedTerm,
            ) ?? `Searching for "${searchedTerm}".`}
          </AppText>
        </View>
      )}

      {search.errorMessage ? (
        <InlineError message={search.errorMessage} onRetry={search.refresh} />
      ) : null}
    </View>
  );

  const placeholder = (() => {
    if (isIdle) {
      return null;
    }

    if (search.status === "loading" && search.results === null) {
      return <SkeletonList count={3} />;
    }

    if (search.status === "error" && search.results === null) {
      return (
        <ErrorState
          message={search.errorMessage ?? "The search could not be run."}
          onRetry={search.refresh}
        />
      );
    }

    if (items.length === 0) {
      return (
        <EmptyState
          icon="search-outline"
          title="No matches"
          message={
            type === null
              ? `Nothing on BridgeEd matches "${searchedTerm}". Try a shorter term or a different spelling.`
              : `No ${SEARCH_TYPE_LABELS[type].toLowerCase()} match "${searchedTerm}". Try another category or a shorter term.`
          }
        />
      );
    }

    return null;
  })();

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        initialNumToRender={8}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={search.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={search.isRefreshing}
            onRefresh={search.refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListHeaderComponent={header}
        ListEmptyComponent={placeholder}
        ListFooterComponent={
          // A grouped preview is one page, so the paging footer is only drawn for
          // the category listing, where "more" is a real state.
          type === null ? null : (
            <FeedListFooter
              isLoadingMore={search.isLoadingMore}
              hasMore={search.hasMore}
              itemCount={items.length}
              loadingLabel="Loading more results"
              endLabel="You have seen every match in this category."
            />
          )
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

const styles = StyleSheet.create({
  showAll: {
    flexDirection: "row",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.6,
  },
});
