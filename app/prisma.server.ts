import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { env } from "prisma/config";
import { PrismaClient } from "prisma/generated/prisma/client";

const adapter = new PrismaMariaDb(env("DATABASE_URL"));

const prisma = new PrismaClient({ adapter });

const globalForPrisma = global as unknown as { prisma: typeof prisma };

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { prisma };
