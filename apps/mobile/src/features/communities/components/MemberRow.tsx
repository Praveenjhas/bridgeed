import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { CommunityMember } from "@bridgeed/shared";
import { AppText, Avatar } from "@/components";
import { useTheme } from "@/theme";
import { memberRoleLabel } from "../labels";

export interface MemberRowProps {
  member: CommunityMember;
  /** Extra controls rendered under the member, used by the join request list. */
  action?: ReactNode;
  /** Opens the member's profile, when the screen can navigate there. */
  onPress?: () => void;
}

/**
 * One member of a community.
 *
 * A face, a name and a handle, with the role as a quiet label on the right rather
 * than a badge — the role is metadata, and a badge on every member would drown the
 * names. It is a row, separated from its neighbours by a hairline, so a roster
 * reads as a people directory.
 */
export const MemberRow = memo(function MemberRow({
  member,
  action,
  onPress,
}: MemberRowProps) {
  const { spacing } = useTheme();

  const body = (
    <View style={[styles.row, { gap: spacing.md, paddingVertical: spacing.md }]}>
      <Avatar
        name={member.member.name}
        imageUrl={member.member.profileImageUrl}
        size="md"
      />
      <View style={styles.text}>
        <AppText variant="subheading" numberOfLines={1}>
          {member.member.name}
        </AppText>
        <AppText
          variant="caption"
          tone="muted"
          numberOfLines={1}
          style={{ marginTop: spacing.xxs }}
        >
          {`@${member.member.username}`}
        </AppText>
      </View>
      <AppText variant="caption" tone="muted">
        {memberRoleLabel(member.role)}
      </AppText>
    </View>
  );

  return (
    <View style={{ gap: spacing.sm }}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${member.member.name}, @${member.member.username}`}
          onPress={onPress}
          style={({ pressed }) => (pressed ? styles.pressed : null)}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
      {action ? (
        <View style={[styles.actions, { gap: spacing.sm }]}>{action}</View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  pressed: {
    opacity: 0.6,
  },
});
