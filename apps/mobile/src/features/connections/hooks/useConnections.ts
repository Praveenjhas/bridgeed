import { useCallback } from "react";
import { CONNECTION_STATUSES, type Connection } from "@bridgeed/shared";
import { useAsyncValue, type LoadStatus } from "@/hooks/useAsyncValue";
import { fetchStudentConnections } from "../api/connections.api";

export interface ConnectionsState {
  connections: Connection[];
  status: LoadStatus;
  errorMessage: string | null;
  isRefreshing: boolean;
  refresh: () => void;
}

/** Shared empty list, so the hook never returns a fresh array per render. */
const EMPTY_CONNECTIONS: Connection[] = [];

/**
 * The accepted connections of one student.
 *
 * Only accepted rows are requested, because that is the list the Connections tab
 * is about; requests and blocks are their own reads. The API decides what
 * "accepted" means, and the actor is explicit because the API has no session
 * yet.
 */
export function useConnections(actorId: string | null): ConnectionsState {
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!actorId) {
        throw new Error("A student is required to read connections.");
      }

      return fetchStudentConnections({
        userId: actorId,
        status: CONNECTION_STATUSES.ACCEPTED,
        signal,
      });
    },
    [actorId],
  );

  const { data, status, errorMessage, isRefreshing, refresh } = useAsyncValue(
    load,
    Boolean(actorId),
  );

  return {
    connections: data ?? EMPTY_CONNECTIONS,
    status,
    errorMessage,
    isRefreshing,
    refresh,
  };
}
