import { ScrollView, View } from "react-native";
import {
  AppText,
  Card,
  Divider,
  EmptyState,
  PageHeader,
  Screen,
} from "@/components";
import { resolveApiBaseUrl } from "@/config/env";
import { useActor } from "@/providers/ActorProvider";
import { useTheme } from "@/theme";

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
 * Until there is a session, the most useful thing this screen can do is report
 * the configuration the app is running with: which student it acts as and which
 * API it talks to. Those two values explain almost every "why is my feed empty"
 * question during development, and they are resolved from the same helpers the
 * API client uses, so what is shown is what is used.
 */
export default function ProfileScreen() {
  const { spacing } = useTheme();
  const actor = useActor();
  const api = resolveApiBaseUrl();

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
            Configuration
          </AppText>
          <ConfigRow
            label="Acting as"
            value={actor.actorId ?? "Not configured"}
            hint={actor.detail}
          />
          <Divider spacing="md" />
          <ConfigRow
            label="API base URL"
            value={api.baseUrl ?? "Not configured"}
            hint={api.detail}
          />
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
