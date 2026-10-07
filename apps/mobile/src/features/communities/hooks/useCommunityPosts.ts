import { useCallback, useState } from "react";
import { DEFAULT_PAGE, type PostListItem } from "@bridgeed/shared";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import type { LoadStatus } from "@/hooks/useAsyncValue";
import { ApiError } from "@/services/api";
import { toUserMessage } from "@/utils/errors";
import {
  COMMUNITY_POSTS_PAGE_LIMIT,
  MAX_POST_CONTENT_LENGTH,
} from "../constants";
import {
  createCommunityPost,
  fetchCommunityPosts,
} from "../api/communityPosts.api";

export interface CommunityPostsState {
  posts: PostListItem[];
  /** Total number of posts the API reports for the community. */
  total: number | null;
  status: LoadStatus;
  errorMessage: string | null;
  /**
   * HTTP status of the last failed read. The API answers 409 when the reader is
   * not an active member, which a screen turns into a gate rather than an error.
   */
  errorStatus: number | null;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  refresh: () => void;
  loadMore: () => void;
  isSubmitting: boolean;
  submitErrorMessage: string | null;
  dismissSubmitError: () => void;
  /** Creates a post. Resolves true when the API accepted it. */
  submit: (content: string) => Promise<boolean>;
}

/**
 * The posts of one community, plus writing a new one.
 *
 * Reading is opt in: `enabled` is false until the reader is a known active
 * member, because the API requires exactly that and asking anyway would only
 * produce an error the screen has to explain away.
 *
 * After a successful write the first page is re-read instead of being patched
 * locally. The create endpoint returns the stored post, but not the author or the
 * engagement counts a card renders, and a locally inserted card would have to
 * invent them.
 */
export function useCommunityPosts(
  communityId: string | null,
  actorId: string | null,
  enabled: boolean,
): CommunityPostsState {
  const [total, setTotal] = useState<number | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(
    null,
  );

  const loadPage = useCallback(
    async (page: number | null, signal: AbortSignal) => {
      if (!communityId || !actorId) {
        return { items: [] as PostListItem[], nextCursor: null };
      }

      const requestedPage = page ?? DEFAULT_PAGE;

      try {
        const result = await fetchCommunityPosts({
          communityId,
          actorId,
          page: requestedPage,
          limit: COMMUNITY_POSTS_PAGE_LIMIT,
          signal,
        });

        if (!signal.aborted) {
          setTotal(result.total);
          setErrorStatus(null);
        }

        return {
          items: result.items,
          nextCursor:
            requestedPage < result.totalPages ? requestedPage + 1 : null,
        };
      } catch (error) {
        if (!signal.aborted) {
          setErrorStatus(error instanceof ApiError ? error.status : null);
        }

        throw error;
      }
    },
    [actorId, communityId],
  );

  const list = usePaginatedList<PostListItem, number>({
    loadPage,
    enabled: enabled && communityId !== null && actorId !== null,
  });

  const { refresh } = list;

  const submit = useCallback(
    async (content: string): Promise<boolean> => {
      if (!communityId || !actorId) {
        return false;
      }

      const trimmed = content.trim();

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
          communityId,
          authorId: actorId,
          content: trimmed,
        });
        refresh();
        return true;
      } catch (error) {
        setSubmitErrorMessage(toUserMessage(error));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [actorId, communityId, refresh],
  );

  const dismissSubmitError = useCallback(() => {
    setSubmitErrorMessage(null);
  }, []);

  return {
    posts: list.items,
    total,
    status: list.status,
    errorMessage: list.errorMessage,
    errorStatus,
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
