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
  Button,
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
import { useStudentProfiles } from "@/features/students";
import { useActor } from "@/providers/ActorProvider";
import { useTheme } from "@/theme";

/**
 * Matches a student against the search field.
 *
 * This filters the connections that have already been loaded; it never asks the
 * API for a match, because the connection endpoints take no search term. A
 * caption under the field says as much, so nobody assumes a student further down
 * the list was checked.
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

  return [profile.name, profile.username]
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
 * Connections tab: the reader's social graph, on one screen.
 *
 * It answers two questions in the order a student asks them: who am I connected
 * to, and who is waiting on me. Both come from the connection endpoints for the
 * configured actor — the accepted list and the received requests — and the people
 * in them are resolved through the student profile API, because a connection row
 * only holds ids.
 *
 * Every change goes through `useConnectionActions`, which disables only the row it
 * is working on and asks the screen to re-read once the API has answered, so the
 * badges and buttons always describe the stored relationship rather than the tap
 * that was just made.
 */
export default function ConnectionsScreen() {
  const { colors, layout, spacing } = useTheme();
  const { actorId, isConfigured, detail: actorDetail } = useActor();
  const api = useMemo(() => resolveApiBaseUrl(), []);
  const connections = useConnections(actorId);
  const requests = useConnectionRequests(actorId);
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const { refresh: refreshConnections } = connections;
  const { refresh: refreshRequests } = requests;

  const refreshAll = useCallback(() => {
    refreshConnections();
    refreshRequests();
  }, [refreshConnections, refreshRequests]);

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

  const openStudent = useCallback((studentId: string) => {
    router.push({
      pathname: "/student/[studentId]",
      params: { studentId },
    });
  }, []);

  const renderConnection = useCallback(
    ({ item }: { item: Connection }) => {
      const studentId = otherParticipantId(item, actorId ?? "");

      return (
        <ConnectionCard
          studentId={studentId}
          profile={profileMap.get(studentId) ?? null}
          onPress={openStudent}
        />
      );
    },
    [actorId, openStudent, profileMap],
  );

  const header = (
    <PageHeader
      title="Connections"
      subtitle="Your network on BridgeEd"
      showWordmark
      actions={
        <IconButton
          icon="refresh"
          accessibilityLabel="Refresh connections"
          onPress={refreshAll}
          disabled={connections.isRefreshing || requests.isRefreshing}
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

  /**
   * The first load is only finished once the connections and the people they name
   * have both arrived. Showing cards before that would print "profile unavailable"
   * on rows that are simply still loading.
   */
  const isLoadingFirstPage =
    (connections.status === "loading" &&
      connections.connections.length === 0) ||
    (connections.connections.length > 0 &&
      profiles.status === "loading" &&
      profileMap.size === 0);

  const connectionsPlaceholder = (() => {
    if (isLoadingFirstPage) {
      return <SkeletonList count={3} />;
    }

    if (
      connections.status === "error" &&
      connections.connections.length === 0
    ) {
      return (
        <ErrorState
          message={
            connections.errorMessage ?? "Your connections could not be loaded."
          }
          onRetry={refreshAll}
        />
      );
    }

    if (query.length > 0) {
      return (
        <EmptyState
          icon="search-outline"
          title="No matching connections"
          message={`None of your connections match "${search.trim()}". Clear the search to see everyone.`}
        />
      );
    }

    return (
      <EmptyState
        icon="git-network-outline"
        title="Build your BridgeEd network"
        message="Connections are the students you know: their posts rank higher in your feed, and they appear first in your communities. Open a community, find a classmate and send them a request."
        action={<Button label="Refresh" icon="refresh" onPress={refreshAll} />}
      />
    );
  })();

  const listHeader = (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.sm }}>
        <SearchField
          value={search}
          placeholder="Search students"
          onChangeText={setSearch}
          onClear={() => setSearch("")}
        />
        {query.length > 0 ? (
          <AppText variant="caption" tone="muted">
            {`Filtering the ${connections.connections.length} connections loaded so far.`}
          </AppText>
        ) : null}
      </View>

      {actions.actionErrorMessage ? (
        <InlineError
          message={actions.actionErrorMessage}
          onDismiss={actions.dismissActionError}
        />
      ) : null}

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
    </View>
  );

  /**
   * Incoming requests sit below the accepted list, in the footer, because the
   * accepted list is the one that can grow without bound and is therefore the one
   * the list itself virtualises. Requests are a bounded, personal queue.
   */
  const listFooter = (
    <View style={{ gap: layout.listGap, paddingTop: spacing.lg }}>
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
              : "No pending requests."}
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

  return (
    <Screen>
      {header}
      <FlatList
        data={visibleConnections}
        keyExtractor={(item) => item.id}
        renderItem={renderConnection}
        initialNumToRender={8}
        refreshControl={
          <RefreshControl
            refreshing={connections.isRefreshing || requests.isRefreshing}
            onRefresh={refreshAll}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={connectionsPlaceholder}
        ListFooterComponent={listFooter}
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
