import type { Connection, ConnectionStatus } from "@bridgeed/shared";
import type { ConnectionStatus as ConnectionStatusRecord } from "../generated/prisma/enums";
import { prisma } from "../config/prisma";

const databaseStatusByStatus: Record<
  ConnectionStatus,
  ConnectionStatusRecord
> = {
  pending: "PENDING",
  accepted: "ACCEPTED",
  rejected: "REJECTED",
  blocked: "BLOCKED",
};

const statusByDatabaseStatus: Record<
  ConnectionStatusRecord,
  ConnectionStatus
> = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  BLOCKED: "blocked",
};

interface ConnectionRecord {
  id: string;
  requesterId: string;
  receiverId: string;
  status: ConnectionStatusRecord;
  blockedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConnectionInput {
  id: string;
  requesterId: string;
  receiverId: string;
}

function toConnection(record: ConnectionRecord): Connection {
  return {
    id: record.id,
    requesterId: record.requesterId,
    receiverId: record.receiverId,
    status: statusByDatabaseStatus[record.status],
    blockedById: record.blockedById,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class ConnectionRepository {
  async findById(id: string): Promise<Connection | null> {
    const record = await prisma.connection.findUnique({
      where: {
        id,
      },
    });

    return record ? toConnection(record) : null;
  }

  async findBetweenStudents(
    studentAId: string,
    studentBId: string,
  ): Promise<Connection | null> {
    const record = await prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId: studentAId, receiverId: studentBId },
          { requesterId: studentBId, receiverId: studentAId },
        ],
      },
    });

    return record ? toConnection(record) : null;
  }

  async findByStudentId(
    userId: string,
    status?: ConnectionStatus,
  ): Promise<Connection[]> {
    const records = await prisma.connection.findMany({
      where: {
        OR: [{ requesterId: userId }, { receiverId: userId }],
        ...(status ? { status: databaseStatusByStatus[status] } : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return records.map(toConnection);
  }

  async findReceivedPendingRequests(userId: string): Promise<Connection[]> {
    const records = await prisma.connection.findMany({
      where: {
        receiverId: userId,
        status: databaseStatusByStatus.pending,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return records.map(toConnection);
  }

  async findSentPendingRequests(userId: string): Promise<Connection[]> {
    const records = await prisma.connection.findMany({
      where: {
        requesterId: userId,
        status: databaseStatusByStatus.pending,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return records.map(toConnection);
  }

  async findBlockedRelationships(userId: string): Promise<Connection[]> {
    const records = await prisma.connection.findMany({
      where: {
        status: databaseStatusByStatus.blocked,
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return records.map(toConnection);
  }

  async create(input: CreateConnectionInput): Promise<Connection> {
    const record = await prisma.connection.create({
      data: {
        id: input.id,
        requesterId: input.requesterId,
        receiverId: input.receiverId,
        status: databaseStatusByStatus.pending,
      },
    });

    return toConnection(record);
  }

  async updateStatus(
    id: string,
    status: ConnectionStatus,
    blockedById: string | null,
  ): Promise<Connection> {
    const record = await prisma.connection.update({
      where: {
        id,
      },
      data: {
        status: databaseStatusByStatus[status],
        blockedById,
      },
    });

    return toConnection(record);
  }

  async reopenRequest(
    id: string,
    requesterId: string,
    receiverId: string,
  ): Promise<Connection> {
    const record = await prisma.connection.update({
      where: {
        id,
      },
      data: {
        requesterId,
        receiverId,
        status: databaseStatusByStatus.pending,
        blockedById: null,
      },
    });

    return toConnection(record);
  }

  async delete(id: string): Promise<number> {
    const result = await prisma.connection.deleteMany({
      where: {
        id,
      },
    });

    return result.count;
  }
}
