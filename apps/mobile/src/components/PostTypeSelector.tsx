import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  POST_TYPE_DESCRIPTIONS,
  POST_TYPE_LABELS,
  POST_TYPE_VALUES,
  type PostType,
} from "@bridgeed/shared";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { useTheme } from "@/theme";

export type PostTypeSelectorVariant = "list" | "chips";

export interface PostTypeSelectorProps {
  /** The chosen type; null when nothing is chosen, which only `chips` allows. */
  value: PostType | null;
  onChange: (value: PostType) => void;
  /**
   * `list` shows every type once with the line that explains it, which is how a
   * composer asks "what are you sharing?". `chips` is the compact one-line form
   * for a filter or an inline composer, where the same seven options have to fit
   * above the content they act on.
   */
  variant?: PostTypeSelectorVariant;
  /**
   * Adds an "All" chip that clears the selection, for the filter form where
   * "every kind" is a real answer. Chips only.
   */
  onClear?: () => void;
  /** Small heading above the chips, for example "Type". */
  label?: string;
  disabled?: boolean;
}

/** The two are the same set in the same order; only the presentation differs. */
const OPTIONS = POST_TYPE_VALUES;

/**
 * Picks what a post is.
 *
 * Both variants read the canonical labels and descriptions from the shared
 * contract, so the app can never offer a type the API would refuse, and the
 * seven options stay in the order the API documents. The selector is deliberately
 * calm: quiet outlines, one accent for the current choice, no gradients and no
 * grids of colourful cards.
 */
export function PostTypeSelector({
  value,
  onChange,
  variant = "list",
  onClear,
  label,
  disabled = false,
}: PostTypeSelectorProps) {
  const { colors, layout, radius, spacing } = useTheme();

  if (variant === "chips") {
    const chip = (
      key: string,
      text: string,
      isSelected: boolean,
      onPress: () => void,
    ) => (
      <Pressable
        key={key}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected, disabled }}
        accessibilityLabel={text}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.chip,
          {
            borderColor: isSelected ? colors.accent : colors.border,
            backgroundColor: isSelected
              ? colors.accentSoft
              : pressed
                ? colors.surfaceMuted
                : colors.transparent,
            borderRadius: radius.pill,
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <AppText variant="caption" tone={isSelected ? "accent" : "secondary"}>
          {text}
        </AppText>
      </Pressable>
    );

    return (
      <View style={{ gap: spacing.xs }}>
        {label ? (
          <AppText variant="label" tone="secondary">
            {label}
          </AppText>
        ) : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: spacing.sm }}
        >
          {onClear ? chip("any", "All", value === null, onClear) : null}
          {OPTIONS.map((option) =>
            chip(option, POST_TYPE_LABELS[option], option === value, () =>
              onChange(option),
            ),
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {OPTIONS.map((option) => {
        const isSelected = option === value;

        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, disabled }}
            accessibilityLabel={POST_TYPE_LABELS[option]}
            accessibilityHint={POST_TYPE_DESCRIPTIONS[option]}
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
              <AppText variant="bodyStrong">{POST_TYPE_LABELS[option]}</AppText>
              <AppText variant="caption" tone="muted">
                {POST_TYPE_DESCRIPTIONS[option]}
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
  chip: {
    alignSelf: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
