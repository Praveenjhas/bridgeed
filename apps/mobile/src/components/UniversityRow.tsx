import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { initialsOf } from "./Avatar";
import { Icon } from "./Icon";
import { useTheme } from "@/theme";

export interface UniversityRowProps {
  name: string;
  /** `Bengaluru, Karnataka, India`, or null when the record has no place on it. */
  location?: string | null;
  /** A short summary, shown under the location. */
  description?: string | null;
  /** Quiet metadata line, for example "12 programs · 340 students". */
  meta?: string | null;
  logoUrl?: string | null;
  /** Trailing element, used when a row needs an action instead of a chevron. */
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * One institution in the university directory.
 *
 * It is deliberately not a student row: an institution has no handle and no
 * circular face, so it is drawn with a square academic mark, the name, its place
 * and a quiet counts line. The square mark is what makes the directory read as a
 * list of institutions rather than a list of people.
 */
export function UniversityRow({
  name,
  location = null,
  description = null,
  meta = null,
  logoUrl = null,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: UniversityRowProps) {
  const { colors, fonts, layout, radius, spacing } = useTheme();
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
          overflow: "hidden",
        }}
      >
        {logoUrl ? (
          <Image
            source={{ uri: logoUrl }}
            style={{ width: mark, height: mark }}
          />
        ) : (
          <AppText
            tone="accent"
            style={{ fontFamily: fonts.headingBold, fontSize: 15 }}
          >
            {initialsOf(name)}
          </AppText>
        )}
      </View>

      <View style={styles.text}>
        <AppText variant="subheading" numberOfLines={2}>
          {name}
        </AppText>
        {location ? (
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {location}
          </AppText>
        ) : null}
        {description ? (
          <AppText variant="caption" tone="muted" numberOfLines={2}>
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
