import { useCallback, useState } from "react";
import type { FeedItem } from "@bridgeed/shared";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { likePost, unlikePost } from "@/features/reactions";
import { toUserMessage } from "@/utils/errors";
import { fetchFeedPage } from "../api/feed.api";

/**
 * Page size for the mobile feed.
 *
 * Smaller than the shared default because a phone screen shows one or two cards
 * at a time: fetching twenty cards up front would spend network and memory on
 * content the reader has not scrolled to.
 */
const FEED_PAGE_LIMIT = 10;

/** Ranking metadata returned with the last page that was loaded. */
export interface FeedPageMeta {
  /** When the API generated this page. */
  generatedAt: string;
  /** How many deduplicated candidates were ranked for this request. */
  candidatesConsidered: number;
}

export interface FeedState {
  items: FeedItem[];
  status: "loading" | "ready" | "error";
  errorMessage: string | null;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  /** Metadata of the most recently loaded page, when there is one. */
  pageMeta: FeedPageMeta | null;
  /** Posts whose like request is currently in flight. */
  pendingLikeIds: ReadonlySet<string>;
  /** Failure of a like, which is shown without hiding the feed. */
  actionErrorMessage: string | null;
  dismissActionError: () => void;
  refresh: () => void;
  loadMore: () => void;
  /** Likes or unlikes a post, updating the card before the API answers. */
  toggleLike: (item: FeedItem) => void;
}

/**
 * Everything the feed screen needs: the ranked pages, refresh and pagination,
 * plus like handling.
 *
 * Likes are patched optimistically and rolled back if the API rejects them,
 * which matters because the feed request is expensive (it ranks every candidate)
 * and refetching it after each tap would feel broken.
 */
export function useFeed(actorId: string | null): FeedState {
  const [pageMeta, setPageMeta] = useState<FeedPageMeta | null>(null);
  const [pendingLikeIds, setPendingLikeIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null,
  );

  const loadPage = useCallback(
    async (cursor: string | null, signal: AbortSignal) => {
      if (!actorId) {
        return { items: [] as FeedItem[], nextCursor: null };
      }

      const page = await fetchFeedPage({
        cursor,
        limit: FEED_PAGE_LIMIT,
        signal,
      });

      setPageMeta({
        generatedAt: page.generatedAt,
        candidatesConsidered: page.candidatesConsidered,
      });

      return { items: page.items, nextCursor: page.nextCursor };
    },
    [actorId],
  );

  const list = usePaginatedList<FeedItem, string>({
    loadPage,
    enabled: actorId !== null,
  });

  const { updateItems } = list;

  const patchItem = useCallback(
    (postId: string, patch: Partial<FeedItem>) => {
      updateItems((items) =>
        items.map((item) =>
          item.id === postId ? { ...item, ...patch } : item,
        ),
      );
    },
    [updateItems],
  );

  const toggleLike = useCallback(
    (item: FeedItem) => {
      if (!actorId || pendingLikeIds.has(item.id)) {
        return;
      }

      const wasLiked = item.hasReacted;
      const previousCount = item.likeCount;
      const optimisticCount = Math.max(0, previousCount + (wasLiked ? -1 : 1));

      setActionErrorMessage(null);
      setPendingLikeIds((current) => new Set(current).add(item.id));
      patchItem(item.id, {
        hasReacted: !wasLiked,
        likeCount: optimisticCount,
      });

      // The reaction is attributed to the signed-in account by the API, so the
      // only thing the client says is which post moved.
      const request = wasLiked
        ? unlikePost({ postId: item.id })
        : likePost({ postId: item.id });

      void request
        .catch((error: unknown) => {
          patchItem(item.id, {
            hasReacted: wasLiked,
            likeCount: previousCount,
          });
          setActionErrorMessage(toUserMessage(error));
        })
        .finally(() => {
          setPendingLikeIds((current) => {
            const next = new Set(current);
            next.delete(item.id);
            return next;
          });
        });
    },
    [actorId, patchItem, pendingLikeIds],
  );

  const dismissActionError = useCallback(() => {
    setActionErrorMessage(null);
  }, []);

  return {
    items: list.items,
    status: list.status,
    errorMessage: list.errorMessage,
    isRefreshing: list.isRefreshing,
    isLoadingMore: list.isLoadingMore,
    hasMore: list.hasMore,
    pageMeta,
    pendingLikeIds,
    actionErrorMessage,
    dismissActionError,
    refresh: list.refresh,
    loadMore: list.loadMore,
    toggleLike,
  };
}
