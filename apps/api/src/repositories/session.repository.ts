import { prisma, TRANSACTION_OPTIONS, type DatabaseClient } from "../config/prisma";

/**
 * A refresh-token session. Access tokens are stateless and short lived, so they
 * are never stored; only the SHA-256 digest of a refresh token is persisted,
 * which is why the row keeps `refreshTokenHash` and never the token itself.
 *
 * Rows are never deleted: rotation revokes the session that was presented and
 * writes its successor, and `familyId` links a whole chain of rotations to one
 * sign-in. That link is what makes a replayed token detectable.
 */
export interface Session {
  id: string;
  userId: string;
  familyId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionRecord {
  id: string;
  userId: string;
  familyId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Everything a brand new session row needs; the id is minted by the caller. */
export interface CreateSessionInput {
  id: string;
  userId: string;
  /** Identifier shared by every refresh token descended from one sign-in. */
  familyId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
}

/**
 * The parts of a successor the caller chooses. `userId` and `familyId` are
 * deliberately absent: a rotation must continue the same account and the same
 * chain, so the repository copies them from the session being rotated instead of
 * trusting the caller to get them right.
 */
export interface RotateSessionInput {
  /** Id of the replacement row, minted by the caller. */
  id: string;
  refreshTokenHash: string;
  expiresAt: Date;
}

/**
 * Raised when a rotation is attempted against a session that is no longer
 * active, which means the presented token had already been rotated or revoked
 * and a second copy of it is in circulation.
 */
export const SESSION_NOT_ACTIVE_MESSAGE = "Session is no longer active";

function toSession(record: SessionRecord): Session {
  return {
    id: record.id,
    userId: record.userId,
    familyId: record.familyId,
    refreshTokenHash: record.refreshTokenHash,
    userAgent: record.userAgent,
    ipAddress: record.ipAddress,
    expiresAt: record.expiresAt.toISOString(),
    revokedAt: record.revokedAt ? record.revokedAt.toISOString() : null,
    lastUsedAt: record.lastUsedAt ? record.lastUsedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * The columns a revocation writes. `updatedAt` is written explicitly because the
 * column carries no database default, and the same timestamp is reused so a
 * revoked row records exactly when it was retired.
 */
function revokedColumns(revokedAt: Date) {
  return {
    revokedAt,
    updatedAt: revokedAt,
  };
}

export class SessionRepository {
  /**
   * Inserts an active session. `createdAt` and `updatedAt` are written
   * explicitly because the columns carry no database default.
   *
   * `client` defaults to the pooled client; a caller that has to write a user
   * and its first session together passes the transaction handle instead, so
   * both rows land or neither does.
   */
  async createSession(
    input: CreateSessionInput,
    client: DatabaseClient = prisma,
  ): Promise<Session> {
    const now = new Date();

    const record = await client.session.create({
      data: {
        id: input.id,
        userId: input.userId,
        familyId: input.familyId,
        refreshTokenHash: input.refreshTokenHash,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
        expiresAt: input.expiresAt,
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    });

    return toSession(record);
  }

  /**
   * Loads a session by id, active or not. The authentication guard needs to see
   * a revoked row rather than nothing at all, so it can tell a session that was
   * signed out from one that never existed.
   */
  async findById(sessionId: string): Promise<Session | null> {
    const record = await prisma.session.findUnique({
      where: {
        id: sessionId,
      },
    });

    return record ? toSession(record) : null;
  }

  /**
   * Finds the session a presented refresh token belongs to. A revoked row is
   * returned just like an active one: the caller has to see the revocation in
   * order to treat the token as reused.
   */
  async findByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<Session | null> {
    const record = await prisma.session.findUnique({
      where: {
        refreshTokenHash,
      },
    });

    return record ? toSession(record) : null;
  }

  /**
   * Soft-revokes one session and reports whether an active one was actually
   * revoked, so a caller can tell a real sign-out from a request that arrived
   * twice. The row is left in place.
   */
  async revokeSession(
    sessionId: string,
    revokedAt: Date = new Date(),
  ): Promise<boolean> {
    const result = await prisma.session.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: revokedColumns(revokedAt),
    });

    return result.count > 0;
  }

  /**
   * Revokes every still-active session in one family and returns how many were
   * affected. Used when a rotated token is presented a second time: the copy in
   * the wrong hands cannot be told from the copy in the right ones, so the whole
   * chain is retired and the account is asked to sign in again.
   */
  async revokeFamily(
    familyId: string,
    revokedAt: Date = new Date(),
  ): Promise<number> {
    const result = await prisma.session.updateMany({
      where: {
        familyId,
        revokedAt: null,
      },
      data: revokedColumns(revokedAt),
    });

    return result.count;
  }

  /**
   * Revokes every still-active session a user has and returns how many were
   * affected. Historical rows stay, so where an account has been signed in
   * remains auditable.
   */
  async revokeAllForUser(
    userId: string,
    revokedAt: Date = new Date(),
  ): Promise<number> {
    const result = await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: revokedColumns(revokedAt),
    });

    return result.count;
  }

  /**
   * Records that an active session just minted an access token, which drives
   * idle timeouts and the "where you are signed in" list. Reports whether an
   * active session was updated.
   */
  async touchLastUsedAt(
    sessionId: string,
    lastUsedAt: Date = new Date(),
  ): Promise<boolean> {
    const result = await prisma.session.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        lastUsedAt,
        updatedAt: lastUsedAt,
      },
    });

    return result.count > 0;
  }

  /**
   * Rotates a refresh token: the presented session is revoked and its successor
   * is written with the same `userId` and the same `familyId`, both inside one
   * transaction, so a crash can never leave a client holding a token that was
   * never stored.
   *
   * The conditional update is what makes two simultaneous refreshes safe: only
   * one of them can revoke the session, and the loser raises
   * `SESSION_NOT_ACTIVE_MESSAGE` instead of being handed a second successor.
   */
  async rotateSession(
    currentSessionId: string,
    next: RotateSessionInput,
    rotatedAt: Date = new Date(),
  ): Promise<Session> {
    return prisma.$transaction(async (transaction) => {
      const current = await transaction.session.findUnique({
        where: {
          id: currentSessionId,
        },
      });

      if (!current || current.revokedAt !== null) {
        throw new Error(SESSION_NOT_ACTIVE_MESSAGE);
      }

      const revoked = await transaction.session.updateMany({
        where: {
          id: currentSessionId,
          revokedAt: null,
        },
        data: revokedColumns(rotatedAt),
      });

      if (revoked.count === 0) {
        throw new Error(SESSION_NOT_ACTIVE_MESSAGE);
      }

      const record = await transaction.session.create({
        data: {
          id: next.id,
          userId: current.userId,
          familyId: current.familyId,
          refreshTokenHash: next.refreshTokenHash,
          userAgent: current.userAgent,
          ipAddress: current.ipAddress,
          expiresAt: next.expiresAt,
          lastUsedAt: rotatedAt,
          createdAt: rotatedAt,
          updatedAt: rotatedAt,
        },
      });

      return toSession(record);
    }, TRANSACTION_OPTIONS);
  }
}
