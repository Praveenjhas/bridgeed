import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { useTheme } from "@/theme";

export interface SubjectRowProps {
  name: string;
  /** Quiet metadata line, for example the programme it is taught in. */
  meta?: string | null;
  /** Trailing element, used when a row needs an action instead of a chevron. */
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * One subject in a list.
 *
 * A subject is the smallest thing in the academic graph and has no mark of its
 * own — no face, no logo, no initials — so it is drawn as a hairline separated
 * row with a book glyph, its name and one quiet line of context. It matches the
 * programme row so a screen that lists both reads as one list of studies rather
 * than two different widgets.
 */
export function SubjectRow({
  name,
  meta = null,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: SubjectRowProps) {
  const { colors, layout, radius, spacing } = useTheme();
  const mark = layout.avatar.sm;

  const body = (
    <View
      style={[styles.row, { gap: spacing.md, paddingVertical: spacing.md }]}
    >
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
        <Icon
          name="library-outline"
          size={layout.icon.sm}
          tone="textSecondary"
        />
      </View>

      <View style={styles.text}>
        <AppText variant="subheading" numberOfLines={2}>
          {name}
        </AppText>
        {meta ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {meta}
          </AppText>
        ) : null}
      </View>

      {trailing ??
        (onPress ? (
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
