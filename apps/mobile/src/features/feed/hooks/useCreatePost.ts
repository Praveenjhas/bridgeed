import { useCallback, useState } from "react";
import {
  COMMUNITY_MEMBERSHIP_STATUSES,
  type CommunityMembershipWithCommunity,
} from "@bridgeed/shared";
import {
  createCommunityPost,
  MAX_POST_CONTENT_LENGTH,
} from "@/features/communities";
import { toUserMessage } from "@/utils/errors";
import { notifyFeedRefresh } from "../feed-refresh";

/**
 * Everything the create-post composer needs: which communities the writer may
 * post to, the draft, its validation and the submit itself.
 */
export interface CreatePostState {
  /** Communities the writer may post to, in the order the API returned them. */
  targets: CommunityMembershipWithCommunity[];
  /** Chosen community id, or null when the writer has none to post to. */
  selectedCommunityId: string | null;
  selectCommunity: (communityId: string) => void;
  content: string;
  setContent: (value: string) => void;
  /** True while the create request is in flight. */
  isSubmitting: boolean;
  /** True once the draft is longer than the API accepts. */
  isOverLimit: boolean;
  /** Result of the last failed submit, or null. */
  submitErrorMessage: string | null;
  dismissSubmitError: () => void;
  /** True when a community is chosen, there is content and nothing is in flight. */
  canSubmit: boolean;
  /** Creates the post. Resolves true once the API accepted it. */
  submit: () => Promise<boolean>;
}

/**
 * Drives the create-post composer.
 *
 * A post is owned by the community it is written in, so the writer first picks
 * one of the communities they are an active member of; the selection defaults to
 * the first one so a student in a single community never has to choose. The
 * author is never part of the request — the API takes it from the bearer token —
 * so the body carries only the content.
 *
 * On success it empties the draft and asks the feed to reload, which is what
 * makes the new post appear without the feed having to refresh on every focus.
 */
export function useCreatePost(
  memberships: CommunityMembershipWithCommunity[],
): CreatePostState {
  const targets = memberships.filter(
    (membership) => membership.status === COMMUNITY_MEMBERSHIP_STATUSES.ACTIVE,
  );

  const [chosenId, setChosenId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(
    null,
  );

  // The chosen id only sticks while it is still a valid target; otherwise the
  // first target is used, so the default follows the list without an effect.
  const selectedCommunityId =
    chosenId !== null &&
    targets.some((target) => target.communityId === chosenId)
      ? chosenId
      : (targets[0]?.communityId ?? null);

  const isOverLimit = content.length > MAX_POST_CONTENT_LENGTH;
  const canSubmit =
    !isSubmitting &&
    selectedCommunityId !== null &&
    content.trim().length > 0 &&
    !isOverLimit;

  const dismissSubmitError = useCallback(() => {
    setSubmitErrorMessage(null);
  }, []);

  const submit = useCallback(async (): Promise<boolean> => {
    const trimmed = content.trim();

    if (selectedCommunityId === null) {
      setSubmitErrorMessage("Choose a community to post in.");
      return false;
    }

    if (trimmed.length === 0) {
      setSubmitErrorMessage("Write something before posting.");
      return false;
    }

    if (trimmed.length > MAX_POST_CONTENT_LENGTH) {
      setSubmitErrorMessage(
        `Posts can be at most ${MAX_POST_CONTENT_LENGTH} characters.`,
      );
      return false;
    }

    setIsSubmitting(true);
    setSubmitErrorMessage(null);

    try {
      await createCommunityPost({
        communityId: selectedCommunityId,
        content: trimmed,
      });
      setContent("");
      notifyFeedRefresh();
      return true;
    } catch (error) {
      setSubmitErrorMessage(toUserMessage(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [content, selectedCommunityId]);

  return {
    targets,
    selectedCommunityId,
    selectCommunity: setChosenId,
    content,
    setContent,
    isSubmitting,
    isOverLimit,
    submitErrorMessage,
    dismissSubmitError,
    canSubmit,
    submit,
  };
}
