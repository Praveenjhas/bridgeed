import { useCallback, useEffect, useRef, useState } from "react";
import { toUserMessage } from "@/utils/errors";

/** Lifecycle of a screen level read. */
export type LoadStatus = "loading" | "ready" | "error";

export interface AsyncValueResult<T> {
  data: T | null;
  status: LoadStatus;
  /** Message for the last failure, or null when the last read succeeded. */
  errorMessage: string | null;
  /** True while a pull to refresh style reload is in flight. */
  isRefreshing: boolean;
  /** Reloads without clearing what is already on screen. */
  refresh: () => void;
}

function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

/**
 * Reads one value from the API and keeps the three states a screen actually
 * needs: loading, ready and error.
 *
 * The loader is called with an `AbortSignal` that is triggered on unmount, on
 * reload and on `load` identity change, so a fast navigation never writes state
 * from a request that no longer matters. `load` must be referentially stable
 * (wrap it in `useCallback`), because its identity is what triggers a reload.
 */
export function useAsyncValue<T>(
  load: (signal: AbortSignal) => Promise<T>,
  enabled: boolean = true,
): AsyncValueResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isMounted = useRef(true);
  const hasData = useRef(false);
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
    async (mode: "initial" | "refresh") => {
      sequence.current += 1;
      const requestId = sequence.current;

      controller.current?.abort();
      const abortController = new AbortController();
      controller.current = abortController;

      if (mode === "initial") {
        setStatus("loading");
      } else {
        setIsRefreshing(true);
      }
      setErrorMessage(null);

      try {
        const value = await load(abortController.signal);

        if (!isMounted.current || sequence.current !== requestId) {
          return;
        }

        hasData.current = true;
        setData(value);
        setStatus("ready");
      } catch (error) {
        if (
          !isMounted.current ||
          sequence.current !== requestId ||
          isAborted(abortController.signal)
        ) {
          return;
        }

        setErrorMessage(toUserMessage(error));
        // A failed refresh keeps whatever is already displayed; a failed first
        // load has nothing to show, so it becomes the screen state.
        setStatus(hasData.current ? "ready" : "error");
      } finally {
        if (isMounted.current && sequence.current === requestId) {
          setIsRefreshing(false);
        }
      }
    },
    [load],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void run("initial");
  }, [enabled, run]);

  const refresh = useCallback(() => {
    void run("refresh");
  }, [run]);

  return { data, status, errorMessage, isRefreshing, refresh };
}
