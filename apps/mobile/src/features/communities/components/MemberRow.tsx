import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { CommunityMember } from "@bridgeed/shared";
import { AppText, Avatar, Badge } from "@/components";
import { useTheme } from "@/theme";
import { memberRoleLabel, roleTone } from "../labels";

export interface MemberRowProps {
  member: CommunityMember;
  /** Extra controls rendered under the member, used by the join request list. */
  action?: ReactNode;
}

/**
 * One member of a community.
 *
 * The role is the only thing that distinguishes members, so it is shown as a
 * badge in every context: on the roster, and on a pending request where a future
 * owner needs to know who is waiting.
 */
export const MemberRow = memo(function MemberRow({
  member,
  action,
}: MemberRowProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      <View style={[styles.row, { gap: spacing.md }]}>
        <Avatar
          name={member.member.name}
          imageUrl={member.member.profileImageUrl}
          size="sm"
        />
        <View style={styles.text}>
          <AppText variant="subheading" numberOfLines={1}>
            {member.member.name}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {`@${member.member.username}`}
          </AppText>
        </View>
        <Badge
          label={memberRoleLabel(member.role)}
          tone={roleTone(member.role)}
        />
      </View>
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
});
