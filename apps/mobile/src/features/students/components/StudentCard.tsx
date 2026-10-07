import { memo } from "react";
import type { StudentProfile } from "@bridgeed/shared";
import { StudentRow } from "@/components";
import { useUniversity } from "../hooks/useUniversity";
import { formatCourse, formatGraduationYear } from "../labels";

export interface StudentCardProps {
  profile: StudentProfile;
  /** Opens the student's profile, where the connection action lives. */
  onPress: (studentId: string) => void;
}

/**
 * One student in the Discover directory.
 *
 * It shows the educational facts a classmate can act on — name, handle,
 * university, course and graduation year — and nothing else. The whole row is the
 * way into the profile rather than a place to send a request: a connect button on
 * every row would mean a relationship read per student, and the profile already
 * owns that decision with the API's own rules.
 *
 * The university name comes from a second read of the profile's `universityId`,
 * and the course line simply disappears when the API has no course recorded, so a
 * line is either real or absent.
 */
export const StudentCard = memo(function StudentCard({
  profile,
  onPress,
}: StudentCardProps) {
  const university = useUniversity(profile.universityId);

  const course = [
    formatCourse(profile),
    formatGraduationYear(profile.graduationYear),
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  return (
    <StudentRow
      name={profile.name}
      username={profile.username}
      imageUrl={profile.profileImageUrl}
      meta={university?.name ?? null}
      secondary={course.length > 0 ? course : null}
      onPress={() => onPress(profile.userId)}
      accessibilityHint="Opens this student's profile"
    />
  );
});
