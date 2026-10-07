import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { AppText, BrandMark, Card, Screen } from "@/components";
import { useTheme } from "@/theme";

export interface AuthScaffoldProps {
  /** Headline of the screen, for example "Welcome back". */
  title: string;
  /** One supporting sentence under the headline. */
  subtitle: string;
  /** The form itself, rendered on the surface card. */
  children: ReactNode;
  /** Way across to the other credential screen, under the card. */
  footer: ReactNode;
}

/**
 * Shared frame for the sign in and sign up screens.
 *
 * The two screens are one experience with two sets of fields, so they share a
 * frame instead of each laying out its own brand block, card and footer.
 *
 * The composition is anchored to the top rather than floated in the middle. The
 * previous layout centred everything with `flexGrow: 1`, which on a tall phone
 * left a void above and below the form and, worse, left nowhere for the content
 * to go once the keyboard took the lower half — the call to action ended up
 * under the keys. Filling from the top and letting the scroll view absorb the
 * overflow keeps the hierarchy in one predictable place on every screen size.
 *
 * The keyboard is handled by two mechanisms: iOS is padded by
 * `KeyboardAvoidingView`, while Android resizes the window itself (Expo's
 * default `softwareKeyboardLayoutMode`), so it needs no wrapper and would
 * otherwise be adjusted twice.
 */
export function AuthScaffold({
  title,
  subtitle,
  children,
  footer,
}: AuthScaffoldProps) {
  const { colors, layout, spacing } = useTheme();

  return (
    <Screen safeTop safeBottom>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.fill}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              width: "100%",
              maxWidth: layout.maxContentWidth,
              alignSelf: "center",
              paddingHorizontal: layout.screenPadding,
              paddingTop: spacing.xxl,
              paddingBottom: spacing.xxl,
              gap: spacing.xxl,
            }}
          >
            <View style={{ gap: spacing.lg }}>
              <BrandMark />
              <View style={{ gap: spacing.xs }}>
                <AppText variant="display" accessibilityRole="header">
                  {title}
                </AppText>
                <AppText variant="body" tone="secondary">
                  {subtitle}
                </AppText>
              </View>
            </View>

            <Card style={{ padding: spacing.xl, gap: spacing.lg }}>
              {children}
            </Card>

            <View style={{ alignItems: "center" }}>{footer}</View>
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
  scrollContent: {
    flexGrow: 1,
  },
});
