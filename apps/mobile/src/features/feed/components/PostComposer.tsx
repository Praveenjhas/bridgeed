import { StyleSheet, View } from "react-native";
import {
  POST_TYPES,
  POST_TYPE_DESCRIPTIONS,
  POST_TYPE_LABELS,
  type PostType,
} from "@bridgeed/shared";
import {
  AppText,
  Button,
  InlineError,
  PostTypeSelector,
  SectionHeading,
  TextField,
} from "@/components";
import { MAX_POST_CONTENT_LENGTH } from "@/features/communities";
import { useTheme } from "@/theme";
import { ComposeTargetPicker } from "./ComposeTargetPicker";
import type { CreatePostState } from "../hooks/useCreatePost";

/**
 * What the editor asks a writer for, per type.
 *
 * These are UI guidance only: the API stores the type and the text, and has no
 * field for a prompt. They live here rather than in the shared contract because
 * they are what the editor says, not what a post is.
 */
const POST_TYPE_PROMPTS: Record<PostType, string> = {
  [POST_TYPES.DISCUSSION]: "Start a discussion…",
  [POST_TYPES.QUESTION]: "What would you like to ask?",
  [POST_TYPES.RESOURCE]: "What are you sharing?",
  [POST_TYPES.ACHIEVEMENT]: "What did you accomplish?",
  [POST_TYPES.RESEARCH]: "What are you researching?",
  [POST_TYPES.ANNOUNCEMENT]: "What do students need to know?",
  [POST_TYPES.OPPORTUNITY]: "What opportunity are you sharing?",
};

export interface PostComposerProps {
  /** Draft, target, type and validation, owned by `useCreatePost`. */
  form: CreatePostState;
  /** Creates the post. The screen navigates away once it resolves true. */
  onSubmit: () => void;
}

/**
 * Composer for a new post.
 *
 * It is presentation only: every piece of state comes from the passed form, and
 * the only thing it decides is how the states look. It is deliberately unboxed —
 * the type, the destination, the body and the one action stack straight on the
 * paper with whitespace between them, so writing a post feels like filling a page
 * rather than a form. The Publish button reports its own busy state and disables
 * itself while there is nothing to send, which prevents a double tap from posting
 * twice.
 *
 * The type comes first, because it is the question a student answers before they
 * write: what is this? Choosing one changes what the editor asks for and what the
 * post will be labelled, so the choice is visible before the first keystroke and
 * the heading above the field confirms it afterwards.
 */
export function PostComposer({ form, onSubmit }: PostComposerProps) {
  const { spacing } = useTheme();
  const length = form.content.length;
  const prompt = POST_TYPE_PROMPTS[form.type];

  return (
    <View style={{ gap: spacing.xxl }}>
      <View style={{ gap: spacing.md }}>
        <SectionHeading
          title="What are you sharing?"
          hint="Every post says what it is, so the right students can find it."
        />
        <PostTypeSelector
          value={form.type}
          onChange={form.selectType}
          disabled={form.isSubmitting}
        />
      </View>

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
        <SectionHeading
          title={POST_TYPE_LABELS[form.type]}
          hint={POST_TYPE_DESCRIPTIONS[form.type]}
        />
        <TextField
          label="Your post"
          value={form.content}
          onChangeText={form.setContent}
          placeholder={prompt}
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
        Posts are text only for now, so questions, notes and study plans read
        best. Attachments come later.
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
