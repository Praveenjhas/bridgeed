import { ScrollView, View } from "react-native";
import { AppText } from "./AppText";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Icon, type IconName } from "./Icon";
import { PageHeader } from "./PageHeader";
import { Screen } from "./Screen";
import { useTheme } from "@/theme";

export interface FeaturePlaceholderProps {
  title: string;
  subtitle?: string;
  icon: IconName;
  /** Explains what the screen is waiting for. */
  message: string;
  /** What this screen will do once its API exists. */
  planned?: string[];
}

/**
 * A screen that is part of the shell but not built yet.
 *
 * Placeholders are explicit rather than blank: they say what is missing and what
 * is coming, so an unfinished area is never mistaken for a broken one.
 */
export function FeaturePlaceholder({
  title,
  subtitle,
  icon,
  message,
  planned = [],
}: FeaturePlaceholderProps) {
  const { spacing } = useTheme();

  return (
    <Screen>
      <PageHeader title={title} subtitle={subtitle} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      >
        <EmptyState
          icon={icon}
          title={`${title} is on the way`}
          message={message}
        />
        {planned.length > 0 ? (
          <Card>
            <AppText variant="heading" style={{ marginBottom: spacing.md }}>
              Planned for this screen
            </AppText>
            <View style={{ gap: spacing.sm }}>
              {planned.map((entry) => (
                <View
                  key={entry}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: spacing.sm,
                  }}
                >
                  <Icon name="ellipse" size={8} tone="accent" />
                  <AppText variant="body" tone="secondary" style={{ flex: 1 }}>
                    {entry}
                  </AppText>
                </View>
              ))}
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
