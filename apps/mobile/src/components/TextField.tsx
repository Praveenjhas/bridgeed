import { forwardRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";
import { useTheme } from "@/theme";

export interface TextFieldProps extends TextInputProps {
  /** Label above the field. Also used as the accessibility label. */
  label: string;
  /** Supporting line under the field, such as a password rule. */
  hint?: string;
  /**
   * Message shown in the hint's place when the value is rejected.
   *
   * The hint and the error share one slot on purpose: a message appearing where
   * the helper text already was cannot push the rest of the form down, so telling
   * someone their passwords do not match does not move the button they are trying
   * to press.
   */
  error?: string;
  /** Leading icon, such as a mail glyph on an email field. */
  icon?: IconName;
}

/**
 * A labelled text field.
 *
 * The app has no general form input: the composers need a lightweight inline
 * box, and student onboarding and profile editing will need the full labelled
 * field that the credential screens use. Building it here once means the sign in,
 * sign up and every later form share one height, one radius, one focus
 * treatment and one error treatment, instead of each screen inventing them.
 *
 * It mirrors `TextInput`, so any native prop still works, and it adds only the
 * states a form actually needs: focus, error, disabled, and a reveal toggle on
 * anything that is being typed in secret.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(
  (
    {
      label,
      hint,
      error,
      icon,
      style,
      secureTextEntry,
      editable,
      accessibilityLabel,
      onFocus,
      onBlur,
      ...rest
    },
    ref,
  ) => {
    const { colors, layout, radius, spacing, typography } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const [isRevealed, setIsRevealed] = useState(false);

    const hasError = error !== undefined;
    const isSecret = secureTextEntry === true;
    const message = hasError ? error : hint;

    // One border whose colour carries the state, so focus and failure never
    // change the field's height.
    const borderColor = hasError
      ? colors.danger
      : isFocused
        ? colors.accent
        : colors.borderStrong;

    return (
      <View style={{ gap: spacing.xs }}>
        <AppText variant="caption" tone="secondary" style={styles.label}>
          {label}
        </AppText>

        <View
          style={[
            styles.control,
            {
              borderColor,
              borderRadius: radius.md,
              minHeight: layout.controlHeight,
              backgroundColor: colors.surface,
              paddingLeft: spacing.md,
              paddingRight: isSecret ? spacing.xs : spacing.md,
              gap: spacing.sm,
            },
          ]}
        >
          {icon ? (
            <Icon
              name={icon}
              size={layout.icon.sm}
              tone={hasError ? "danger" : isFocused ? "accent" : "textMuted"}
            />
          ) : null}

          <TextInput
            {...rest}
            ref={ref}
            editable={editable}
            secureTextEntry={isSecret && !isRevealed}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityState={{ disabled: editable === false }}
            onFocus={(event) => {
              setIsFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setIsFocused(false);
              onBlur?.(event);
            }}
            style={[
              styles.input,
              typography.body,
              { color: colors.textPrimary },
              style,
            ]}
          />

          {isSecret ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isRevealed ? "Hide password" : "Show password"
              }
              accessibilityState={{ selected: isRevealed }}
              onPress={() => setIsRevealed((revealed) => !revealed)}
              style={({ pressed }) => [
                styles.reveal,
                {
                  borderRadius: radius.pill,
                  backgroundColor: pressed
                    ? colors.surfaceMuted
                    : colors.transparent,
                },
              ]}
            >
              <Icon
                name={isRevealed ? "eye-off-outline" : "eye-outline"}
                size={layout.icon.md}
                tone="textMuted"
              />
            </Pressable>
          ) : null}
        </View>

        {message !== undefined ? (
          <AppText
            variant="caption"
            tone={hasError ? "danger" : "muted"}
            accessibilityLiveRegion="polite"
          >
            {message}
          </AppText>
        ) : null}
      </View>
    );
  },
);

TextField.displayName = "TextField";

const styles = StyleSheet.create({
  label: {
    fontWeight: "600",
  },
  control: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  input: {
    flex: 1,
    // The row centres the text, so the input itself must not add its own
    // vertical padding or the baseline drifts between Android versions.
    paddingVertical: 0,
  },
  reveal: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
