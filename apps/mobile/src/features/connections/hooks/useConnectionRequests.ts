import { useCallback } from "react";
import type { Connection } from "@bridgeed/shared";
import { useAsyncValue, type LoadStatus } from "@/hooks/useAsyncValue";
import { fetchReceivedConnectionRequests } from "../api/connections.api";

export interface ConnectionRequestsState {
  /** Pending requests this student has received, newest first. */
  requests: Connection[];
  status: LoadStatus;
  errorMessage: string | null;
  isRefreshing: boolean;
  refresh: () => void;
}

/** Shared empty list, so the hook never returns a fresh array per render. */
const EMPTY_REQUESTS: Connection[] = [];

/**
 * The connection requests a student has received and not yet answered.
 *
 * The endpoint already filters by recipient and by pending status, so the screen
 * never has to decide what counts as an incoming request, and the list it
 * renders is exactly what the backend considers actionable.
 */
export function useConnectionRequests(
  actorId: string | null,
): ConnectionRequestsState {
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!actorId) {
        throw new Error("A student is required to read connection requests.");
      }

      return fetchReceivedConnectionRequests({ userId: actorId, signal });
    },
    [actorId],
  );

  const { data, status, errorMessage, isRefreshing, refresh } = useAsyncValue(
    load,
    Boolean(actorId),
  );

  return {
    requests: data ?? EMPTY_REQUESTS,
    status,
    errorMessage,
    isRefreshing,
    refresh,
  };
}
