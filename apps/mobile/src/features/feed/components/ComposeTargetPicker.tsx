import { Pressable, StyleSheet, View } from "react-native";
import type { CommunityMembershipWithCommunity } from "@bridgeed/shared";
import { AppText, Icon } from "@/components";
import { communityTypeLabel } from "@/features/communities";
import { useTheme } from "@/theme";

export interface ComposeTargetPickerProps {
  /** Communities the writer may post to. Always at least one. */
  targets: CommunityMembershipWithCommunity[];
  selectedCommunityId: string | null;
  onSelect: (communityId: string) => void;
  disabled?: boolean;
}

/** Secondary line of a target: its visibility and its handle. */
function describeTarget(target: CommunityMembershipWithCommunity): string {
  return [`@${target.community.slug}`, communityTypeLabel(target.community.type)]
    .filter((part) => part.length > 0)
    .join(" · ");
}

/**
 * One-of-many picker of the communities a post can go to.
 *
 * It is rendered inline rather than as a menu because a student is usually in a
 * handful of communities: showing them all at once makes the destination of a
 * post visible before it is written, which is the whole point of choosing it.
 */
export function ComposeTargetPicker({
  targets,
  selectedCommunityId,
  onSelect,
  disabled = false,
}: ComposeTargetPickerProps) {
  const { colors, layout, radius, spacing } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      {targets.map((target) => {
        const isSelected = target.communityId === selectedCommunityId;

        return (
          <Pressable
            key={target.communityId}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, disabled }}
            accessibilityLabel={target.community.name}
            disabled={disabled}
            onPress={() => onSelect(target.communityId)}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: isSelected
                  ? colors.accentSoft
                  : pressed
                    ? colors.surfaceMuted
                    : colors.surface,
                borderColor: isSelected ? colors.accent : colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: spacing.sm,
              },
            ]}
          >
            <View style={styles.text}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {target.community.name}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {describeTarget(target)}
              </AppText>
            </View>
            {isSelected ? (
              <Icon
                name="checkmark-circle"
                tone="accent"
                size={layout.icon.md}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  text: {
    flex: 1,
  },
});
