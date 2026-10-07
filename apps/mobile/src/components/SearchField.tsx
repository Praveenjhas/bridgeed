import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { useTheme } from "@/theme";

export interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  onClear: () => void;
  /** Shown while the field is empty. */
  placeholder?: string;
  /**
   * Screen reader label. Defaults to the placeholder, with its ellipsis removed,
   * because "Search universities..." is not what a label should sound like.
   */
  accessibilityLabel?: string;
  /** Focuses the field as soon as the screen is on, used by the search screen. */
  autoFocus?: boolean;
  /** Called when the keyboard's search key is pressed. */
  onSubmitEditing?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The one search field in the app.
 *
 * It is extracted because the universities, communities and connections screens
 * each grew their own copy of the same field, and three copies of a control is
 * three places for its padding, its clear button and its accessibility label to
 * drift apart. It sits directly on the paper background with a thin border and a
 * quiet leading glyph, so a screen full of content keeps the field as the only
 * thing that looks like an input.
 */
export function SearchField({
  value,
  onChangeText,
  onClear,
  placeholder = "Search",
  accessibilityLabel,
  autoFocus = false,
  onSubmitEditing,
  style,
}: SearchFieldProps) {
  const { colors, layout, radius, spacing, typography } = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          gap: spacing.sm,
          minHeight: layout.minTouchTarget,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingLeft: spacing.md,
          paddingRight: spacing.xs,
        },
        style,
      ]}
    >
      <Icon name="search" size={layout.icon.sm} tone="textMuted" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={
          accessibilityLabel ?? placeholder.replace(/\.+$/, "")
        }
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        style={[styles.input, typography.body, { color: colors.textPrimary }]}
      />
      {value.length > 0 ? (
        <IconButton
          icon="close-circle"
          accessibilityLabel="Clear the search"
          size={layout.icon.md}
          onPress={onClear}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    paddingVertical: 8,
  },
});
