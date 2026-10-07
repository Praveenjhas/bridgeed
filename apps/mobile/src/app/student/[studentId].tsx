import { useCallback, useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  AppText,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Icon,
  InlineError,
  LoadingState,
  Screen,
  SectionHeading,
  type IconName,
} from "@/components";
import {
  ConnectionActions,
  relationshipStateFor,
  useConnectionActions,
  useRelationship,
} from "@/features/connections";
import {
  formatCourse,
  formatGraduationYear,
  StudentIdentity,
  TagList,
  useStudentInterests,
  useStudentProfile,
  useStudentSkills,
  useUniversity,
} from "@/features/students";
import { useActor } from "@/providers/AuthProvider";
import { useTheme } from "@/theme";

interface FactProps {
  icon: IconName;
  label: string;
  value: string;
}

/** One recorded detail of a profile, rendered only when the API actually has it. */
function Fact({ icon, label, value }: FactProps) {
  const { layout, spacing } = useTheme();

  return (
    <View style={[styles.row, { gap: spacing.md, alignItems: "flex-start" }]}>
      <Icon name={icon} size={layout.icon.md} tone="textMuted" />
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <AppText variant="overline" tone="muted">
          {label}
        </AppText>
        <AppText variant="bodyStrong">{value}</AppText>
      </View>
    </View>
  );
}

/**
 * One student's profile.
 *
 * It is pushed onto the stack from a connection, a request or any other list, and
 * it is where the reader decides what to do about the relationship: connect,
 * accept, decline, withdraw, remove or block. The profile data and the
 * relationship are read separately, because they fail independently — a
 * relationship that cannot be checked should not hide the person.
 *
 * Only fields the API actually stores are shown. A profile without a university,
 * course, graduation year or location renders fewer facts and no placeholder, and
 * university and course names are resolved from their ids rather than guessed.
 */
export default function StudentProfileScreen() {
  const params = useLocalSearchParams();
  const rawStudentId = params.studentId;
  const studentId =
    typeof rawStudentId === "string" && rawStudentId.length > 0
      ? rawStudentId
      : null;

  const { actorId, isConfigured, detail: actorDetail } = useActor();
  const { colors, layout, spacing } = useTheme();

  const profile = useStudentProfile(studentId);
  const relationship = useRelationship(actorId, studentId);
  const skills = useStudentSkills(studentId);
  const interests = useStudentInterests(studentId);
  const detail = profile.profile;
  const university = useUniversity(detail?.universityId ?? null);

  const isSelf =
    actorId !== null && studentId !== null && actorId === studentId;
  const relationshipState = relationshipStateFor(
    relationship.relationship,
    actorId,
    studentId,
  );
  const connectionId = relationship.relationship?.id ?? null;

  const { refresh: refreshProfile } = profile;
  const { refresh: refreshRelationship } = relationship;
  const { refresh: refreshSkills } = skills;
  const { refresh: refreshInterests } = interests;

  const actions = useConnectionActions({
    actorId,
    onChanged: refreshRelationship,
  });

  const refreshAll = useCallback(() => {
    refreshProfile();
    refreshSkills();
    refreshInterests();

    if (!isSelf) {
      refreshRelationship();
    }
  }, [
    isSelf,
    refreshInterests,
    refreshProfile,
    refreshRelationship,
    refreshSkills,
  ]);

  /** Runs a row action on the relationship, which is the only id the API takes. */
  const runOnConnection = useCallback(
    (action: (id: string) => Promise<boolean>) => {
      if (connectionId) {
        void action(connectionId);
      }
    },
    [connectionId],
  );

  const universityLabel = university
    ? [university.name, university.city ?? university.country]
        .filter((part) => Boolean(part))
        .join(" · ")
    : null;

  const facts = useMemo(() => {
    if (!detail) {
      return [];
    }

    const entries: {
      key: string;
      icon: IconName;
      label: string;
      value: string;
    }[] = [];

    if (universityLabel) {
      entries.push({
        key: "university",
        icon: "school-outline",
        label: "University",
        value: universityLabel,
      });
    }

    const course = formatCourse(detail);

    if (course) {
      entries.push({
        key: "course",
        icon: "book-outline",
        label: "Course",
        value: course,
      });
    }

    const graduation = formatGraduationYear(detail.graduationYear);

    if (graduation) {
      entries.push({
        key: "graduation",
        icon: "calendar-outline",
        label: "Graduation",
        value: graduation,
      });
    }

    if (detail.location) {
      entries.push({
        key: "location",
        icon: "location-outline",
        label: "Location",
        value: detail.location,
      });
    }

    return entries;
  }, [detail, universityLabel]);

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

  if (!studentId) {
    return (
      <Screen>
        <EmptyState
          tone="danger"
          icon="person-outline"
          title="This profile is incomplete"
          message="The screen was opened without a student, so there is nobody to show."
        />
      </Screen>
    );
  }

  if (!detail && profile.status === "loading") {
    return (
      <Screen>
        <LoadingState label="Loading this profile" />
      </Screen>
    );
  }

  if (!detail) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Student" }} />
        <ErrorState
          message={profile.errorMessage ?? "This profile could not be loaded."}
          onRetry={refreshProfile}
        />
      </Screen>
    );
  }

  // A relationship is only "being checked" while there is no answer yet: once the
  // read has settled, a null row means genuinely not connected.
  const isChecking =
    !isSelf && relationship.status === "loading" && connectionId === null;
  const isActionPending =
    actions.isStudentPending(studentId) ||
    (connectionId !== null && actions.isConnectionPending(connectionId));

  const skillNames = skills.skills.map((skill) => skill.name);
  const interestNames = interests.interests.map((interest) => interest.name);

  return (
    <Screen>
      <Stack.Screen options={{ title: detail.name }} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={
              profile.isRefreshing ||
              relationship.isRefreshing ||
              skills.isRefreshing ||
              interests.isRefreshing
            }
            onRefresh={refreshAll}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        contentContainerStyle={{
          padding: layout.screenPadding,
          gap: spacing.lg,
          paddingBottom: spacing.xxxl,
        }}
      >
        <Card>
          <View style={{ gap: spacing.md }}>
            <StudentIdentity
              name={detail.name}
              username={detail.username}
              imageUrl={detail.profileImageUrl}
              size="lg"
              nameVariant="title"
            />

            {detail.bio ? (
              <AppText tone="secondary">{detail.bio}</AppText>
            ) : null}

            {facts.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                {facts.map((fact) => (
                  <Fact
                    key={fact.key}
                    icon={fact.icon}
                    label={fact.label}
                    value={fact.value}
                  />
                ))}
              </View>
            ) : null}

            <Divider />

            <ConnectionActions
              state={relationshipState}
              isChecking={isChecking}
              readErrorMessage={
                !isSelf &&
                relationship.status === "error" &&
                connectionId === null
                  ? relationship.errorMessage
                  : null
              }
              onRetryRead={refreshRelationship}
              isActionPending={isActionPending}
              actionErrorMessage={actions.actionErrorMessage}
              onDismissActionError={actions.dismissActionError}
              onConnect={() => {
                void actions.sendRequest(studentId);
              }}
              onAccept={() => runOnConnection(actions.acceptRequest)}
              onDecline={() => runOnConnection(actions.rejectRequest)}
              onCancelRequest={() => runOnConnection(actions.cancelRequest)}
              onRemoveConnection={() =>
                runOnConnection(actions.removeConnection)
              }
              onBlock={() => runOnConnection(actions.blockConnection)}
            />
          </View>
        </Card>

        {/* Skills and interests are their own reads, and their own sections. */}

        <Card>
          <View style={{ gap: spacing.md }}>
            <SectionHeading
              title="Skills"
              hint={
                skillNames.length > 0
                  ? `${skillNames.length} listed`
                  : undefined
              }
            />
            {skills.status === "error" ? (
              <InlineError
                message={skills.errorMessage ?? "Skills could not be loaded."}
                onRetry={refreshSkills}
              />
            ) : skills.status === "loading" && skillNames.length === 0 ? (
              <AppText variant="caption" tone="muted">
                Loading skills
              </AppText>
            ) : (
              <TagList
                names={skillNames}
                emptyMessage="No skills are listed on this profile."
              />
            )}
          </View>
        </Card>

        <Card>
          <View style={{ gap: spacing.md }}>
            <SectionHeading
              title="Interests"
              hint={
                interestNames.length > 0
                  ? `${interestNames.length} listed`
                  : undefined
              }
            />
            {interests.status === "error" ? (
              <InlineError
                message={
                  interests.errorMessage ?? "Interests could not be loaded."
                }
                onRetry={refreshInterests}
              />
            ) : interests.status === "loading" && interestNames.length === 0 ? (
              <AppText variant="caption" tone="muted">
                Loading interests
              </AppText>
            ) : (
              <TagList
                names={interestNames}
                emptyMessage="No interests are listed on this profile."
              />
            )}
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
  },
});
