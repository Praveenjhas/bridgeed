import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, Icon, InlineError, TextField } from "@/components";
import { useTheme } from "@/theme";

/** Above this many options the picker grows a search box of its own. */
const SEARCH_THRESHOLD = 8;

export interface TagPickerProps {
  /** The catalog the student picks from. */
  options: { id: string; name: string }[];
  /** Ids that are currently chosen. */
  selectedIds: string[];
  onToggle: (id: string) => void;
  searchPlaceholder: string;
  emptyMessage: string;
  /** Noun for the counter and the accessibility label, for example "skill". */
  noun: string;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
}

/**
 * Many-of-many picker drawn as chips.
 *
 * The chips keep the catalog's order instead of moving what is selected to the
 * front: a chip that jumps position under the thumb is how a tap lands on the
 * wrong skill. What is chosen is shown by the accent fill, a check and the
 * counter underneath, none of which move the chip.
 */
export function TagPicker({
  options,
  selectedIds,
  onToggle,
  searchPlaceholder,
  emptyMessage,
  noun,
  isLoading,
  errorMessage,
  onRetry,
}: TagPickerProps) {
  const { colors, layout, radius, spacing } = useTheme();
  const [query, setQuery] = useState("");

  const isSearchable = options.length > SEARCH_THRESHOLD;
  const needle = query.trim().toLowerCase();

  const visible = useMemo(() => {
    if (needle.length === 0) {
      return options;
    }

    return options.filter((option) =>
      option.name.toLowerCase().includes(needle),
    );
  }, [needle, options]);

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

  return (
    <View style={{ gap: spacing.md }}>
      {isSearchable ? (
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
      ) : null}

      {visible.length === 0 ? (
        <AppText variant="caption" tone="muted">
          {`No ${noun} matches “${query.trim()}”.`}
        </AppText>
      ) : (
        <View style={[styles.row, { gap: spacing.sm }]}>
          {visible.map((option) => {
            const isSelected = selectedIds.includes(option.id);

            return (
              <Pressable
                key={option.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={option.name}
                onPress={() => onToggle(option.id)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: isSelected
                      ? colors.accentSoft
                      : pressed
                        ? colors.surfaceMuted
                        : colors.surface,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderRadius: radius.sm,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    gap: spacing.xs,
                  },
                ]}
              >
                {isSelected ? (
                  <Icon name="checkmark" tone="accent" size={layout.icon.sm} />
                ) : null}
                <AppText
                  variant="caption"
                  tone={isSelected ? "accent" : "secondary"}
                >
                  {option.name}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      )}

      <AppText variant="caption" tone="muted">
        {selectedIds.length === 0
          ? `No ${noun} chosen yet — this step is optional.`
          : `${selectedIds.length} ${noun}${selectedIds.length === 1 ? "" : "s"} chosen`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
});
