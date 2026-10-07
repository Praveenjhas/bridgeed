import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Prisma } from "../generated/prisma/client";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({
  connectionString,
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
