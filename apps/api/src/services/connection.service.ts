import {
  CONNECTION_STATUSES,
  type Connection,
  type ConnectionStatus,
} from "@bridgeed/shared";
import { ConnectionRepository } from "../repositories/connection.repository";
import { StudentProfileRepository } from "../repositories/student-profile.repository";

export class ConnectionService {
  constructor(
    private readonly connectionRepository: ConnectionRepository,
    private readonly studentProfileRepository: StudentProfileRepository,
  ) {}

  async createConnectionRequest(
    requesterId: string,
    receiverId: string,
  ): Promise<Connection> {
    if (requesterId === receiverId) {
      throw new Error("A student cannot connect with themselves");
    }

    await this.ensureStudentProfileExists(requesterId);
    await this.ensureStudentProfileExists(receiverId);

    const existingConnection =
      await this.connectionRepository.findBetweenStudents(
        requesterId,
        receiverId,
      );

    if (!existingConnection) {
      return this.connectionRepository.create({
        id: crypto.randomUUID(),
        requesterId,
        receiverId,
      });
    }

    switch (existingConnection.status) {
      case CONNECTION_STATUSES.PENDING:
        // Only one pending request may exist per pair, in either direction.
        throw new Error(
          existingConnection.requesterId === requesterId
            ? "A connection request is already pending"
            : "This student has already sent a connection request",
        );
      case CONNECTION_STATUSES.ACCEPTED:
        throw new Error("These students are already connected");
      case CONNECTION_STATUSES.BLOCKED:
        throw new Error("A connection between these students is blocked");
      case CONNECTION_STATUSES.REJECTED:
        // A rejected request does not permanently block a future request.
        return this.connectionRepository.reopenRequest(
          existingConnection.id,
          requesterId,
          receiverId,
        );
    }
  }

  async getConnectionById(connectionId: string): Promise<Connection> {
    return this.requireConnection(connectionId);
  }

  async getStudentConnections(
    userId: string,
    status?: ConnectionStatus,
  ): Promise<Connection[]> {
    await this.ensureStudentProfileExists(userId);

    return this.connectionRepository.findByStudentId(userId, status);
  }

  async getReceivedPendingRequests(userId: string): Promise<Connection[]> {
    await this.ensureStudentProfileExists(userId);

    return this.connectionRepository.findReceivedPendingRequests(userId);
  }

  async getSentPendingRequests(userId: string): Promise<Connection[]> {
    await this.ensureStudentProfileExists(userId);

    return this.connectionRepository.findSentPendingRequests(userId);
  }

  async getBlockedConnections(userId: string): Promise<Connection[]> {
    await this.ensureStudentProfileExists(userId);

    return this.connectionRepository.findBlockedRelationships(userId);
  }

  async acceptConnection(
    connectionId: string,
    actorId: string,
  ): Promise<Connection> {
    const connection = await this.requireParticipant(connectionId, actorId);

    if (connection.receiverId !== actorId) {
      throw new Error("Only the recipient can accept this connection request");
    }

    this.ensurePending(connection);

    return this.connectionRepository.updateStatus(
      connectionId,
      CONNECTION_STATUSES.ACCEPTED,
      null,
    );
  }

  async rejectConnection(
    connectionId: string,
    actorId: string,
  ): Promise<Connection> {
    const connection = await this.requireParticipant(connectionId, actorId);

    if (connection.receiverId !== actorId) {
      throw new Error("Only the recipient can reject this connection request");
    }

    this.ensurePending(connection);

    return this.connectionRepository.updateStatus(
      connectionId,
      CONNECTION_STATUSES.REJECTED,
      null,
    );
  }

  async cancelConnectionRequest(
    connectionId: string,
    actorId: string,
  ): Promise<void> {
    const connection = await this.requireParticipant(connectionId, actorId);

    if (connection.requesterId !== actorId) {
      throw new Error("Only the requester can cancel this connection request");
    }

    this.ensurePending(connection);

    await this.deleteConnection(connectionId);
  }

  async removeConnection(
    connectionId: string,
    actorId: string,
  ): Promise<void> {
    const connection = await this.requireParticipant(connectionId, actorId);

    if (connection.status !== CONNECTION_STATUSES.ACCEPTED) {
      throw new Error("Only accepted connections can be removed");
    }

    await this.deleteConnection(connectionId);
  }

  async blockConnection(
    connectionId: string,
    actorId: string,
  ): Promise<Connection> {
    const connection = await this.requireParticipant(connectionId, actorId);

    if (connection.status === CONNECTION_STATUSES.BLOCKED) {
      throw new Error("This connection is already blocked");
    }

    return this.connectionRepository.updateStatus(
      connectionId,
      CONNECTION_STATUSES.BLOCKED,
      actorId,
    );
  }

  private ensurePending(connection: Connection): void {
    if (connection.status !== CONNECTION_STATUSES.PENDING) {
      throw new Error("Connection request is not pending");
    }
  }

  private async deleteConnection(connectionId: string): Promise<void> {
    const deletedCount = await this.connectionRepository.delete(connectionId);

    if (deletedCount === 0) {
      throw new Error("Connection not found");
    }
  }

  private async requireConnection(connectionId: string): Promise<Connection> {
    const connection = await this.connectionRepository.findById(connectionId);

    if (!connection) {
      throw new Error("Connection not found");
    }

    return connection;
  }

  private async requireParticipant(
    connectionId: string,
    actorId: string,
  ): Promise<Connection> {
    const connection = await this.requireConnection(connectionId);

    if (connection.requesterId !== actorId && connection.receiverId !== actorId) {
      throw new Error("Only connection participants can perform this action");
    }

    return connection;
  }

  private async ensureStudentProfileExists(userId: string): Promise<void> {
    const profile = await this.studentProfileRepository.findByUserId(userId);

    if (!profile) {
      throw new Error("Student profile not found");
    }
  }
}
