import { CONNECTION_STATUSES, type Connection } from "@bridgeed/shared";

/**
 * Where the acting student stands with another student.
 *
 * It is derived from the API's own connection row rather than tracked in the UI,
 * because everything the screen offers (a connect button, an accept button, a
 * block) is decided by the backend's rules for that row. A rejection is
 * deliberately reported as "not connected": the API lets the requester ask again
 * rather than treating it as a standing relationship, so the screen shows the
 * connect affordance instead of a dead end.
 */
export const RELATIONSHIP_STATES = {
  SELF: "self",
  NOT_CONNECTED: "not-connected",
  PENDING_OUTGOING: "pending-outgoing",
  PENDING_INCOMING: "pending-incoming",
  ACCEPTED: "accepted",
  BLOCKED: "blocked",
} as const;

export type RelationshipState =
  (typeof RELATIONSHIP_STATES)[keyof typeof RELATIONSHIP_STATES];

/**
 * The student on the other side of a connection row.
 *
 * The API stores a pair once, so this is how a screen turns "one of these two is
 * me" into "this is the person the row is about".
 */
export function otherParticipantId(
  connection: Connection,
  actorId: string,
): string {
  return connection.requesterId === actorId
    ? connection.receiverId
    : connection.requesterId;
}

/**
 * The one row that links two students, in either direction.
 *
 * The backend keeps a single row per pair, so this is an exact lookup rather
 * than a guess between duplicates.
 */
export function findConnectionBetween(
  connections: readonly Connection[],
  studentAId: string,
  studentBId: string,
): Connection | null {
  return (
    connections.find(
      (connection) =>
        (connection.requesterId === studentAId &&
          connection.receiverId === studentBId) ||
        (connection.requesterId === studentBId &&
          connection.receiverId === studentAId),
    ) ?? null
  );
}

/** Reads the relationship state out of the row that represents it. */
export function relationshipStateFor(
  connection: Connection | null,
  actorId: string | null,
  studentId: string | null,
): RelationshipState {
  if (actorId && studentId && actorId === studentId) {
    return RELATIONSHIP_STATES.SELF;
  }

  if (!connection) {
    return RELATIONSHIP_STATES.NOT_CONNECTED;
  }

  switch (connection.status) {
    case CONNECTION_STATUSES.PENDING:
      return connection.requesterId === actorId
        ? RELATIONSHIP_STATES.PENDING_OUTGOING
        : RELATIONSHIP_STATES.PENDING_INCOMING;
    case CONNECTION_STATUSES.ACCEPTED:
      return RELATIONSHIP_STATES.ACCEPTED;
    case CONNECTION_STATUSES.BLOCKED:
      return RELATIONSHIP_STATES.BLOCKED;
    default:
      // A rejected request leaves nothing standing between the two students.
      return RELATIONSHIP_STATES.NOT_CONNECTED;
  }
}

/**
 * True when the API can block this relationship.
 *
 * Blocking acts on a connection row, so there has to be one: a pending request
 * or an accepted connection. A student the actor has never interacted with has
 * no row to block, and the API offers no way to create one for that purpose.
 */
export function canBlockRelationship(state: RelationshipState): boolean {
  return (
    state === RELATIONSHIP_STATES.PENDING_INCOMING ||
    state === RELATIONSHIP_STATES.PENDING_OUTGOING ||
    state === RELATIONSHIP_STATES.ACCEPTED
  );
}
