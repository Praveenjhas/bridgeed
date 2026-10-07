import { useCallback, useEffect, useRef, useState } from "react";
import type { LoadStatus } from "./useAsyncValue";
import { toUserMessage } from "@/utils/errors";

/** One page of a cursor paginated list. */
export interface Page<Item, Cursor> {
  items: Item[];
  /** Cursor for the next page, or null when the list is exhausted. */
  nextCursor: Cursor | null;
}

export interface PaginatedListOptions<Item extends { id: string }, Cursor> {
  /**
   * Fetches one page. `cursor` is null for the first page.
   *
   * Must be referentially stable (wrap it in `useCallback`): its identity is
   * what tells the hook to start over with a fresh first page, which is how the
   * feed reloads when the actor changes.
   */
  loadPage: (
    cursor: Cursor | null,
    signal: AbortSignal,
  ) => Promise<Page<Item, Cursor>>;
  /** Skip loading entirely, for example while configuration is missing. */
  enabled?: boolean;
}

export interface PaginatedListResult<Item> {
  items: Item[];
  status: LoadStatus;
  /** Message for the last failure, or null when the last read succeeded. */
  errorMessage: string | null;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  /** Restarts from the first page, keeping the current items visible. */
  refresh: () => void;
  /** Appends the next page when one exists and nothing else is in flight. */
  loadMore: () => void;
  /**
   * Replaces items in place, used for optimistic updates such as a like that
   * has not been confirmed by the server yet.
   */
  updateItems: (updater: (items: Item[]) => Item[]) => void;
}

/**
 * Appends a page while dropping ids that are already listed.
 *
 * The feed is ranked, so its page boundaries are not stable: an item can move
 * from page two into page one between requests. Without this guard the list
 * would show duplicate cards and React would warn about duplicate keys.
 */
function appendPage<Item extends { id: string }>(
  previous: Item[],
  incoming: Item[],
): Item[] {
  const seen = new Set(previous.map((item) => item.id));

  return [...previous, ...incoming.filter((item) => !seen.has(item.id))];
}

/**
 * Loads a cursor paginated list with the four states a list screen needs:
 * first load, refreshing, loading the next page and failure.
 *
 * Only one request is in flight at a time: a newer request aborts the previous
 * one and wins, so rapid pulling or scrolling cannot interleave pages.
 */
export function usePaginatedList<Item extends { id: string }, Cursor>({
  loadPage,
  enabled = true,
}: PaginatedListOptions<Item, Cursor>): PaginatedListResult<Item> {
  const [items, setItems] = useState<Item[]>([]);
  const [nextCursor, setNextCursor] = useState<Cursor | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const isMounted = useRef(true);
  const hasLoaded = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      controller.current?.abort();
    };
  }, []);

  const run = useCallback(
    async (mode: "initial" | "refresh" | "more", cursor: Cursor | null) => {
      sequence.current += 1;
      const requestId = sequence.current;

      controller.current?.abort();
      const abortController = new AbortController();
      controller.current = abortController;

      if (mode === "initial") {
        setStatus("loading");
      } else if (mode === "refresh") {
        setIsRefreshing(true);
      } else {
        setIsLoadingMore(true);
      }
      setErrorMessage(null);

      try {
        const page = await loadPage(cursor, abortController.signal);

        if (!isMounted.current || sequence.current !== requestId) {
          return;
        }

        hasLoaded.current = true;
        // A server that keeps returning the same cursor would make "load more"
        // loop forever, so an unchanged cursor is treated as the end.
        setNextCursor(
          page.nextCursor !== null && page.nextCursor === cursor
            ? null
            : page.nextCursor,
        );
        setItems((previous) =>
          mode === "more" ? appendPage(previous, page.items) : page.items,
        );
        setStatus("ready");
      } catch (error) {
        if (
          !isMounted.current ||
          sequence.current !== requestId ||
          abortController.signal.aborted
        ) {
          return;
        }

        setErrorMessage(toUserMessage(error));
        // A failed refresh or a failed "load more" keeps the list that is
        // already on screen; only a failed first load becomes the screen state.
        setStatus(hasLoaded.current ? "ready" : "error");
      } finally {
        if (isMounted.current && sequence.current === requestId) {
          setIsRefreshing(false);
          setIsLoadingMore(false);
        }
      }
    },
    [loadPage],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void run("initial", null);
  }, [enabled, run]);

  const refresh = useCallback(() => {
    void run("refresh", null);
  }, [run]);

  const loadMore = useCallback(() => {
    if (
      nextCursor === null ||
      isRefreshing ||
      isLoadingMore ||
      status !== "ready"
    ) {
      return;
    }

    void run("more", nextCursor);
  }, [isLoadingMore, isRefreshing, nextCursor, run, status]);

  const updateItems = useCallback((updater: (current: Item[]) => Item[]) => {
    setItems((current) => updater(current));
  }, []);

  return {
    items,
    status,
    errorMessage,
    isRefreshing,
    isLoadingMore,
    hasMore: nextCursor !== null,
    refresh,
    loadMore,
    updateItems,
  };
}
