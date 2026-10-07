import { memo } from "react";
import { StyleSheet, View } from "react-native";
import type { StudentProfile } from "@bridgeed/shared";
import { AppText, Card, Icon, StudentRow } from "@/components";
import { formatStudentHint, useUniversity } from "@/features/students";
import { useTheme } from "@/theme";
import { relationshipLabel } from "../labels";
import { RELATIONSHIP_STATES } from "../relationships";

export interface ConnectionCardProps {
  /** The student the connection is with. */
  studentId: string;
  /** Their profile, or null when it could not be read. */
  profile: StudentProfile | null;
  /** Opens the student's profile. */
  onPress: (studentId: string) => void;
}

/**
 * One accepted connection.
 *
 * The whole card is the way into the student's profile, and it carries no
 * destructive control of its own: removing a connection lives on the profile,
 * behind a confirmation, so a mistimed tap in a list can never break a
 * relationship.
 *
 * The university name comes from a second read of the profile's `universityId`,
 * and falls back to the student's course when that read has not answered yet, so
 * the line is either real or absent.
 */
export const ConnectionCard = memo(function ConnectionCard({
  studentId,
  profile,
  onPress,
}: ConnectionCardProps) {
  const { spacing } = useTheme();
  const university = useUniversity(profile?.universityId ?? null);

  if (!profile) {
    return (
      <Card>
        <View style={[styles.row, { gap: spacing.md }]}>
          <Icon name="person-outline" size={24} tone="textMuted" />
          <View style={styles.text}>
            <AppText variant="subheading">Profile unavailable</AppText>
            <AppText variant="caption" tone="muted">
              This connection&apos;s profile could not be read.
            </AppText>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <StudentRow
      name={profile.name}
      username={profile.username}
      imageUrl={profile.profileImageUrl}
      meta={university?.name ?? formatStudentHint(profile)}
      trailing={
        <View style={[styles.row, { gap: spacing.sm }]}>
          <AppText variant="caption" tone="muted">
            {relationshipLabel(RELATIONSHIP_STATES.ACCEPTED)}
          </AppText>
          <Icon name="chevron-forward" size={16} tone="textDisabled" />
        </View>
      }
      onPress={() => onPress(studentId)}
      accessibilityLabel={`${profile.name}, @${profile.username}, connected`}
      accessibilityHint="Opens this student's profile"
    />
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    flex: 1,
  },
});
