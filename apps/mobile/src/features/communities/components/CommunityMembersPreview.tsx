import { StyleSheet, View } from "react-native";
import type { CommunityMember } from "@bridgeed/shared";
import { AppText, Avatar, Button, Card, SectionHeading } from "@/components";
import { useTheme } from "@/theme";
import { MEMBERS_PREVIEW_AVATARS } from "../constants";
import { formatMemberCount } from "../labels";

export interface CommunityMembersPreviewProps {
  members: CommunityMember[];
  /** Total the API reports, or null before the first read. */
  total: number | null;
  onSeeAll: () => void;
}

/**
 * The first few members of a community, above its posts.
 *
 * A community with nobody visible is hard to trust, so the preview shows a real
 * slice of the roster and a way into the full list instead of a count on its own.
 */
export function CommunityMembersPreview({
  members,
  total,
  onSeeAll,
}: CommunityMembersPreviewProps) {
  const { spacing } = useTheme();
  const visible = members.slice(0, MEMBERS_PREVIEW_AVATARS);
  const hidden = total !== null ? Math.max(0, total - visible.length) : 0;

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <SectionHeading
          title="Members"
          hint={total !== null ? formatMemberCount(total) : undefined}
        />

        {visible.length > 0 ? (
          <View style={[styles.avatars, { gap: spacing.sm }]}>
            {visible.map((member) => (
              <Avatar
                key={member.id}
                name={member.member.name}
                imageUrl={member.member.profileImageUrl}
                size="sm"
              />
            ))}
            {hidden > 0 ? (
              <AppText variant="caption" tone="muted">
                {`+${hidden}`}
              </AppText>
            ) : null}
          </View>
        ) : (
          <AppText variant="caption" tone="muted">
            {total === 0
              ? "Nobody has joined this community yet."
              : "Loading the first members"}
          </AppText>
        )}

        <Button
          label="See all members"
          variant="secondary"
          size="sm"
          onPress={onSeeAll}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  avatars: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
});
