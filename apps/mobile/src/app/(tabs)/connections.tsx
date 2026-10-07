import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import type { Connection, StudentProfile } from "@bridgeed/shared";
import {
  AppText,
  Divider,
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
  ConnectionCard,
  ConnectionRequestCard,
  otherParticipantId,
  useConnectionActions,
  useConnectionRequests,
  useConnections,
} from "@/features/connections";
import { FeedListFooter } from "@/features/feed";
import {
  StudentCard,
  useStudentDirectory,
  useStudentProfiles,
  type DirectoryStudent,
} from "@/features/students";
import { useActor } from "@/providers/AuthProvider";
import { useTheme } from "@/theme";

/**
 * Matches a student against the search field, on any text a reader sees.
 *
 * This filters what has already been loaded — the reader's connections, the
 * requests they have received and the directory page or two fetched so far — and
 * never asks the API for a match, because the directory endpoint takes no search
 * term. Captions under each list say as much, so nobody assumes a student
 * further down the directory was checked.
 */
function matchesSearch(
  profile: StudentProfile | null | undefined,
  query: string,
): boolean {
  if (query.length === 0) {
    return true;
  }

  if (!profile) {
    return false;
  }

  return [
    profile.name,
    profile.username,
    profile.degree ?? "",
    profile.branch ?? "",
  ]
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
        accessibilityLabel="Search students"
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
 * Students tab: the reader's social graph and the whole directory, on one screen.
 *
 * It answers the three questions a student asks in order. Who wants to connect
 * with me, who am I already connected to, and who else is here that I have not
 * met. The first two are bounded, personal lists and are rendered in the header;
 * the directory is the one that can grow without bound and is therefore the list
 * the screen itself virtualises, exactly like the community tab.
 *
 * Every relationship change goes through `useConnectionActions`, which disables
 * only the row it is working on and asks the screen to re-read once the API has
 * answered, so the badges and buttons describe the stored relationship rather
 * than the tap that was just made.
 */
export default function StudentsScreen() {
  const { colors, layout, spacing } = useTheme();
  const { actorId, isConfigured, detail: actorDetail } = useActor();
  const api = useMemo(() => resolveApiBaseUrl(), []);

  const connections = useConnections(actorId);
  const requests = useConnectionRequests(actorId);
  const directory = useStudentDirectory(actorId);
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const { refresh: refreshConnections } = connections;
  const { refresh: refreshRequests } = requests;
  const { refresh: refreshDirectory } = directory;

  const refreshAll = useCallback(() => {
    refreshConnections();
    refreshRequests();
    refreshDirectory();
  }, [refreshConnections, refreshDirectory, refreshRequests]);

  const actions = useConnectionActions({ actorId, onChanged: refreshAll });

  /** Every student named by either list, so their profiles are read in one pass. */
  const studentIds = useMemo(() => {
    return [
      ...connections.connections.map((connection) =>
        otherParticipantId(connection, actorId ?? ""),
      ),
      ...requests.requests.map((connection) =>
        otherParticipantId(connection, actorId ?? ""),
      ),
    ];
  }, [actorId, connections.connections, requests.requests]);

  const profiles = useStudentProfiles(studentIds, isConfigured);
  const { profiles: profileMap } = profiles;

  const visibleConnections = useMemo(
    () =>
      connections.connections.filter((connection) =>
        matchesSearch(
          profileMap.get(otherParticipantId(connection, actorId ?? "")),
          query,
        ),
      ),
    [actorId, connections.connections, profileMap, query],
  );

  const visibleRequests = useMemo(
    () =>
      requests.requests.filter((connection) =>
        matchesSearch(
          profileMap.get(otherParticipantId(connection, actorId ?? "")),
          query,
        ),
      ),
    [actorId, profileMap, query, requests.requests],
  );

  const visibleStudents = useMemo(
    () => directory.students.filter((student) => matchesSearch(student, query)),
    [directory.students, query],
  );

  const openStudent = useCallback((studentId: string) => {
    router.push({
      pathname: "/student/[studentId]",
      params: { studentId },
    });
  }, []);

  const renderStudent = useCallback(
    ({ item }: { item: DirectoryStudent }) => (
      <StudentCard profile={item} onPress={openStudent} />
    ),
    [openStudent],
  );

  const header = (
    <PageHeader
      title="Students"
      subtitle="Discover people from across BridgeEd."
      showWordmark
      actions={
        <IconButton
          icon="refresh"
          accessibilityLabel="Refresh students"
          onPress={refreshAll}
          disabled={
            connections.isRefreshing ||
            requests.isRefreshing ||
            directory.isRefreshing
          }
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
          message={api.baseUrl ? actorDetail : `${actorDetail}\n\n${api.detail}`}
        />
      </Screen>
    );
  }

  const requestsSection = (
    <View style={{ gap: layout.listGap }}>
      <SectionHeading
        title="Connection requests"
        hint={
          requests.requests.length === 0
            ? undefined
            : query.length > 0
              ? `${visibleRequests.length} of ${requests.requests.length} shown`
              : `${requests.requests.length} waiting`
        }
      />

      {requests.status === "error" && requests.requests.length === 0 ? (
        <InlineError
          message={
            requests.errorMessage ??
            "Your connection requests could not be loaded."
          }
          onRetry={refreshRequests}
          retryLabel="Try again"
        />
      ) : null}

      {visibleRequests.length === 0 ? (
        <AppText variant="caption" tone="muted">
          {requests.status === "loading"
            ? "Loading your requests"
            : query.length > 0
              ? "No pending requests match this search."
              : "No connection requests."}
        </AppText>
      ) : (
        visibleRequests.map((request) => {
          const studentId = otherParticipantId(request, actorId ?? "");

          return (
            <ConnectionRequestCard
              key={request.id}
              connectionId={request.id}
              studentId={studentId}
              profile={profileMap.get(studentId) ?? null}
              onPress={openStudent}
              onAccept={actions.acceptRequest}
              onDecline={actions.rejectRequest}
              isPending={actions.isConnectionPending(request.id)}
            />
          );
        })
      )}
    </View>
  );

  const connectionsSection = (
    <View style={{ gap: layout.listGap }}>
      <SectionHeading
        title="My connections"
        hint={
          connections.connections.length === 0
            ? undefined
            : query.length > 0
              ? `${visibleConnections.length} of ${connections.connections.length} shown`
              : `${connections.connections.length} connected`
        }
      />

      {connections.status === "error" &&
      connections.connections.length === 0 ? (
        <InlineError
          message={
            connections.errorMessage ?? "Your connections could not be loaded."
          }
          onRetry={refreshConnections}
          retryLabel="Try again"
        />
      ) : null}

      {visibleConnections.length === 0 ? (
        <AppText variant="caption" tone="muted">
          {connections.status === "loading"
            ? "Loading your connections"
            : query.length > 0
              ? "None of your connections match this search."
              : "You haven't connected with anyone yet."}
        </AppText>
      ) : (
        visibleConnections.map((connection) => {
          const studentId = otherParticipantId(connection, actorId ?? "");

          return (
            <ConnectionCard
              key={connection.id}
              studentId={studentId}
              profile={profileMap.get(studentId) ?? null}
              onPress={openStudent}
            />
          );
        })
      )}
    </View>
  );

  const listHeader = (
    <View style={{ gap: layout.listGap }}>
      <View style={{ gap: spacing.sm }}>
        <SearchField
          value={search}
          placeholder="Search students"
          onChangeText={setSearch}
          onClear={() => setSearch("")}
        />
        {query.length > 0 ? (
          <AppText variant="caption" tone="muted">
            {`Filtering your requests, connections and the ${directory.students.length} students loaded so far.`}
          </AppText>
        ) : null}
      </View>

      {actions.actionErrorMessage ? (
        <InlineError
          message={actions.actionErrorMessage}
          onDismiss={actions.dismissActionError}
        />
      ) : null}

      {requestsSection}
      {connectionsSection}

      <SectionHeading
        title="Discover students"
        hint={
          directory.total !== null
            ? `${visibleStudents.length} shown of ${directory.total}`
            : undefined
        }
      />
    </View>
  );

  const discoverPlaceholder = (() => {
    if (directory.status === "loading" && directory.students.length === 0) {
      return <SkeletonList count={3} />;
    }

    if (directory.status === "error" && directory.students.length === 0) {
      return (
        <ErrorState
          message={
            directory.errorMessage ?? "The student directory was not loaded."
          }
          onRetry={refreshDirectory}
        />
      );
    }

    if (query.length > 0) {
      return (
        <EmptyState
          icon="search-outline"
          title="No matching students"
          message={`Nothing in the students loaded so far matches "${search.trim()}". Clear the search to see the whole directory.`}
        />
      );
    }

    return (
      <EmptyState
        icon="people-outline"
        title="No students found."
        message="Students who join BridgeEd show up here, with their university and course."
      />
    );
  })();

  return (
    <Screen>
      {header}
      <FlatList
        data={visibleStudents}
        keyExtractor={(item) => item.userId}
        renderItem={renderStudent}
        initialNumToRender={8}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={directory.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={
              connections.isRefreshing ||
              requests.isRefreshing ||
              directory.isRefreshing
            }
            onRefresh={refreshAll}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={discoverPlaceholder}
        ListFooterComponent={
          <FeedListFooter
            isLoadingMore={directory.isLoadingMore}
            hasMore={directory.hasMore}
            itemCount={visibleStudents.length}
            loadingLabel="Loading more students"
            endLabel="You have seen every student."
          />
        }
        // Students are separated by a hairline, so the directory reads as one
        // people list rather than a stack of boxed cards.
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
  search: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
  },
});
