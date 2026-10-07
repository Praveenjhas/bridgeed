import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Stack, router } from "expo-router";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
} from "@/components";
import { useCommunityMemberships } from "@/features/communities";
import { PostComposer, useCreatePost } from "@/features/feed";
import { useActor } from "@/providers/AuthProvider";
import { useTheme } from "@/theme";

/**
 * Create a post.
 *
 * A post belongs to a community, so the screen first reads the student's own
 * memberships and only offers a composer once there is somewhere to post. Every
 * outcome is handled: no session, memberships still loading, memberships that
 * failed to load, no community to post in yet, and the form itself. A successful
 * post returns to the feed, which reloads through the feed refresh signal.
 */
export default function CreatePostScreen() {
  const { actorId, isConfigured, detail } = useActor();
  const memberships = useCommunityMemberships(actorId);
  const { spacing } = useTheme();
  const form = useCreatePost(memberships.memberships);

  const handleSubmit = async () => {
    const created = await form.submit();

    if (created) {
      router.back();
    }
  };

  if (!isConfigured) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Create post" }} />
        <EmptyState
          icon="person-outline"
          title="Sign in to post"
          message={detail}
        />
      </Screen>
    );
  }

  const isLoadingMemberships =
    memberships.status === "loading" && memberships.memberships.length === 0;
  const hasTargets = form.targets.length > 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: "Create post" }} />
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
          {isLoadingMemberships ? (
            <LoadingState label="Checking your communities" />
          ) : !hasTargets && memberships.status === "error" ? (
            <ErrorState
              message={
                memberships.errorMessage ??
                "Your communities could not be loaded."
              }
              onRetry={memberships.refresh}
            />
          ) : !hasTargets ? (
            <EmptyState
              icon="people-outline"
              title="Join a community to post"
              message="Posts live inside communities so the right students see them. Join or start one, then share your question or resource."
              action={
                <Button
                  label="Browse communities"
                  icon="people-outline"
                  onPress={() => router.replace("/(tabs)/communities")}
                />
              }
            />
          ) : (
            <PostComposer form={form} onSubmit={handleSubmit} />
          )}
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
