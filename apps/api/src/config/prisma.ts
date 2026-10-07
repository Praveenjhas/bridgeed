import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Prisma } from "../generated/prisma/client";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

/**
 * How many connections one process may hold.
 *
 * The database this project runs against accepts ten concurrent connections, and
 * the API is not the only client: the live smoke scripts import this same client,
 * so a pool of ten each asks for twice the budget. The server's answer to that is
 * to close connections underneath a request, which surfaces as `P1017 Server has
 * closed the connection` on a query that was perfectly valid and is a failure the
 * code cannot catch its way out of. Five each keeps both processes inside the
 * budget with room left for `psql`, and `DATABASE_POOL_MAX` raises it where the
 * database can afford more.
 */
const POOL_MAX = Number(process.env.DATABASE_POOL_MAX ?? 5);

/** Idle connections are handed back quickly: an idle connection is budget. */
const IDLE_TIMEOUT_MS = 5_000;

/** How long to wait for a free connection before a query is given up on. */
const CONNECTION_TIMEOUT_MS = 10_000;

const adapter = new PrismaPg({
  connectionString,
  max: POOL_MAX,
  idleTimeoutMillis: IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
});

export const prisma = new PrismaClient({
  adapter,
});

/**
 * Options for interactive transactions.
 *
 * Prisma's defaults are two seconds to acquire a connection and five seconds to
 * run. Both are tight for the refresh flow, which deliberately makes one
 * transaction wait behind another for the same session row: the loser has to
 * lose the race and learn that it lost, not be turned away with a server error
 * because it could not get a connection in time. Ten seconds is long enough for
 * that wait and short enough that a stuck transaction still cannot hold a
 * connection indefinitely.
 */
export const TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 10_000,
};

/**
 * Either the pooled client or the handle Prisma passes to an interactive
 * transaction callback.
 *
 * A repository method that can run inside someone else's transaction takes one
 * of these, so a caller can compose several repositories into a single atomic
 * unit of work without the repositories having to know about each other.
 */
export type DatabaseClient = typeof prisma | Prisma.TransactionClient;
