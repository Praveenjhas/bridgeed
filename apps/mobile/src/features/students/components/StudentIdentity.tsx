import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { AppText, Avatar, type AvatarSize } from "@/components";
import { useTheme, type TypographyToken } from "@/theme";

export interface StudentIdentityProps {
  name: string;
  /** Handle without the leading `@`, which this component adds. */
  username: string;
  imageUrl?: string | null;
  /** Supporting line, for example a university or a course. Omitted when null. */
  meta?: string | null;
  size?: AvatarSize;
  /** Type step for the name, so a profile header can read as a title. */
  nameVariant?: TypographyToken;
  /** Rendered at the end of the row, for example a connection state badge. */
  trailing?: ReactNode;
}

/**
 * One student, as they appear in every list and header.
 *
 * Each row in this feature shows the same three things — a face, a name and a
 * handle — so they are rendered in one place. `meta` is optional on purpose: it
 * is only passed when the caller actually knows the student's university or
 * course, and it disappears entirely rather than leaving an empty line.
 */
export function StudentIdentity({
  name,
  username,
  imageUrl = null,
  meta = null,
  size = "md",
  nameVariant = "subheading",
  trailing,
}: StudentIdentityProps) {
  const { spacing } = useTheme();

  return (
    <View style={[styles.row, { gap: spacing.md }]}>
      <Avatar name={name} imageUrl={imageUrl} size={size} />
      <View style={styles.text}>
        <AppText variant={nameVariant} numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {`@${username}`}
        </AppText>
        {meta ? (
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {meta}
          </AppText>
        ) : null}
      </View>
      {trailing}
    </View>
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
});
