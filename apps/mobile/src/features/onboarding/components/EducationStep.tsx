import { View } from "react-native";
import { TextField } from "@/components";
import { useTheme } from "@/theme";
import {
  BRANCH_MAX_LENGTH,
  DEGREE_MAX_LENGTH,
  GRADUATION_YEAR_MAX,
  GRADUATION_YEAR_MIN,
  LOCATION_MAX_LENGTH,
} from "../draft";
import type { OnboardingStepProps } from "./stepProps";

/**
 * Course, graduation year and location.
 *
 * Every field here is optional, which is why none of them is marked as required
 * and why the step can be walked through without typing anything: a student who
 * has not chosen a branch yet should not have to invent one to reach the rest of
 * the app. What is typed is validated, so a year cannot be saved as "abcd".
 */
export function EducationStep({
  draft,
  issues,
  onEdit,
  isBusy,
}: OnboardingStepProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing.lg }}>
      <TextField
        label="Course"
        icon="school-outline"
        value={draft.degree}
        onChangeText={(degree) => onEdit({ degree })}
        placeholder="B.Tech"
        error={issues.degree}
        hint="Optional — the qualification you are studying for."
        autoCapitalize="words"
        maxLength={DEGREE_MAX_LENGTH}
        returnKeyType="next"
        editable={!isBusy}
      />

      <TextField
        label="Branch"
        icon="git-branch-outline"
        value={draft.branch}
        onChangeText={(branch) => onEdit({ branch })}
        placeholder="Computer Science"
        error={issues.branch}
        hint="Optional — the specialisation within your course."
        autoCapitalize="words"
        maxLength={BRANCH_MAX_LENGTH}
        returnKeyType="next"
        editable={!isBusy}
      />

      <TextField
        label="Graduation year"
        icon="calendar-outline"
        value={draft.graduationYear}
        onChangeText={(graduationYear) => onEdit({ graduationYear })}
        placeholder="2027"
        error={issues.graduationYear}
        hint={`Optional — a year between ${GRADUATION_YEAR_MIN} and ${GRADUATION_YEAR_MAX}.`}
        keyboardType="number-pad"
        maxLength={4}
        returnKeyType="next"
        editable={!isBusy}
      />

      <TextField
        label="Location"
        icon="location-outline"
        value={draft.location}
        onChangeText={(location) => onEdit({ location })}
        placeholder="Bengaluru, India"
        error={issues.location}
        hint="Optional — where you are based while you study."
        autoCapitalize="words"
        maxLength={LOCATION_MAX_LENGTH}
        returnKeyType="done"
        editable={!isBusy}
      />
    </View>
  );
}
