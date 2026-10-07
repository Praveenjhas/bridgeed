import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components";
import { useTheme } from "@/theme";

export interface AuthSwitchPromptProps {
  /** The question or statement that introduces the link. */
  prompt: string;
  /** The link itself, for example "Create an account". */
  actionLabel: string;
  onPress: () => void;
}

/**
 * The way across from sign in to sign up and back.
 *
 * It replaces the bare text link the screens used to end with: the link keeps an
 * accent colour and a visible pressed state, and its touch area is padded well
 * past the height of the glyphs it is drawn from, so it is comfortably tappable
 * on a phone without changing how it looks.
 */
export function AuthSwitchPrompt({
  prompt,
  actionLabel,
  onPress,
}: AuthSwitchPromptProps) {
  const { radius, spacing } = useTheme();

  return (
    <View style={styles.row}>
      <AppText variant="body" tone="secondary">
        {prompt}
      </AppText>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={actionLabel}
        onPress={onPress}
        hitSlop={{
          top: spacing.md,
          bottom: spacing.md,
          left: spacing.sm,
          right: spacing.sm,
        }}
        style={({ pressed }) => [
          {
            borderRadius: radius.sm,
            paddingHorizontal: spacing.xxs,
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <AppText variant="bodyStrong" tone="accent">
          {actionLabel}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    columnGap: 4,
    rowGap: 2,
  },
});
