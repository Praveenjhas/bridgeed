export {
  acceptConnection,
  blockConnection,
  cancelConnectionRequest,
  createConnectionRequest,
  fetchReceivedConnectionRequests,
  fetchStudentConnections,
  rejectConnection,
  removeConnection,
  type CreateConnectionRequestParams,
  type DecideConnectionParams,
  type FetchStudentConnectionsParams,
  type FetchStudentRelationshipsParams,
} from "./api/connections.api";

export {
  RELATIONSHIP_STATES,
  canBlockRelationship,
  findConnectionBetween,
  otherParticipantId,
  relationshipStateFor,
  type RelationshipState,
} from "./relationships";

export {
  RELATIONSHIP_LABELS,
  RELATIONSHIP_TONES,
  describeRelationship,
  relationshipLabel,
  relationshipTone,
} from "./labels";

export { useConnections, type ConnectionsState } from "./hooks/useConnections";
export {
  useConnectionRequests,
  type ConnectionRequestsState,
} from "./hooks/useConnectionRequests";
export {
  useRelationship,
  type RelationshipReadState,
} from "./hooks/useRelationship";
export {
  useConnectionActions,
  type ConnectionActionsState,
  type UseConnectionActionsOptions,
} from "./hooks/useConnectionActions";

export {
  ConnectionCard,
  type ConnectionCardProps,
} from "./components/ConnectionCard";
export {
  ConnectionRequestCard,
  type ConnectionRequestCardProps,
} from "./components/ConnectionRequestCard";
export {
  ConnectionActions,
  type ConnectionActionsProps,
} from "./components/ConnectionActions";
