import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add your Postgres connection string to .env.local (and to Vercel for deployments).",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

type PrismaClientInstance = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as {
  dormdashPrisma?: PrismaClientInstance;
};

let prisma: PrismaClientInstance | undefined;

/**
 * Lazily creates the Prisma client so importing server modules during a build
 * never requires a live database connection.
 */
export function getPrisma(): PrismaClientInstance {
  if (globalForPrisma.dormdashPrisma) {
    return globalForPrisma.dormdashPrisma;
  }

  if (!prisma) {
    prisma = createClient();
  }

  // Reuse the client across hot reloads in development instead of exhausting
  // the connection pool with a new pool on every edit.
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.dormdashPrisma = prisma;
  }

  return prisma;
}
