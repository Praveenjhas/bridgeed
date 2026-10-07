import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "./AppText";
import { BrandWordmark } from "./BrandWordmark";
import { useTheme } from "@/theme";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Trailing controls, for example a refresh icon button. */
  actions?: ReactNode;
  /** Renders the product name above the title, used on top level screens. */
  showWordmark?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The screen header.
 *
 * It is a normal view rather than a navigation header, because the app needs a
 * subtitle, a wordmark and arbitrary trailing actions, and because keeping it in
 * the scroll tree makes pull to refresh work exactly as expected. It adds the
 * top safe area inset itself, so a screen never has to think about the notch.
 *
 * Editorially it sits directly on the paper background with no white bar and no
 * bottom border: the title is large, the subtitle is quiet, and whitespace below
 * separates the header from the content instead of a rule.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  showWordmark = false,
  style,
}: PageHeaderProps) {
  const { colors, layout, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: spacing.md,
          paddingHorizontal: layout.screenPadding,
        },
        style,
      ]}
    >
      <View style={[styles.row, { gap: spacing.md }]}>
        <View style={styles.titleBlock}>
          {showWordmark ? (
            <BrandWordmark size="sm" style={{ marginBottom: spacing.md }} />
          ) : null}
          <AppText variant="title" numberOfLines={1} accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText
              variant="body"
              tone="secondary"
              numberOfLines={2}
              style={{ marginTop: spacing.xs }}
            >
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {actions ? (
          <View style={[styles.actions, { gap: spacing.xs }]}>{actions}</View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    justifyContent: "flex-end",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleBlock: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
});
