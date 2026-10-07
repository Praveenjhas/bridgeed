import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_PAGE,
  type SearchPagination,
  type SearchResultCounts,
  type SearchResultGroups,
  type SearchType,
} from "@bridgeed/shared";
import type { LoadStatus } from "@/hooks/useAsyncValue";
import { toUserMessage } from "@/utils/errors";
import {
  MIN_SEARCH_TERM_LENGTH,
  SEARCH_PAGE_LIMIT,
  SEARCH_PREVIEW_LIMIT,
} from "../constants";
import { fetchSearch } from "../api/search.api";

export interface SearchState {
  /**
   * Rows per category, with the pages loaded so far appended.
   *
   * Every group is always present, so a screen can render a section without
   * checking whether the category was searched at all. Null means nothing has
   * been read yet, which is what the prompt before a term is typed is drawn from.
   */
  results: SearchResultGroups | null;
  /** How many matches each category holds, from the latest answer. */
  counts: SearchResultCounts | null;
  /** The page the latest answer described. */
  pagination: SearchPagination | null;
  status: LoadStatus;
  errorMessage: string | null;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  /** True once the term is long enough to be worth asking about. */
  isSearchable: boolean;
  refresh: () => void;
  loadMore: () => void;
}

/** Appends the rows of a new page onto the rows already loaded. */
function mergePages(
  current: SearchResultGroups | null,
  incoming: SearchResultGroups,
): SearchResultGroups {
  if (current === null) {
    return incoming;
  }

  return {
    universities: [...current.universities, ...incoming.universities],
    programs: [...current.programs, ...incoming.programs],
    subjects: [...current.subjects, ...incoming.subjects],
    communities: [...current.communities, ...incoming.communities],
    students: [...current.students, ...incoming.students],
  };
}

/**
 * Global search, one term at a time.
 *
 * It is not built on `usePaginatedList` because a search answer is not one flat
 * list: a grouped read returns five capped groups plus the counts behind them, and
 * a typed read pages inside a single one of those groups. Keeping the whole
 * documented answer (groups, counts, pagination) in state is what lets the screen
 * say "Showing 5 of 12" and switch between the preview and the full category
 * without a second request shape.
 *
 * The term and the category are the loader's identity: either of them changing
 * restarts from page one and clears what is on screen, so rows can never be shown
 * under a term they did not match. A term shorter than `MIN_SEARCH_TERM_LENGTH` is
 * never sent — the hook clears itself and reports `isSearchable: false`, and the
 * screen explains why instead of asking for a term that would match half the
 * catalog.
 */
export function useSearch(term: string, type: SearchType | null): SearchState {
  const trimmed = term.trim();
  const isSearchable = trimmed.length >= MIN_SEARCH_TERM_LENGTH;

  const [results, setResults] = useState<SearchResultGroups | null>(null);
  const [counts, setCounts] = useState<SearchResultCounts | null>(null);
  const [pagination, setPagination] = useState<SearchPagination | null>(null);
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
    async (mode: "initial" | "refresh" | "more", page: number | null) => {
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
        const response = await fetchSearch({
          term: trimmed,
          type,
          page: page ?? DEFAULT_PAGE,
          limit: type === null ? SEARCH_PREVIEW_LIMIT : SEARCH_PAGE_LIMIT,
          signal: abortController.signal,
        });

        if (!isMounted.current || sequence.current !== requestId) {
          return;
        }

        hasLoaded.current = true;
        setResults((current) =>
          mode === "more"
            ? mergePages(current, response.results)
            : response.results,
        );
        // The counts describe the whole category rather than the page, so the
        // latest answer's counts stay correct as further pages are appended.
        setCounts(response.counts);
        setPagination(response.pagination);
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
        // A failed refresh or a failed "load more" keeps what is already on
        // screen; only a failed first read becomes the screen state.
        setStatus(hasLoaded.current ? "ready" : "error");
      } finally {
        if (isMounted.current && sequence.current === requestId) {
          setIsRefreshing(false);
          setIsLoadingMore(false);
        }
      }
    },
    [trimmed, type],
  );

  useEffect(() => {
    if (!isSearchable) {
      // Nothing worth asking about: cancel anything in flight and go quiet rather
      // than leaving the previous term's rows under a term they did not match.
      sequence.current += 1;
      controller.current?.abort();
      hasLoaded.current = false;
      setResults(null);
      setCounts(null);
      setPagination(null);
      setErrorMessage(null);
      setStatus("ready");

      return;
    }

    hasLoaded.current = false;
    setResults(null);
    void run("initial", null);
  }, [isSearchable, run]);

  const refresh = useCallback(() => {
    if (!isSearchable) {
      return;
    }

    void run("refresh", null);
  }, [isSearchable, run]);

  const loadMore = useCallback(() => {
    if (
      pagination === null ||
      isRefreshing ||
      isLoadingMore ||
      status !== "ready" ||
      pagination.page >= pagination.totalPages
    ) {
      return;
    }

    void run("more", pagination.page + 1);
  }, [isLoadingMore, isRefreshing, pagination, run, status]);

  return {
    results,
    counts,
    pagination,
    status,
    errorMessage,
    isRefreshing,
    isLoadingMore,
    hasMore: pagination !== null && pagination.page < pagination.totalPages,
    isSearchable,
    refresh,
    loadMore,
  };
}
