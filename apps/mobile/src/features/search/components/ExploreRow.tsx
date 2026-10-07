import { Pressable, StyleSheet, View } from "react-native";
import type { SearchType } from "@bridgeed/shared";
import { AppText, Icon } from "@/components";
import { useTheme } from "@/theme";
import {
  SEARCH_TYPE_DESCRIPTIONS,
  SEARCH_TYPE_ICONS,
  SEARCH_TYPE_LABELS,
} from "../labels";

export interface ExploreRowProps {
  type: SearchType;
  /** True when this category is the one the next search will be sent to. */
  selected: boolean;
  onPress: (type: SearchType) => void;
}

/**
 * One category the reader can search inside.
 *
 * It is what the search screen shows before a term is typed: instead of an empty
 * page, the five things search can actually look at, each with a sentence saying
 * what it holds. Choosing one narrows the search before it starts, which is
 * cheaper than searching everything and then filtering what came back.
 */
export function ExploreRow({ type, selected, onPress }: ExploreRowProps) {
  const { colors, layout, radius, spacing } = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={SEARCH_TYPE_LABELS[type]}
      accessibilityHint={SEARCH_TYPE_DESCRIPTIONS[type]}
      onPress={() => onPress(type)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected
            ? colors.accentSoft
            : pressed
              ? colors.surfaceMuted
              : colors.surface,
          borderColor: selected ? colors.accent : colors.border,
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.md,
        },
      ]}
    >
      <View
        style={{
          width: layout.avatar.sm,
          height: layout.avatar.sm,
          borderRadius: radius.sm,
          backgroundColor: colors.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon
          name={SEARCH_TYPE_ICONS[type]}
          size={layout.icon.sm}
          tone={selected ? "accent" : "textSecondary"}
        />
      </View>

      <View style={styles.text}>
        <AppText variant="bodyStrong">{SEARCH_TYPE_LABELS[type]}</AppText>
        <AppText variant="caption" tone="muted">
          {SEARCH_TYPE_DESCRIPTIONS[type]}
        </AppText>
      </View>

      {selected ? (
        <Icon name="checkmark-circle" tone="accent" size={layout.icon.md} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
  },
});
