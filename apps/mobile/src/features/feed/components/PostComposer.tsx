import { StyleSheet, View } from "react-native";
import {
  AppText,
  Button,
  Card,
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
 * the only thing it decides is how the states look. The body field is a normal
 * `TextField` kept multi-line, so it shares the app's one field treatment
 * instead of inventing another input. The Post button reports its own busy state
 * and disables itself while there is nothing to send, which is what prevents a
 * double tap from posting twice.
 */
export function PostComposer({ form, onSubmit }: PostComposerProps) {
  const { spacing } = useTheme();
  const length = form.content.length;

  return (
    <View style={{ gap: spacing.lg }}>
      <Card>
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
      </Card>

      <Card>
        <TextField
          label="Your post"
          value={form.content}
          onChangeText={form.setContent}
          placeholder="Ask a question, share a resource, or start a study discussion."
          multiline
          numberOfLines={6}
          editable={!form.isSubmitting}
          hint={`${length} / ${MAX_POST_CONTENT_LENGTH} characters`}
          error={
            form.isOverLimit
              ? `Shorten your post by ${length - MAX_POST_CONTENT_LENGTH} characters.`
              : undefined
          }
          style={styles.body}
        />
      </Card>

      {form.submitErrorMessage !== null ? (
        <InlineError
          message={form.submitErrorMessage}
          onDismiss={form.dismissSubmitError}
        />
      ) : null}

      <Button
        label="Post"
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
