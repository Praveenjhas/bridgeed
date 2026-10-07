import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Stack, router } from "expo-router";
import type { StudentProfileDetails, University } from "@bridgeed/shared";
import {
  AppText,
  Button,
  ErrorState,
  InlineError,
  LoadingState,
  Screen,
  SectionHeading,
  TextField,
} from "@/components";
import {
  BIO_MAX_LENGTH,
  BRANCH_MAX_LENGTH,
  DEGREE_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  OptionList,
  TagPicker,
} from "@/features/onboarding";
import { useEditProfileForm } from "@/features/profile";
import { useInterests, useSkills, useUniversities } from "@/features/students";
import { useStudentProfileStatus } from "@/providers/StudentProfileProvider";
import { useTheme } from "@/theme";

/** `Bengaluru, Karnataka, India`, or null when the record has no place on it. */
function locationOf(university: University): string | null {
  const parts = [university.city, university.state, university.country].filter(
    (part): part is string => part !== null && part.trim().length > 0,
  );

  return parts.length > 0 ? parts.join(", ") : null;
}

/** Adds an id when it is absent and removes it when it is present. */
function toggle(id: string, ids: string[]): string[] {
  return ids.includes(id)
    ? ids.filter((existing) => existing !== id)
    : [...ids, id];
}

/**
 * Edit the signed-in student's profile.
 *
 * It reads the profile the app already holds — the same document the Profile tab
 * shows — and never asks the API who it is: the owner comes from the session, so
 * this screen can only ever edit the account that is signed in. A successful
 * save publishes the updated document and returns to the Profile tab.
 */
export default function EditProfileScreen() {
  const { status, profile, errorMessage, refresh } = useStudentProfileStatus();

  if (status === "loading" && profile === null) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Edit profile" }} />
        <LoadingState label="Loading your profile" />
      </Screen>
    );
  }

  if (profile === null) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Edit profile" }} />
        <ErrorState
          title="We could not load your profile"
          message={errorMessage ?? "Check your connection and try again."}
          onRetry={refresh}
        />
      </Screen>
    );
  }

  return <EditProfileForm profile={profile} />;
}

interface EditProfileFormProps {
  profile: StudentProfileDetails;
}

function EditProfileForm({ profile }: EditProfileFormProps) {
  const { layout, spacing } = useTheme();
  const form = useEditProfileForm(profile);
  const universities = useUniversities();
  const skills = useSkills();
  const interests = useInterests();

  async function handleSave() {
    const result = await form.submit();

    if (result === "saved") {
      router.back();
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Edit profile" }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.fill}
      >
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing.xxxl,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              width: "100%",
              maxWidth: layout.maxContentWidth,
              alignSelf: "center",
              gap: spacing.xl,
            }}
          >
              <View style={{ gap: spacing.lg }}>
                <SectionHeading
                  title="About you"
                  hint="Your name and the short bio others read first."
                />
                <TextField
                  label="Name"
                  icon="person-outline"
                  value={form.draft.name}
                  onChangeText={(name) => form.edit({ name })}
                  error={form.issues.name}
                  autoCapitalize="words"
                  maxLength={NAME_MAX_LENGTH}
                  returnKeyType="next"
                  editable={!form.isSaving}
                />
                <TextField
                  label="Bio"
                  icon="chatbubble-ellipses-outline"
                  value={form.draft.bio}
                  onChangeText={(bio) => form.edit({ bio })}
                  error={form.issues.bio}
                  hint="Optional — a line about what you are into."
                  maxLength={BIO_MAX_LENGTH}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  editable={!form.isSaving}
                />
              </View>

              <View style={{ gap: spacing.lg }}>
                <SectionHeading
                  title="Education"
                  hint="Where and what you study."
                />
                <OptionList
                  options={universities.items}
                  keyOf={(university) => university.id}
                  labelOf={(university) => university.name}
                  secondaryLabelOf={locationOf}
                  searchTextOf={(university) =>
                    [university.name, university.city, university.country]
                      .filter((part): part is string => part !== null)
                      .join(" ")
                  }
                  selectedKey={form.draft.universityId}
                  onSelect={(university) =>
                    form.edit({ universityId: university.id })
                  }
                  onClear={() => form.edit({ universityId: null })}
                  isLoading={universities.status === "loading"}
                  errorMessage={universities.errorMessage}
                  onRetry={universities.refresh}
                  emptyMessage="No universities are listed yet."
                  searchPlaceholder="Search universities"
                  clearLabel="Clear university"
                />
                <TextField
                  label="Course"
                  icon="school-outline"
                  value={form.draft.degree}
                  onChangeText={(degree) => form.edit({ degree })}
                  error={form.issues.degree}
                  placeholder="B.Tech"
                  autoCapitalize="words"
                  maxLength={DEGREE_MAX_LENGTH}
                  editable={!form.isSaving}
                />
                <TextField
                  label="Branch"
                  icon="git-branch-outline"
                  value={form.draft.branch}
                  onChangeText={(branch) => form.edit({ branch })}
                  error={form.issues.branch}
                  placeholder="Computer Science"
                  autoCapitalize="words"
                  maxLength={BRANCH_MAX_LENGTH}
                  editable={!form.isSaving}
                />
                <TextField
                  label="Graduation year"
                  icon="calendar-outline"
                  value={form.draft.graduationYear}
                  onChangeText={(graduationYear) =>
                    form.edit({ graduationYear })
                  }
                  error={form.issues.graduationYear}
                  placeholder="2027"
                  keyboardType="number-pad"
                  maxLength={4}
                  editable={!form.isSaving}
                />
                <TextField
                  label="Location"
                  icon="location-outline"
                  value={form.draft.location}
                  onChangeText={(location) => form.edit({ location })}
                  error={form.issues.location}
                  placeholder="Bengaluru, India"
                  autoCapitalize="words"
                  maxLength={LOCATION_MAX_LENGTH}
                  editable={!form.isSaving}
                />
              </View>

              <View style={{ gap: spacing.md }}>
                <SectionHeading
                  title="Skills"
                  hint="What you can do — coursework, tools, languages."
                />
                <TagPicker
                  options={skills.items}
                  selectedIds={form.draft.skillIds}
                  onToggle={(id) =>
                    form.edit({ skillIds: toggle(id, form.draft.skillIds) })
                  }
                  searchPlaceholder="Search skills"
                  emptyMessage="No skills are listed yet."
                  noun="skill"
                  isLoading={skills.status === "loading"}
                  errorMessage={skills.errorMessage}
                  onRetry={skills.refresh}
                />
              </View>

              <View style={{ gap: spacing.md }}>
                <SectionHeading
                  title="Interests"
                  hint="What you follow and want to hear about."
                />
                <TagPicker
                  options={interests.items}
                  selectedIds={form.draft.interestIds}
                  onToggle={(id) =>
                    form.edit({
                      interestIds: toggle(id, form.draft.interestIds),
                    })
                  }
                  searchPlaceholder="Search interests"
                  emptyMessage="No interests are listed yet."
                  noun="interest"
                  isLoading={interests.status === "loading"}
                  errorMessage={interests.errorMessage}
                  onRetry={interests.refresh}
                />
              </View>

            {form.errorMessage !== null ? (
              <InlineError
                message={form.errorMessage}
                onDismiss={form.dismissError}
              />
            ) : null}

            <View style={{ gap: spacing.sm }}>
              <Button
                label="Save changes"
                icon="checkmark-circle-outline"
                size="lg"
                fullWidth
                onPress={handleSave}
                loading={form.isSaving}
              />
              <Button
                label="Cancel"
                variant="secondary"
                size="lg"
                fullWidth
                onPress={() => router.back()}
                disabled={form.isSaving}
              />
            </View>

            <AppText
              variant="caption"
              tone="muted"
              style={{ textAlign: "center" }}
            >
              Your handle is fixed once it is set — it is how classmates know
              you.
            </AppText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
