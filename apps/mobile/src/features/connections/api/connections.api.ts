import type { Connection, ConnectionStatus } from "@bridgeed/shared";
import { apiClient } from "@/services/api";

export interface FetchStudentConnectionsParams {
  /** The student whose relationships are read. */
  userId: string;
  /**
   * Optional status filter. Omitted reads every relationship the student is part
   * of, which is what a screen needs to work out where they stand with someone.
   */
  status?: ConnectionStatus | null;
  signal?: AbortSignal;
}

/**
 * Reads the connections a student participates in.
 *
 * The API returns one row per pair and checks both directions, so a single read
 * answers "are we connected, and if not, who asked whom". Every state the UI
 * shows comes from here rather than from the request the app just sent.
 */
export async function fetchStudentConnections({
  userId,
  status = null,
  signal,
}: FetchStudentConnectionsParams): Promise<Connection[]> {
  return apiClient.get<Connection[]>(
    `/student-profiles/${encodeURIComponent(userId)}/connections`,
    { query: { status }, signal },
  );
}

export interface FetchStudentRelationshipsParams {
  userId: string;
  signal?: AbortSignal;
}

/** Reads the pending requests a student has received, newest first. */
export async function fetchReceivedConnectionRequests({
  userId,
  signal,
}: FetchStudentRelationshipsParams): Promise<Connection[]> {
  return apiClient.get<Connection[]>(
    `/student-profiles/${encodeURIComponent(userId)}/connections/requests/received`,
    { signal },
  );
}

export interface CreateConnectionRequestParams {
  /** The student receiving the request. The requester is the signed-in account. */
  receiverId: string;
  signal?: AbortSignal;
}

/**
 * Sends a connection request from the signed-in student.
 *
 * The requester is taken by the API from the bearer token, so a client cannot
 * send a request on somebody else's behalf; only the target is sent. The API owns
 * every rule around this: connecting with yourself, a request that is already
 * pending, an existing connection and a block are all answered as conflicts, and
 * a previously rejected request is reopened rather than duplicated. Callers
 * therefore react to the resulting state instead of assuming a fresh pending row
 * was created.
 */
export async function createConnectionRequest({
  receiverId,
  signal,
}: CreateConnectionRequestParams): Promise<Connection> {
  return apiClient.post<Connection>("/connections", {
    body: { receiverId },
    signal,
  });
}

export interface DecideConnectionParams {
  connectionId: string;
  signal?: AbortSignal;
}

/** Accepts a pending request. The API allows the recipient only. */
export async function acceptConnection({
  connectionId,
  signal,
}: DecideConnectionParams): Promise<Connection> {
  return apiClient.patch<Connection>(
    `/connections/${encodeURIComponent(connectionId)}/accept`,
    { signal },
  );
}

/** Rejects a pending request. The API allows the recipient only. */
export async function rejectConnection({
  connectionId,
  signal,
}: DecideConnectionParams): Promise<Connection> {
  return apiClient.patch<Connection>(
    `/connections/${encodeURIComponent(connectionId)}/reject`,
    { signal },
  );
}

/**
 * Blocks the other participant.
 *
 * The acting account is taken by the API from the bearer token. The API keeps the
 * row and records who blocked whom, so the relationship stays visible as blocked
 * and no further request can be sent across it.
 */
export async function blockConnection({
  connectionId,
  signal,
}: DecideConnectionParams): Promise<Connection> {
  return apiClient.post<Connection>(
    `/connections/${encodeURIComponent(connectionId)}/block`,
    { signal },
  );
}

/** Withdraws a request the signed-in student sent. The API allows the requester only. */
export async function cancelConnectionRequest({
  connectionId,
  signal,
}: DecideConnectionParams): Promise<void> {
  await apiClient.remove<void>(
    `/connections/${encodeURIComponent(connectionId)}/request`,
    { signal },
  );
}

/** Removes an accepted connection, for either participant. */
export async function removeConnection({
  connectionId,
  signal,
}: DecideConnectionParams): Promise<void> {
  await apiClient.remove<void>(
    `/connections/${encodeURIComponent(connectionId)}`,
    { signal },
  );
}
