import { StyleSheet, View } from "react-native";
import {
  AppText,
  Button,
  InlineError,
  SectionHeading,
  TextField,
} from "@/components";
import { MAX_POST_CONTENT_LENGTH } from "@/features/communities";
import { useTheme } from "@/theme";
import { ComposeTargetPicker } from "./ComposeTargetPicker";
import type { CreatePostState } from "../hooks/useCreatePost";

export interface PostComposerProps {
  /** Draft, target and validation, owned by `useCreatePost`. */
  form: CreatePostState;
  /** Creates the post. The screen navigates away once it resolves true. */
  onSubmit: () => void;
}

/**
 * Composer for a new post.
 *
 * It is presentation only: every piece of state comes from the passed form, and
 * the only thing it decides is how the states look. It is deliberately unboxed —
 * the destination, the body and the one action stack straight on the paper with
 * whitespace between them, so writing a post feels like filling a page rather than
 * a form. The Publish button reports its own busy state and disables itself while
 * there is nothing to send, which prevents a double tap from posting twice.
 */
export function PostComposer({ form, onSubmit }: PostComposerProps) {
  const { spacing } = useTheme();
  const length = form.content.length;

  return (
    <View style={{ gap: spacing.xxl }}>
      <View style={{ gap: spacing.md }}>
        <SectionHeading
          title="Post to"
          hint="Your post lands in this community, and in the feed of everyone in it."
        />
        <ComposeTargetPicker
          targets={form.targets}
          selectedCommunityId={form.selectedCommunityId}
          onSelect={form.selectCommunity}
          disabled={form.isSubmitting}
        />
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeading title="What do you want to say?" />
        <TextField
          label="Your post"
          value={form.content}
          onChangeText={form.setContent}
          placeholder="Share something useful, interesting, or worth discussing…"
          multiline
          numberOfLines={8}
          editable={!form.isSubmitting}
          hint={`${length} / ${MAX_POST_CONTENT_LENGTH} characters`}
          error={
            form.isOverLimit
              ? `Shorten your post by ${length - MAX_POST_CONTENT_LENGTH} characters.`
              : undefined
          }
          style={styles.body}
        />
      </View>

      {form.submitErrorMessage !== null ? (
        <InlineError
          message={form.submitErrorMessage}
          onDismiss={form.dismissSubmitError}
        />
      ) : null}

      <Button
        label="Publish"
        icon="send"
        size="lg"
        fullWidth
        loading={form.isSubmitting}
        disabled={!form.canSubmit}
        onPress={onSubmit}
      />

      <AppText variant="caption" tone="muted" style={styles.note}>
        Posts are text only for now. Questions, notes and study plans read best.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    minHeight: 140,
    textAlignVertical: "top",
  },
  note: {
    textAlign: "center",
  },
});
