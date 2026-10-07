import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { useTheme } from "@/theme";

export interface InlineErrorProps {
  message: string;
  /** Shown as a compact action when the failure is worth retrying. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Adds a dismiss affordance when the message can be cleared. */
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Non blocking failure message.
 *
 * It is used when something already on screen is still valid, for example a
 * like that did not go through or a second page that failed to load. It never
 * replaces content, so a failed action does not wipe the screen.
 */
export function InlineError({
  message,
  onRetry,
  retryLabel = "Retry",
  onDismiss,
  style,
}: InlineErrorProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <View
      accessibilityRole="alert"
      // Announced when it appears, so a rejected submit is not only visible.
      accessibilityLiveRegion="polite"
      style={[
        styles.base,
        {
          backgroundColor: colors.dangerSoft,
          borderRadius: radius.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      <Icon
        name="alert-circle-outline"
        tone="danger"
        size={16}
        // A glyph is a `Text`; nudged onto the first line of a wrapping message
        // because the row aligns to the top rather than the middle.
        style={styles.icon}
      />
      <AppText variant="caption" tone="danger" style={styles.message}>
        {message}
      </AppText>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          hitSlop={spacing.sm}
        >
          <AppText variant="caption" tone="danger" style={styles.action}>
            {retryLabel}
          </AppText>
        </Pressable>
      ) : null}
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
          onPress={onDismiss}
          hitSlop={spacing.sm}
        >
          <Icon name="close" tone="danger" size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  icon: {
    marginTop: 1,
  },
  message: {
    flex: 1,
  },
  action: {
    textDecorationLine: "underline",
  },
});
