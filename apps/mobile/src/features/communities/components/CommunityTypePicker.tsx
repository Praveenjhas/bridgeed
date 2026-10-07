import { Pressable, StyleSheet, View } from "react-native";
import { COMMUNITY_TYPES, type CommunityType } from "@bridgeed/shared";
import { AppText, Icon } from "@/components";
import { useTheme } from "@/theme";
import {
  COMMUNITY_TYPE_DESCRIPTIONS,
  COMMUNITY_TYPE_LABELS,
} from "../labels";

export interface CommunityTypePickerProps {
  value: CommunityType;
  onChange: (value: CommunityType) => void;
  disabled?: boolean;
}

/** The two types in the order they are offered, public first. */
const OPTIONS: readonly CommunityType[] = [
  COMMUNITY_TYPES.PUBLIC,
  COMMUNITY_TYPES.PRIVATE,
];

/**
 * One-of-two picker for a community's visibility.
 *
 * Both options are shown at once, each with the consequence of choosing it, so
 * the difference between "anyone can join" and "requests need approval" is visible
 * before the choice is made rather than discovered afterwards.
 */
export function CommunityTypePicker({
  value,
  onChange,
  disabled = false,
}: CommunityTypePickerProps) {
  const { colors, layout, radius, spacing } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      {OPTIONS.map((option) => {
        const isSelected = option === value;

        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, disabled }}
            accessibilityLabel={COMMUNITY_TYPE_LABELS[option]}
            disabled={disabled}
            onPress={() => onChange(option)}
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
                gap: spacing.md,
              },
            ]}
          >
            <View style={styles.text}>
              <AppText variant="bodyStrong">
                {COMMUNITY_TYPE_LABELS[option]}
              </AppText>
              <AppText variant="caption" tone="muted">
                {COMMUNITY_TYPE_DESCRIPTIONS[option]}
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
