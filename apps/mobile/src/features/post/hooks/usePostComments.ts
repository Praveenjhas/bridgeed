import { useCallback, useState } from "react";
import { DEFAULT_PAGE, type CommentListItem } from "@bridgeed/shared";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import type { LoadStatus } from "@/hooks/useAsyncValue";
import { toUserMessage } from "@/utils/errors";
import { createPostComment, fetchPostComments } from "../api/comments.api";

/** Comments fetched per page. Matches the shared default page size. */
const COMMENTS_PAGE_LIMIT = 20;

export interface PostCommentsState {
  comments: CommentListItem[];
  /** Total number of comments the API reports for the post. */
  total: number | null;
  status: LoadStatus;
  errorMessage: string | null;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  refresh: () => void;
  loadMore: () => void;
  isSubmitting: boolean;
  submitErrorMessage: string | null;
  dismissSubmitError: () => void;
  /** Creates a comment. Resolves true when the thread was refreshed. */
  submit: (content: string) => Promise<boolean>;
}

/**
 * The comment thread of one post, plus posting a new comment.
 *
 * The comment endpoints are paged by number rather than by cursor, so the page
 * number is used as the list cursor: it stays meaningful for a thread that only
 * grows at the end. After a successful post the whole thread is reloaded instead
 * of being patched locally, so ordering, author data and counts all come from
 * the API rather than from a guess.
 */
export function usePostComments(
  postId: string | null,
  actorId: string | null,
): PostCommentsState {
  const [total, setTotal] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(
    null,
  );

  const loadPage = useCallback(
    async (page: number | null, signal: AbortSignal) => {
      if (!postId || !actorId) {
        return { items: [] as CommentListItem[], nextCursor: null };
      }

      const requestedPage = page ?? DEFAULT_PAGE;
      const result = await fetchPostComments({
        postId,
        actorId,
        page: requestedPage,
        limit: COMMENTS_PAGE_LIMIT,
        signal,
      });

      setTotal(result.total);

      return {
        items: result.items,
        nextCursor:
          requestedPage < result.totalPages ? requestedPage + 1 : null,
      };
    },
    [actorId, postId],
  );

  const list = usePaginatedList<CommentListItem, number>({
    loadPage,
    enabled: Boolean(postId && actorId),
  });

  const { refresh } = list;

  const submit = useCallback(
    async (content: string): Promise<boolean> => {
      if (!postId || !actorId) {
        return false;
      }

      const trimmed = content.trim();

      if (trimmed.length === 0) {
        setSubmitErrorMessage("Write something before posting your comment.");
        return false;
      }

      setIsSubmitting(true);
      setSubmitErrorMessage(null);

      try {
        await createPostComment({ postId, actorId, content: trimmed });
        refresh();
        return true;
      } catch (error) {
        setSubmitErrorMessage(toUserMessage(error));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [actorId, postId, refresh],
  );

  const dismissSubmitError = useCallback(() => {
    setSubmitErrorMessage(null);
  }, []);

  return {
    comments: list.items,
    total,
    status: list.status,
    errorMessage: list.errorMessage,
    isRefreshing: list.isRefreshing,
    isLoadingMore: list.isLoadingMore,
    hasMore: list.hasMore,
    refresh: list.refresh,
    loadMore: list.loadMore,
    isSubmitting,
    submitErrorMessage,
    dismissSubmitError,
    submit,
  };
}
