import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { Avatar, type AvatarSize } from "./Avatar";
import { Icon } from "./Icon";
import { useTheme } from "@/theme";

export interface StudentRowProps {
  name: string;
  /** Handle without the leading `@`, which this row adds. */
  username: string;
  imageUrl?: string | null;
  /** Supporting line, for example a university. */
  meta?: string | null;
  /** Second supporting line, for example a course and graduation year. */
  secondary?: string | null;
  size?: AvatarSize;
  /** Trailing element, such as a connection state or a button. */
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * One student in a directory.
 *
 * A face, a name, a handle and the academic facts a classmate can act on — laid
 * out as a row with a hairline between neighbours, so the student list reads as a
 * people directory rather than a grid of cards. This is the one place a student is
 * drawn, so every list of students looks the same.
 */
export function StudentRow({
  name,
  username,
  imageUrl = null,
  meta = null,
  secondary = null,
  size = "md",
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: StudentRowProps) {
  const { spacing } = useTheme();

  const body = (
    <View style={[styles.row, { gap: spacing.md, paddingVertical: spacing.md }]}>
      <Avatar name={name} imageUrl={imageUrl} size={size} />
      <View style={styles.text}>
        <AppText variant="subheading" numberOfLines={1}>
          {name}
        </AppText>
        <AppText
          variant="caption"
          tone="muted"
          numberOfLines={1}
          style={{ marginTop: spacing.xxs }}
        >
          {`@${username}`}
        </AppText>
        {meta ? (
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {meta}
          </AppText>
        ) : null}
        {secondary ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {secondary}
          </AppText>
        ) : null}
      </View>
      {trailing ?? (onPress ? (
        <Icon name="chevron-forward" size={16} tone="textDisabled" />
      ) : null)}
    </View>
  );

  if (!onPress) {
    return body;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${name}, @${username}`}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
