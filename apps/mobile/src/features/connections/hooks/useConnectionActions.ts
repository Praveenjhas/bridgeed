import { useCallback, useState } from "react";
import { ApiError } from "@/services/api";
import { toUserMessage } from "@/utils/errors";
import {
  acceptConnection,
  blockConnection as blockConnectionRequest,
  cancelConnectionRequest,
  createConnectionRequest,
  rejectConnection,
  removeConnection as removeConnectionRequest,
} from "../api/connections.api";

export interface ConnectionActionsState {
  /** True while an action on one connection row is in flight. */
  isConnectionPending: (connectionId: string) => boolean;
  /** True while a request sent to one student is in flight. */
  isStudentPending: (studentId: string) => boolean;
  actionErrorMessage: string | null;
  dismissActionError: () => void;
  /** Sends a connection request to a student. Resolves true when it went out. */
  sendRequest: (studentId: string) => Promise<boolean>;
  acceptRequest: (connectionId: string) => Promise<boolean>;
  rejectRequest: (connectionId: string) => Promise<boolean>;
  /** Withdraws a request the actor sent. */
  cancelRequest: (connectionId: string) => Promise<boolean>;
  removeConnection: (connectionId: string) => Promise<boolean>;
  blockConnection: (connectionId: string) => Promise<boolean>;
}

export interface UseConnectionActionsOptions {
  actorId: string | null;
  /**
   * Called once the API has accepted a change, so screens re-read what moved.
   * Must be referentially stable, because it is a dependency of every action.
   */
  onChanged: () => void;
}

type ActorAction = (signal: AbortSignal) => Promise<unknown>;

/** Ids in flight are tracked separately, because they are different things. */
type TargetKind = "connection" | "student";

/**
 * Every action that changes the connection graph, with per target progress.
 *
 * A student id is tracked for a request that does not exist yet, and a connection
 * id for a decision on a row that does, so a busy row never blocks another row
 * and a repeated tap on the same target is dropped instead of being sent twice.
 *
 * The resulting state is never assumed. After a success the caller is asked to
 * re-read, and so is a 409, 403 or 404, because the API answers those when the
 * row the screen holds is already out of date ("already connected", "connection
 * request is not pending", "only the recipient can accept"). That is what turns a
 * conflict into the correct button instead of an error message.
 */
export function useConnectionActions({
  actorId,
  onChanged,
}: UseConnectionActionsOptions): ConnectionActionsState {
  const [pendingConnectionIds, setPendingConnectionIds] = useState<
    ReadonlySet<string>
  >(() => new Set<string>());
  const [pendingStudentIds, setPendingStudentIds] = useState<
    ReadonlySet<string>
  >(() => new Set<string>());
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null,
  );

  const run = useCallback(
    async (
      kind: TargetKind,
      targetId: string,
      isAlreadyPending: boolean,
      action: ActorAction,
    ): Promise<boolean> => {
      if (!actorId || isAlreadyPending) {
        return false;
      }

      const controller = new AbortController();
      const setPending =
        kind === "connection" ? setPendingConnectionIds : setPendingStudentIds;

      setActionErrorMessage(null);
      setPending((current) => new Set(current).add(targetId));

      try {
        await action(controller.signal);
        onChanged();
        return true;
      } catch (error) {
        setActionErrorMessage(toUserMessage(error));

        if (
          error instanceof ApiError &&
          (error.status === 409 || error.status === 403 || error.status === 404)
        ) {
          onChanged();
        }

        return false;
      } finally {
        setPending((current) => {
          const next = new Set(current);
          next.delete(targetId);
          return next;
        });
      }
    },
    [actorId, onChanged],
  );

  const runOnConnection = useCallback(
    (connectionId: string, action: ActorAction) =>
      run(
        "connection",
        connectionId,
        pendingConnectionIds.has(connectionId),
        action,
      ),
    [pendingConnectionIds, run],
  );

  const runOnStudent = useCallback(
    (studentId: string, action: ActorAction) =>
      run(
        "student",
        studentId,
        studentId === actorId || pendingStudentIds.has(studentId),
        action,
      ),
    [actorId, pendingStudentIds, run],
  );

  // Every action names only the target; the acting account is read by the API
  // from the bearer token, so it can never be somebody else.
  const sendRequest = useCallback(
    (studentId: string) =>
      runOnStudent(studentId, (signal) =>
        createConnectionRequest({ receiverId: studentId, signal }),
      ),
    [runOnStudent],
  );

  const acceptRequest = useCallback(
    (connectionId: string) =>
      runOnConnection(connectionId, (signal) =>
        acceptConnection({ connectionId, signal }),
      ),
    [runOnConnection],
  );

  const rejectRequest = useCallback(
    (connectionId: string) =>
      runOnConnection(connectionId, (signal) =>
        rejectConnection({ connectionId, signal }),
      ),
    [runOnConnection],
  );

  const cancelRequest = useCallback(
    (connectionId: string) =>
      runOnConnection(connectionId, (signal) =>
        cancelConnectionRequest({ connectionId, signal }),
      ),
    [runOnConnection],
  );

  const removeConnection = useCallback(
    (connectionId: string) =>
      runOnConnection(connectionId, (signal) =>
        removeConnectionRequest({ connectionId, signal }),
      ),
    [runOnConnection],
  );

  const blockConnection = useCallback(
    (connectionId: string) =>
      runOnConnection(connectionId, (signal) =>
        blockConnectionRequest({ connectionId, signal }),
      ),
    [runOnConnection],
  );

  const isConnectionPending = useCallback(
    (connectionId: string) => pendingConnectionIds.has(connectionId),
    [pendingConnectionIds],
  );

  const isStudentPending = useCallback(
    (studentId: string) => pendingStudentIds.has(studentId),
    [pendingStudentIds],
  );

  const dismissActionError = useCallback(() => {
    setActionErrorMessage(null);
  }, []);

  return {
    isConnectionPending,
    isStudentPending,
    actionErrorMessage,
    dismissActionError,
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    removeConnection,
    blockConnection,
  };
}
