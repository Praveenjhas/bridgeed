import type { Request, Response } from "express";
import { CONNECTION_STATUSES, type ConnectionStatus } from "@bridgeed/shared";
import { ConnectionService } from "../services/connection.service";

const CONNECTION_STATUS_VALUES: readonly string[] =
  Object.values(CONNECTION_STATUSES);

function isConnectionStatus(value: string): value is ConnectionStatus {
  return CONNECTION_STATUS_VALUES.includes(value);
}

export class ConnectionController {
  constructor(private readonly connectionService: ConnectionService) {}

  createConnectionRequest = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const { requesterId, receiverId, recipientId } = (req.body ?? {}) as {
        requesterId?: unknown;
        receiverId?: unknown;
        recipientId?: unknown;
      };

      const targetId = receiverId ?? recipientId;
      // The requester is the authenticated account. The body's `requesterId` is
      // read only for the unauthenticated legacy path, so an authenticated
      // caller can never send a request as somebody else.
      const actingRequesterId = req.auth?.userId ?? requesterId;

      if (
        typeof actingRequesterId !== "string" ||
        actingRequesterId.trim().length === 0 ||
        typeof targetId !== "string" ||
        targetId.trim().length === 0
      ) {
        res.status(400).json({
          error: "requesterId and receiverId are required",
        });
        return;
      }

      const connection =
        await this.connectionService.createConnectionRequest(
          actingRequesterId,
          targetId,
        );

      res.status(201).json(connection);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  getConnectionById = async (req: Request, res: Response): Promise<void> => {
    try {
      const connectionId = this.readConnectionId(req);

      if (!connectionId) {
        res.status(400).json({
          error: "Invalid connection ID",
        });
        return;
      }

      const connection =
        await this.connectionService.getConnectionById(connectionId);

      res.json(connection);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  getStudentConnections = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const studentId = this.readStudentId(req);

      if (!studentId) {
        res.status(400).json({
          error: "Invalid student ID",
        });
        return;
      }

      const { status } = req.query;

      if (
        status !== undefined &&
        (typeof status !== "string" || !isConnectionStatus(status))
      ) {
        res.status(400).json({
          error: "Invalid connection status",
        });
        return;
      }

      const connections = await this.connectionService.getStudentConnections(
        studentId,
        status,
      );

      res.json(connections);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  getReceivedPendingRequests = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const studentId = this.readStudentId(req);

      if (!studentId) {
        res.status(400).json({
          error: "Invalid student ID",
        });
        return;
      }

      const connections =
        await this.connectionService.getReceivedPendingRequests(studentId);

      res.json(connections);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  getSentPendingRequests = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const studentId = this.readStudentId(req);

      if (!studentId) {
        res.status(400).json({
          error: "Invalid student ID",
        });
        return;
      }

      const connections =
        await this.connectionService.getSentPendingRequests(studentId);

      res.json(connections);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  getBlockedConnections = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const studentId = this.readStudentId(req);

      if (!studentId) {
        res.status(400).json({
          error: "Invalid student ID",
        });
        return;
      }

      const connections =
        await this.connectionService.getBlockedConnections(studentId);

      res.json(connections);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  acceptConnection = async (req: Request, res: Response): Promise<void> => {
    await this.respondToRequest(req, res, (connectionId, actorId) =>
      this.connectionService.acceptConnection(connectionId, actorId),
    );
  };

  rejectConnection = async (req: Request, res: Response): Promise<void> => {
    await this.respondToRequest(req, res, (connectionId, actorId) =>
      this.connectionService.rejectConnection(connectionId, actorId),
    );
  };

  blockConnection = async (req: Request, res: Response): Promise<void> => {
    await this.respondToRequest(req, res, (connectionId, actorId) =>
      this.connectionService.blockConnection(connectionId, actorId),
    );
  };

  cancelConnectionRequest = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const connectionId = this.readConnectionId(req);
      const actorId = this.readActorId(req);

      if (!connectionId || !actorId) {
        this.sendMissingInputError(connectionId, actorId, res);
        return;
      }

      await this.connectionService.cancelConnectionRequest(
        connectionId,
        actorId,
      );

      res.status(204).send();
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  removeConnection = async (req: Request, res: Response): Promise<void> => {
    try {
      const connectionId = this.readConnectionId(req);
      const actorId = this.readActorId(req);

      if (!connectionId || !actorId) {
        this.sendMissingInputError(connectionId, actorId, res);
        return;
      }

      await this.connectionService.removeConnection(connectionId, actorId);

      res.status(204).send();
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  private async respondToRequest(
    req: Request,
    res: Response,
    action: (connectionId: string, actorId: string) => Promise<unknown>,
  ): Promise<void> {
    try {
      const connectionId = this.readConnectionId(req);
      const actorId = this.readActorId(req);

      if (!connectionId || !actorId) {
        this.sendMissingInputError(connectionId, actorId, res);
        return;
      }

      const connection = await action(connectionId, actorId);

      res.json(connection);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  }

  private sendMissingInputError(
    connectionId: string | null,
    actorId: string | null,
    res: Response,
  ): void {
    res.status(400).json({
      error: connectionId
        ? "actorId is required"
        : "Invalid connection ID",
    });
  }

  private readConnectionId(req: Request): string | null {
    const { connectionId } = req.params;

    return typeof connectionId === "string" && connectionId.length > 0
      ? connectionId
      : null;
  }

  private readStudentId(req: Request): string | null {
    const { userId } = req.params;

    return typeof userId === "string" && userId.length > 0 ? userId : null;
  }

  /**
   * The acting participant of a connection mutation: accept, reject, cancel,
   * remove or block. The authenticated account always wins; the explicit
   * `actorId` is a legacy fallback read only for unauthenticated requests.
   */
  private readActorId(req: Request): string | null {
    if (req.auth) {
      return req.auth.userId;
    }

    const { actorId } = (req.body ?? {}) as { actorId?: unknown };

    if (typeof actorId === "string" && actorId.trim().length > 0) {
      return actorId;
    }

    const queryActorId = req.query.actorId;

    return typeof queryActorId === "string" && queryActorId.trim().length > 0
      ? queryActorId
      : null;
  }

  private sendMappedError(error: unknown, res: Response): void {
    const message = error instanceof Error ? error.message : undefined;

    switch (message) {
      case "Student profile not found":
      case "Connection not found":
        res.status(404).json({ error: message });
        return;
      case "Only connection participants can perform this action":
      case "Only the recipient can accept this connection request":
      case "Only the recipient can reject this connection request":
      case "Only the requester can cancel this connection request":
        res.status(403).json({ error: message });
        return;
      case "A student cannot connect with themselves":
        res.status(400).json({ error: message });
        return;
      case "A connection request is already pending":
      case "This student has already sent a connection request":
      case "These students are already connected":
      case "A connection between these students is blocked":
      case "Connection request is not pending":
      case "Only accepted connections can be removed":
      case "This connection is already blocked":
        res.status(409).json({ error: message });
        return;
      default:
        console.error(error);

        res.status(500).json({
          error: "Internal server error",
        });
    }
  }
}
