import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { env } from "prisma/config";
import { PrismaClient } from "prisma/generated/prisma/client";

/**
 * A single `PrismaClient` per process, cached on `globalThis` in development.
 *
 * Vite re-evaluates this module on every HMR update, and both the client and the
 * `PrismaMariaDb` adapter it wraps own a connection pool. Constructing them at
 * module scope therefore opened a fresh pool per reload while the previous one
 * stayed connected — nothing disconnects it, and the module-local binding that
 * referenced it is gone — so the server leaked pools until the DB refused new
 * connections. Reading the cache back (it used to only ever be written) makes a
 * reload reuse the existing client instead of opening another pool.
 *
 * The adapter is constructed lazily inside the `??` so a re-evaluation doesn't
 * open a pool it would immediately discard.
 *
 * Production keeps a plain module-scoped instance: there is no HMR, and leaving
 * it off the global avoids pinning the client across a serverless invocation.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaMariaDb(env("DATABASE_URL")) });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { prisma };
