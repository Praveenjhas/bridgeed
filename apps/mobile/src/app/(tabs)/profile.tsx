import { useState } from "react";
import { ScrollView, View } from "react-native";
import {
  AppText,
  Button,
  Card,
  Divider,
  EmptyState,
  InlineError,
  PageHeader,
  Screen,
} from "@/components";
import { resolveApiBaseUrl } from "@/config/env";
import { useActor, useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/theme";
import { toUserMessage } from "@/utils/errors";

interface ConfigRowProps {
  label: string;
  value: string;
  hint: string;
}

function ConfigRow({ label, value, hint }: ConfigRowProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing.xxs }}>
      <AppText variant="overline" tone="muted">
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
      <AppText variant="caption" tone="secondary">
        {hint}
      </AppText>
    </View>
  );
}

/**
 * Profile tab.
 *
 * It reports who the app is signed in as, which student's content it is ranking,
 * and which API it is talking to. Those three values explain almost every "why is
 * my feed empty" question, and they are resolved from the same helpers the API
 * client uses, so what is shown is what is used.
 *
 * Signing out lives here rather than in a settings screen because it is the one
 * account action the app currently has.
 */
export default function ProfileScreen() {
  const { spacing } = useTheme();
  const { user, logout } = useAuth();
  const actor = useActor();
  const api = resolveApiBaseUrl();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignOut() {
    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      await logout();
      // On success the root guard swaps this screen for sign-in, so the state
      // above is never seen again.
    } catch (error) {
      setErrorMessage(toUserMessage(error));
      setIsSigningOut(false);
    }
  }

  return (
    <Screen>
      <PageHeader
        title="Profile"
        subtitle="Your account and this build's configuration"
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      >
        <Card>
          <AppText variant="heading" style={{ marginBottom: spacing.md }}>
            Account
          </AppText>
          <ConfigRow
            label="Signed in as"
            value={user?.email ?? "Not signed in"}
            hint={actor.detail}
          />
          <Divider spacing="md" />
          <ConfigRow
            label="Student id"
            value={actor.actorId ?? "Unknown"}
            hint="Your feed, communities and connections are all ranked for this student."
          />
          <Divider spacing="md" />
          <View style={{ gap: spacing.md }}>
            <ConfigRow
              label="API base URL"
              value={api.baseUrl ?? "Not configured"}
              hint={api.detail}
            />
            {errorMessage !== null ? (
              <InlineError
                message={errorMessage}
                onDismiss={() => setErrorMessage(null)}
              />
            ) : null}
            <Button
              label="Sign out"
              icon="log-out-outline"
              variant="secondary"
              onPress={handleSignOut}
              loading={isSigningOut}
              fullWidth
            />
          </View>
        </Card>

        <Card>
          <EmptyState
            icon="person-circle-outline"
            title="Profile is on the way"
            message="Your bio, skills, interests and university details all have endpoints already. This screen will read the student profile API and let you edit it."
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
