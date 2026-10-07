import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { useTheme } from "@/theme";

export interface CommunityRowProps {
  name: string;
  /** Short description, shown under the name. */
  description?: string | null;
  /** Quiet metadata line, for example a member count. */
  meta?: string | null;
  /** Trailing element, such as a membership badge. */
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * One community in a list.
 *
 * It is a row rather than a card: a community mark, the name, a short description
 * and a quiet metadata line, separated from its neighbours by a hairline. Rows
 * keep a directory of communities readable, where a stack of rounded cards reads
 * as a widget gallery.
 */
export function CommunityRow({
  name,
  description = null,
  meta = null,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: CommunityRowProps) {
  const { colors, layout, radius, spacing } = useTheme();
  const mark = layout.avatar.md;

  const body = (
    <View style={[styles.row, { gap: spacing.md, paddingVertical: spacing.md }]}>
      <View
        style={{
          width: mark,
          height: mark,
          borderRadius: radius.md,
          backgroundColor: colors.accentSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="people-outline" size={layout.icon.md} tone="accent" />
      </View>
      <View style={styles.text}>
        <AppText variant="subheading" numberOfLines={1}>
          {name}
        </AppText>
        {description ? (
          <AppText
            variant="caption"
            tone="secondary"
            numberOfLines={2}
            style={{ marginTop: spacing.xxs }}
          >
            {description}
          </AppText>
        ) : null}
        {meta ? (
          <AppText
            variant="caption"
            tone="muted"
            numberOfLines={1}
            style={{ marginTop: spacing.xxs }}
          >
            {meta}
          </AppText>
        ) : null}
      </View>
      {trailing ?? <Icon name="chevron-forward" size={16} tone="textDisabled" />}
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
