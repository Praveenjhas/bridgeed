import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { useTheme } from "@/theme";

export interface ProgramRowProps {
  name: string;
  /** `B.Tech · Mechanical Engineering`, or null when neither is recorded. */
  meta?: string | null;
  /** A short summary, shown under the meta line. */
  description?: string | null;
  /** Quiet trailing metadata, for example a subject count. */
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * One programme in a university's list, or in a programme's own header.
 *
 * A programme is a smaller, more specific object than a university, so its mark
 * is a plain icon rather than initials: the name carries the identity and the
 * icon only says "this is a course of study".
 */
export function ProgramRow({
  name,
  meta = null,
  description = null,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: ProgramRowProps) {
  const { colors, layout, radius, spacing } = useTheme();
  const mark = layout.avatar.sm;

  const body = (
    <View style={[styles.row, { gap: spacing.md, paddingVertical: spacing.md }]}>
      <View
        style={{
          width: mark,
          height: mark,
          borderRadius: radius.sm,
          backgroundColor: colors.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="book-outline" size={layout.icon.sm} tone="textSecondary" />
      </View>

      <View style={styles.text}>
        <AppText variant="subheading" numberOfLines={2}>
          {name}
        </AppText>
        {meta ? (
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {meta}
          </AppText>
        ) : null}
        {description ? (
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {description}
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
      accessibilityLabel={accessibilityLabel ?? name}
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
