import { RefreshControl, ScrollView, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import {
  AppText,
  Button,
  Divider,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SectionHeading,
  Tag,
} from "@/components";
import {
  formatCommunityCount,
  formatProgramAcademic,
  formatSubjectCount,
  useProgramDetail,
} from "@/features/universities";
import { useTheme } from "@/theme";

/**
 * Program detail.
 *
 * A programme is the middle of the academic graph, so the screen shows what it
 * is (name, degree, field, description), where it sits (its university) and what
 * is attached to it (subjects, students, communities). The subject list is the
 * shared vocabulary the programme teaches; the counts are honest totals from the
 * same read, not estimates.
 */
export default function ProgramDetailScreen() {
  const params = useLocalSearchParams();
  const rawId = params.programId;
  const programId = typeof rawId === "string" && rawId.length > 0 ? rawId : null;
  const { colors, layout, spacing } = useTheme();
  const detail = useProgramDetail(programId);

  const openUniversity = () => {
    const university = detail.data?.university;

    if (university) {
      router.push({
        pathname: "/universities/[universityId]",
        params: { universityId: university.id },
      });
    }
  };

  if (!programId) {
    return (
      <Screen>
        <EmptyState
          tone="danger"
          icon="link-outline"
          title="This program link is incomplete"
          message="The screen was opened without a program, so there is nothing to show. Go back and pick one from a university."
        />
      </Screen>
    );
  }

  if (!detail.data && detail.status === "loading") {
    return (
      <Screen>
        <LoadingState label="Loading the program" />
      </Screen>
    );
  }

  if (!detail.data) {
    return (
      <Screen>
        <ErrorState
          message={detail.errorMessage ?? "This program could not be loaded."}
          onRetry={detail.refresh}
        />
      </Screen>
    );
  }

  const program = detail.data;
  const academic = formatProgramAcademic(program);

  return (
    <Screen>
      <Stack.Screen options={{ title: program.name }} />
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
              {program.name}
            </AppText>
            {academic ? (
              <AppText variant="body" tone="secondary">
                {academic}
              </AppText>
            ) : null}
          </View>

          {program.universityName ? (
            <View style={{ alignSelf: "flex-start" }}>
              <Button
                label={program.universityName}
                icon="school-outline"
                variant="tertiary"
                size="sm"
                onPress={openUniversity}
                accessibilityLabel={`Open ${program.universityName}`}
              />
            </View>
          ) : null}

          {program.description ? (
            <AppText tone="secondary">{program.description}</AppText>
          ) : null}
        </View>

        <Divider />

        <View style={{ gap: spacing.sm }}>
          <SectionHeading
            title="Subjects"
            hint={formatSubjectCount(program.subjects.length)}
          />
          {program.subjects.length === 0 ? (
            <AppText variant="caption" tone="muted">
              No subjects are listed for this program yet.
            </AppText>
          ) : (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
              }}
            >
              {program.subjects.map((subject) => (
                <Tag key={subject.id} label={subject.name} />
              ))}
            </View>
          )}
        </View>

        <Divider />

        <View style={{ gap: spacing.sm }}>
          <SectionHeading title="Students on BridgeEd" />
          <AppText tone="secondary">
            {program.studentCount === 1
              ? "1 student on BridgeEd is enrolled on this program."
              : `${program.studentCount} students on BridgeEd are enrolled on this program.`}
          </AppText>
        </View>

        <Divider />

        <View style={{ gap: spacing.sm }}>
          <SectionHeading
            title="Communities"
            hint={formatCommunityCount(program.communityCount)}
          />
          {program.communityCount === 0 ? (
            <AppText variant="caption" tone="muted">
              No communities are linked to this program yet.
            </AppText>
          ) : (
            <AppText tone="secondary">
              These communities are linked to this program and appear in the
              community directory.
            </AppText>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
