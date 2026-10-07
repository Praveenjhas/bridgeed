import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Stack, router } from "expo-router";
import {
  AppText,
  Button,
  Card,
  EmptyState,
  InlineError,
  Screen,
  SectionHeading,
  TextField,
} from "@/components";
import {
  CommunityTypePicker,
  MAX_COMMUNITY_DESCRIPTION_LENGTH,
  MAX_COMMUNITY_NAME_LENGTH,
  MAX_COMMUNITY_SLUG_LENGTH,
  useCreateCommunity,
} from "@/features/communities";
import { useActor } from "@/providers/AuthProvider";
import { useTheme } from "@/theme";

/**
 * Create a study group.
 *
 * A community is owned by whoever creates it, and the create endpoint takes the
 * owner from the bearer token, so this screen sends only what the creator typed.
 * It is a pushed form rather than a step in onboarding because creating a group
 * is something a signed-in student does again and again, not a one-time setup.
 *
 * A successful create replaces this screen with the new community, so the creator
 * lands straight in the group they just made and going back returns to the tab
 * they came from rather than to an empty form.
 */
export default function CreateCommunityScreen() {
  const { isConfigured, detail } = useActor();
  const { spacing } = useTheme();
  const form = useCreateCommunity();

  const handleSubmit = async () => {
    const created = await form.submit();

    if (created) {
      router.replace({
        pathname: "/community/[communityId]",
        params: { communityId: created.id },
      });
    }
  };

  if (!isConfigured) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "New study group" }} />
        <EmptyState
          icon="person-outline"
          title="Sign in to create a group"
          message={detail}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "New study group" }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.fill}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing.xxxl,
          }}
        >
          <View style={{ gap: spacing.lg }}>
            <Card>
              <View style={{ gap: spacing.md }}>
                <SectionHeading
                  title="Name and handle"
                  hint="The name is what students read; the handle is how they find and mention the group."
                />
                <TextField
                  label="Name"
                  value={form.name}
                  onChangeText={form.setName}
                  placeholder="e.g. Algorithms Study Group"
                  icon="people-outline"
                  maxLength={MAX_COMMUNITY_NAME_LENGTH}
                  editable={!form.isSubmitting}
                  hint={`${form.name.trim().length} / ${MAX_COMMUNITY_NAME_LENGTH} characters`}
                  error={form.nameError ?? undefined}
                />
                <TextField
                  label="Handle"
                  value={form.slug}
                  onChangeText={form.setSlug}
                  placeholder="e.g. algorithms-study-group"
                  icon="at-outline"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!form.isSubmitting}
                  hint="Generated from the name until you change it."
                  error={form.slugError ?? undefined}
                />
              </View>
            </Card>

            <Card>
              <View style={{ gap: spacing.md }}>
                <SectionHeading
                  title="Who can join"
                  hint="You can change your mind later from the community's member list."
                />
                <CommunityTypePicker
                  value={form.type}
                  onChange={form.setType}
                  disabled={form.isSubmitting}
                />
              </View>
            </Card>

            <Card>
              <TextField
                label="Description"
                value={form.description}
                onChangeText={form.setDescription}
                placeholder="What is this group for? Subjects, exam dates, meeting rhythm."
                multiline
                numberOfLines={4}
                editable={!form.isSubmitting}
                hint={`${form.description.trim().length} / ${MAX_COMMUNITY_DESCRIPTION_LENGTH} characters`}
                error={
                  form.isDescriptionOverLimit
                    ? `Shorten your description by ${
                        form.description.trim().length -
                        MAX_COMMUNITY_DESCRIPTION_LENGTH
                      } characters.`
                    : undefined
                }
                style={styles.description}
              />
            </Card>

            {form.submitErrorMessage !== null ? (
              <InlineError
                message={form.submitErrorMessage}
                onDismiss={form.dismissSubmitError}
              />
            ) : null}

            <Button
              label="Create study group"
              icon="add-circle-outline"
              size="lg"
              fullWidth
              loading={form.isSubmitting}
              disabled={!form.canSubmit}
              onPress={handleSubmit}
            />

            <AppText variant="caption" tone="muted" style={styles.note}>
              You become the owner, so you can approve everyone who asks to join.
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
  description: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  note: {
    textAlign: "center",
  },
});
