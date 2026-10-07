import { Router } from "express";
import { ConnectionController } from "../controllers/connection.controller";
import { optionalAuth } from "../middleware/require-auth";
import { ConnectionService } from "../services/connection.service";
import { ConnectionRepository } from "../repositories/connection.repository";
import { StudentProfileRepository } from "../repositories/student-profile.repository";

const connectionRepository = new ConnectionRepository();
const studentProfileRepository = new StudentProfileRepository();

const connectionService = new ConnectionService(
  connectionRepository,
  studentProfileRepository,
);

const connectionController = new ConnectionController(connectionService);

export const connectionRouter = Router();

/**
 * `optionalAuth` makes the authenticated account the acting participant of every
 * mutation (the requester of a new request, the decision-maker on an existing
 * one), so a client cannot request, accept, block or remove on behalf of another
 * user. The explicit `requesterId`/`actorId` shape is retained only for the
 * unauthenticated legacy path.
 */
connectionRouter.use(optionalAuth);

connectionRouter.post("/", connectionController.createConnectionRequest);
connectionRouter.get("/:connectionId", connectionController.getConnectionById);
connectionRouter.patch(
  "/:connectionId/accept",
  connectionController.acceptConnection,
);
connectionRouter.patch(
  "/:connectionId/reject",
  connectionController.rejectConnection,
);
connectionRouter.post(
  "/:connectionId/block",
  connectionController.blockConnection,
);
connectionRouter.delete(
  "/:connectionId/request",
  connectionController.cancelConnectionRequest,
);
connectionRouter.delete("/:connectionId", connectionController.removeConnection);

export const studentConnectionRouter = Router({ mergeParams: true });

studentConnectionRouter.get(
  "/connections",
  connectionController.getStudentConnections,
);
studentConnectionRouter.get(
  "/connections/requests/received",
  connectionController.getReceivedPendingRequests,
);
studentConnectionRouter.get(
  "/connections/requests/sent",
  connectionController.getSentPendingRequests,
);
studentConnectionRouter.get(
  "/blocked",
  connectionController.getBlockedConnections,
);
