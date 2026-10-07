import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, Button, Icon, InlineError, TextField } from "@/components";
import { useTheme } from "@/theme";

export interface OptionListProps<T> {
  options: T[];
  /** Stable id of an option, used for the selection and for the React key. */
  keyOf: (option: T) => string;
  labelOf: (option: T) => string;
  /** Second line of an option, for example a university's location. */
  secondaryLabelOf?: (option: T) => string | null;
  /** Text the search box matches against. Defaults to the label. */
  searchTextOf?: (option: T) => string;
  /** Currently chosen option, or null while nothing is chosen. */
  selectedKey: string | null;
  onSelect: (option: T) => void;
  /** Clears the choice, because every list this renders for is optional. */
  onClear: () => void;
  isLoading: boolean;
  /** Message from the failed read of the list itself. */
  errorMessage: string | null;
  onRetry: () => void;
  emptyMessage: string;
  searchPlaceholder: string;
  clearLabel: string;
}

/**
 * One-of-many picker, with a search box over the list.
 *
 * The list is rendered inline rather than in a nested scroll view: the onboarding
 * screen scrolls as a whole, and a scrollable box inside a scrollable page fights
 * the gesture that is trying to reach the Continue button. With hundreds of
 * options that would be a problem — which is what the search box is for.
 */
export function OptionList<T>({
  options,
  keyOf,
  labelOf,
  secondaryLabelOf,
  searchTextOf,
  selectedKey,
  onSelect,
  onClear,
  isLoading,
  errorMessage,
  onRetry,
  emptyMessage,
  searchPlaceholder,
  clearLabel,
}: OptionListProps<T>) {
  const { colors, layout, radius, spacing } = useTheme();
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const matchesAgainst = searchTextOf ?? labelOf;

  if (isLoading && options.length === 0) {
    return (
      <AppText variant="caption" tone="muted">
        Loading the list…
      </AppText>
    );
  }

  if (errorMessage !== null) {
    return <InlineError message={errorMessage} onRetry={onRetry} />;
  }

  if (options.length === 0) {
    return (
      <AppText variant="caption" tone="muted">
        {emptyMessage}
      </AppText>
    );
  }

  const visible =
    needle.length === 0
      ? options
      : options.filter((option) =>
          matchesAgainst(option).toLowerCase().includes(needle),
        );

  return (
    <View style={{ gap: spacing.md }}>
      <TextField
        label={searchPlaceholder}
        icon="search-outline"
        value={query}
        onChangeText={setQuery}
        placeholder={searchPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      {visible.length === 0 ? (
        <AppText variant="caption" tone="muted">
          {`Nothing matches “${query.trim()}”.`}
        </AppText>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {visible.map((option) => {
            const key = keyOf(option);
            const isSelected = key === selectedKey;
            const secondary = secondaryLabelOf?.(option) ?? null;

            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={secondary ?? labelOf(option)}
                onPress={() => onSelect(option)}
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
                <View style={styles.optionText}>
                  <AppText variant="bodyStrong" numberOfLines={2}>
                    {labelOf(option)}
                  </AppText>
                  {secondary !== null ? (
                    <AppText variant="caption" tone="muted" numberOfLines={1}>
                      {secondary}
                    </AppText>
                  ) : null}
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
      )}

      {selectedKey !== null ? (
        <Button
          label={clearLabel}
          variant="tertiary"
          size="sm"
          icon="close-outline"
          onPress={onClear}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  optionText: {
    flex: 1,
  },
});
