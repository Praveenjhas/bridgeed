import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "./AppText";
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
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.md,
          paddingHorizontal: layout.screenPadding,
          minHeight: layout.headerHeight + insets.top,
        },
        style,
      ]}
    >
      <View style={[styles.row, { gap: spacing.md }]}>
        <View style={styles.titleBlock}>
          {showWordmark ? (
            <AppText variant="overline" tone="accent">
              BridgeEd
            </AppText>
          ) : null}
          <AppText variant="title" numberOfLines={1} accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText
              variant="caption"
              tone="muted"
              numberOfLines={2}
              style={{ marginTop: spacing.xxs }}
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
