import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    datasources: {
      db: {
        // Append connection pool params if not already in the URL
        url: process.env.DATABASE_URL
          ? `${process.env.DATABASE_URL}${process.env.DATABASE_URL.includes('?') ? '&' : '?'}connection_limit=10&pool_timeout=10&connect_timeout=10`
          : undefined,
      },
    },
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db

// Graceful shutdown: close DB connections when process is terminating
process.on("beforeExit", async () => {
  await db.$disconnect()
})
