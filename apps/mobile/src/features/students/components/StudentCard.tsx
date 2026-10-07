import { memo } from "react";
import { StyleSheet, View } from "react-native";
import type { StudentProfile } from "@bridgeed/shared";
import { AppText, Card, Icon } from "@/components";
import { useTheme } from "@/theme";
import { useUniversity } from "../hooks/useUniversity";
import { formatCourse, formatGraduationYear } from "../labels";
import { StudentIdentity } from "./StudentIdentity";

export interface StudentCardProps {
  profile: StudentProfile;
  /** Opens the student's profile, where the connection action lives. */
  onPress: (studentId: string) => void;
}

/**
 * One student in the Discover directory.
 *
 * It shows the educational facts a classmate can act on — name, handle,
 * university, course and graduation year — and nothing else. The whole card is
 * the way into the profile rather than a place to send a request: a connect
 * button on every row would mean a relationship read per student, and the
 * profile already owns that decision with the API's own rules.
 *
 * The university name comes from a second read of the profile's `universityId`,
 * and the course line simply disappears when the API has no course recorded, so
 * a line is either real or absent.
 */
export const StudentCard = memo(function StudentCard({
  profile,
  onPress,
}: StudentCardProps) {
  const { spacing } = useTheme();
  const university = useUniversity(profile.universityId);

  const course = [formatCourse(profile), formatGraduationYear(profile.graduationYear)]
    .filter((part): part is string => part !== null)
    .join(" · ");

  return (
    <Card
      onPress={() => onPress(profile.userId)}
      accessibilityLabel={`${profile.name}, @${profile.username}`}
      accessibilityHint="Opens this student's profile"
    >
      <View style={{ gap: spacing.sm }}>
        <StudentIdentity
          name={profile.name}
          username={profile.username}
          imageUrl={profile.profileImageUrl}
          meta={university?.name ?? null}
          trailing={
            <Icon name="chevron-forward" size={16} tone="textDisabled" />
          }
        />

        {course.length > 0 ? (
          <View style={[styles.row, { gap: spacing.xs }]}>
            <Icon name="school-outline" size={14} tone="textMuted" />
            <AppText variant="caption" tone="secondary" numberOfLines={1}>
              {course}
            </AppText>
          </View>
        ) : null}
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
});
