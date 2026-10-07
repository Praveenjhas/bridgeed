import { useCallback } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import type { Community, Program } from "@bridgeed/shared";
import {
  AppText,
  Badge,
  Button,
  CommunityRow,
  Divider,
  EmptyState,
  ErrorState,
  LoadingState,
  ProgramRow,
  Screen,
  SectionHeading,
} from "@/components";
import {
  formatCommunityCount,
  formatProgramAcademic,
  formatProgramCount,
  formatUniversityLocation,
  joinMeta,
  useUniversityDetail,
} from "@/features/universities";
import { useTheme } from "@/theme";

/**
 * University detail.
 *
 * One screen answers what the institution is, where it is, what it teaches, who
 * is here and which communities belong to it — in that order, which is the order
 * a prospective student reads. Only real data is shown: a section with nothing in
 * it says so rather than inventing content, and no research, admissions or events
 * section is rendered because none of that data exists yet.
 */
export default function UniversityDetailScreen() {
  const params = useLocalSearchParams();
  const rawId = params.universityId;
  const universityId =
    typeof rawId === "string" && rawId.length > 0 ? rawId : null;
  const { colors, layout, spacing } = useTheme();
  const detail = useUniversityDetail(universityId);

  const openProgram = useCallback((program: Program) => {
    router.push({
      pathname: "/programs/[programId]",
      params: { programId: program.id },
    });
  }, []);

  const openCommunity = useCallback((community: Community) => {
    router.push({
      pathname: "/community/[communityId]",
      params: { communityId: community.id },
    });
  }, []);

  if (!universityId) {
    return (
      <Screen>
        <EmptyState
          tone="danger"
          icon="link-outline"
          title="This university link is incomplete"
          message="The screen was opened without a university, so there is nothing to show. Go back and pick one from the directory."
        />
      </Screen>
    );
  }

  if (!detail.data && detail.status === "loading") {
    return (
      <Screen>
        <LoadingState label="Loading the university" />
      </Screen>
    );
  }

  if (!detail.data) {
    return (
      <Screen>
        <ErrorState
          message={
            detail.errorMessage ?? "This university could not be loaded."
          }
          onRetry={detail.refresh}
        />
      </Screen>
    );
  }

  const university = detail.data;
  const location = formatUniversityLocation(university);

  const openWebsite = () => {
    if (university.websiteUrl) {
      void Linking.openURL(university.websiteUrl);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: university.name }} />
      <ScrollView
        contentContainerStyle={{
          padding: layout.screenPadding,
          paddingBottom: spacing.xxxl,
          gap: spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={detail.isRefreshing}
            onRefresh={detail.refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="title" accessibilityRole="header">
              {university.name}
            </AppText>
            {location ? (
              <AppText variant="body" tone="secondary">
                {location}
              </AppText>
            ) : null}
            {university.verified ? (
              <Badge label="Verified" tone="success" icon="checkmark-circle" />
            ) : null}
          </View>

          {university.websiteUrl ? (
            <View style={{ alignSelf: "flex-start" }}>
              <Button
                label="Visit website"
                icon="open-outline"
                variant="secondary"
                size="sm"
                onPress={openWebsite}
              />
            </View>
          ) : null}

          <View style={{ gap: spacing.xs }}>
            <SectionHeading title="About" />
            {university.description ? (
              <AppText tone="secondary">{university.description}</AppText>
            ) : (
              <AppText variant="caption" tone="muted">
                No description has been added for this university yet.
              </AppText>
            )}
          </View>
        </View>

        <Divider />

        <View style={{ gap: spacing.sm }}>
          <SectionHeading
            title="Programs"
            hint={formatProgramCount(university.programCount)}
          />
          {university.programs.length === 0 ? (
            <AppText variant="caption" tone="muted">
              No programs are listed for this university yet.
            </AppText>
          ) : (
            university.programs.map((program, index) => (
              <View key={program.id}>
                {index > 0 ? <Divider /> : null}
                <ProgramRow
                  name={program.name}
                  meta={formatProgramAcademic(program)}
                  description={program.description}
                  onPress={() => openProgram(program)}
                  accessibilityHint="Opens this program"
                />
              </View>
            ))
          )}
        </View>

        <Divider />

        <View style={{ gap: spacing.sm }}>
          <SectionHeading title="Students on BridgeEd" />
          <AppText tone="secondary">
            {university.studentCount === 1
              ? "1 student at this university is on BridgeEd."
              : `${university.studentCount} students at this university are on BridgeEd.`}
          </AppText>
        </View>

        <Divider />

        <View style={{ gap: spacing.sm }}>
          <SectionHeading
            title="Communities"
            hint={joinMeta([formatCommunityCount(university.communityCount)]) ?? undefined}
          />
          {university.communities.length === 0 ? (
            <AppText variant="caption" tone="muted">
              No communities are linked to this university yet.
            </AppText>
          ) : (
            university.communities.map((community, index) => (
              <View key={community.id}>
                {index > 0 ? <Divider /> : null}
                <CommunityRow
                  name={community.name}
                  description={community.description}
                  onPress={() => openCommunity(community)}
                  accessibilityHint="Opens this community"
                />
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </Screen>
  );
}
