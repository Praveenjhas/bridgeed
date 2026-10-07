import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { AppText, Button, InlineError } from "@/components";
import { useTheme } from "@/theme";

export interface CommentComposerProps {
  /** Creates the comment. Resolves true when it was accepted. */
  onSubmit: (content: string) => Promise<boolean>;
  isSubmitting: boolean;
  errorMessage: string | null;
  onDismissError: () => void;
  /** Set when there is no actor to comment as. */
  disabled?: boolean;
}

/**
 * Input for a new comment.
 *
 * The field only clears once the API accepted the comment, so a rejected
 * comment is never lost. The button follows the same rule: it reports a busy
 * state and blocks a second submit while the first is in flight.
 */
export function CommentComposer({
  onSubmit,
  isSubmitting,
  errorMessage,
  onDismissError,
  disabled = false,
}: CommentComposerProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const [content, setContent] = useState("");
  const canSubmit = !disabled && !isSubmitting && content.trim().length > 0;

  const handleSubmit = async () => {
    const created = await onSubmit(content);

    if (created) {
      setContent("");
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {errorMessage ? (
        <InlineError message={errorMessage} onDismiss={onDismissError} />
      ) : null}
      <View
        style={[
          styles.row,
          {
            gap: spacing.sm,
            backgroundColor: colors.surfaceMuted,
            borderRadius: radius.md,
            padding: spacing.sm,
          },
        ]}
      >
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder={disabled ? "Set an actor to comment" : "Add a comment"}
          placeholderTextColor={colors.textMuted}
          editable={!disabled}
          multiline
          accessibilityLabel="Comment text"
          style={[styles.input, typography.body, { color: colors.textPrimary }]}
        />
        <Button
          label="Comment"
          size="sm"
          icon="send"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={isSubmitting}
        />
      </View>
      {disabled ? (
        <AppText variant="caption" tone="muted">
          Comments are disabled until the app knows which student it is acting
          as.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    maxHeight: 120,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
});
