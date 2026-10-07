import { useCallback } from "react";
import type { Connection } from "@bridgeed/shared";
import { useAsyncValue, type LoadStatus } from "@/hooks/useAsyncValue";
import { fetchStudentConnections } from "../api/connections.api";
import { findConnectionBetween } from "../relationships";

export interface RelationshipReadState {
  /** The one row linking the actor and the student, or null when there is none. */
  relationship: Connection | null;
  status: LoadStatus;
  errorMessage: string | null;
  isRefreshing: boolean;
  refresh: () => void;
}

/**
 * Reads the relationship between the acting student and one other student.
 *
 * The API exposes relationships per student rather than per pair, so this reads
 * the actor's rows and picks the one that links the two. That is what lets a
 * profile tell a pending request apart from an accepted connection, and it is the
 * single source of truth the connect, accept, reject, remove and block actions
 * are checked against.
 *
 * Self profiles never read anything: there is no relationship with yourself, and
 * the screen already knows that from the two ids.
 */
export function useRelationship(
  actorId: string | null,
  studentId: string | null,
): RelationshipReadState {
  const isSelf = actorId !== null && actorId === studentId;

  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!actorId || !studentId) {
        throw new Error("A student and an actor are both required.");
      }

      const relationships = await fetchStudentConnections({
        userId: actorId,
        signal,
      });

      return findConnectionBetween(relationships, actorId, studentId);
    },
    [actorId, studentId],
  );

  const { data, status, errorMessage, isRefreshing, refresh } = useAsyncValue(
    load,
    Boolean(actorId && studentId) && !isSelf,
  );

  return {
    relationship: data,
    status,
    errorMessage,
    isRefreshing,
    refresh,
  };
}
