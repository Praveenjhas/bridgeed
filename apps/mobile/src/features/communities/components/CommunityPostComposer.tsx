import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import {
  DEFAULT_POST_TYPE,
  POST_TYPE_LABELS,
  type PostType,
} from "@bridgeed/shared";
import { AppText, Button, InlineError, PostTypeSelector } from "@/components";
import { useTheme } from "@/theme";
import { MAX_POST_CONTENT_LENGTH } from "../constants";

export interface CommunityPostComposerProps {
  /** Community the post goes to, used to name it in the input. */
  communityName: string;
  isSubmitting: boolean;
  errorMessage: string | null;
  onDismissError: () => void;
  /** Creates the post. Resolves true when the API accepted it. */
  onSubmit: (content: string, type: PostType) => Promise<boolean>;
}

/**
 * Composer for a community post.
 *
 * It stays out of the way until it is used: the input and one button while it is
 * empty, and a counter plus a clear action once something has been written. The
 * field is only emptied after the API accepted the post, so a rejected draft is
 * never lost, and the button reports its own busy state so a double tap cannot
 * post twice.
 *
 * The type appears with the draft rather than before it. A student who is about to
 * write a quick reply sees the same single line they always did, and one who has
 * started writing is offered the seven kinds of content as quiet chips — the same
 * choice the full composer gives, without turning the bottom of a community into a
 * form. The chosen type stays chosen after posting, because writing two questions
 * in a row is normal.
 */
export function CommunityPostComposer({
  communityName,
  isSubmitting,
  errorMessage,
  onDismissError,
  onSubmit,
}: CommunityPostComposerProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const [content, setContent] = useState("");
  const [type, setType] = useState<PostType>(DEFAULT_POST_TYPE);
  const length = content.length;
  const isOverLimit = length > MAX_POST_CONTENT_LENGTH;
  const canSubmit = !isSubmitting && content.trim().length > 0 && !isOverLimit;
  const hasDraft = length > 0;

  const handleSubmit = async () => {
    const created = await onSubmit(content, type);

    if (created) {
      setContent("");
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {errorMessage ? (
        <InlineError message={errorMessage} onDismiss={onDismissError} />
      ) : null}

      {hasDraft ? (
        <PostTypeSelector
          variant="chips"
          label="Posting as"
          value={type}
          onChange={setType}
          disabled={isSubmitting}
        />
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
          placeholder={`Share something with ${communityName}`}
          placeholderTextColor={colors.textMuted}
          editable={!isSubmitting}
          multiline
          accessibilityLabel={`Write a post for ${communityName}`}
          style={[styles.input, typography.body, { color: colors.textPrimary }]}
        />
        <Button
          label="Post"
          size="sm"
          icon="send"
          disabled={!canSubmit}
          loading={isSubmitting}
          onPress={handleSubmit}
        />
      </View>

      {length > 0 ? (
        <View style={[styles.meta, { gap: spacing.md }]}>
          <AppText variant="caption" tone={isOverLimit ? "danger" : "muted"}>
            {`${length}/${MAX_POST_CONTENT_LENGTH}`}
          </AppText>
          <AppText variant="caption" tone="muted" style={styles.metaText}>
            {isOverLimit
              ? `Shorten your post by ${length - MAX_POST_CONTENT_LENGTH} characters.`
              : `Shared as a ${POST_TYPE_LABELS[type].toLowerCase()}. Nothing is posted until you tap Post.`}
          </AppText>
          <Button
            label="Cancel"
            variant="tertiary"
            size="sm"
            disabled={isSubmitting}
            onPress={() => setContent("")}
          />
        </View>
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
  meta: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    flex: 1,
  },
});
