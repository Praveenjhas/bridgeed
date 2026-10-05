export const CONNECTION_STATUSES = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  BLOCKED: "blocked",
} as const;

export type ConnectionStatus =
  (typeof CONNECTION_STATUSES)[keyof typeof CONNECTION_STATUSES];

export interface Connection {
  id: string;
  requesterId: string;
  receiverId: string;
  status: ConnectionStatus;
  blockedById: string | null;
  createdAt: string;
  updatedAt: string;
}
