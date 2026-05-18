// Exports a singleton PrismaClient instance to prevent connection pool exhaustion in Next.js.
// ==============================================================================
// PRISMA CLIENT SINGLETON INSTANCE
// ==============================================================================
// In Next.js (App Router), every time you edit a file in development, the framework
// hot-reloads (re-executes code). If we instantiated PrismaClient directly in our API
// routes (like: `new PrismaClient()`), every hot-reload would open a new connection pool
// to the database, exhausting your database connections (HTTP 500: Too many clients) in minutes.
//
// This file solves that by attaching PrismaClient to Node's global object, guaranteeing
// that we instantiate only ONE PrismaClient singleton throughout the lifetime of the process.

// Exports a singleton PrismaClient instance to prevent connection pool exhaustion in Next.js.
import { PrismaClient } from '@prisma/client';

// 1. TYPING THE GLOBAL OBJECT
// Tells TypeScript that Node's globalThis object might contain a pre-initialized
// 'prisma' property of type PrismaClient or undefined.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 2. EXPORTING THE PRISMA CLIENT SINGLETON
// If 'globalForPrisma.prisma' already exists, reuse it.
// If it does not exist (like upon server startup), instantiate a new PrismaClient.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Logging Optimization:
    // In development mode, print database queries, warnings, and errors to your console.
    // In production, log ONLY errors to avoid bloating your hosting platform logs.
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// 3. PERSISTING PRISMA IN DEVELOPMENT
// If we are NOT in production (we are running locally), save the current client
// instance into Node's global object. This ensures that when Next.js hot-reloads,
// the next check on 'globalForPrisma.prisma' (line 21) will successfully find and reuse it!
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
export * from '@prisma/client'; // Re-export client typings for convenience across files
