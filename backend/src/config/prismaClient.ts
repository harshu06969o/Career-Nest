import { PrismaClient } from '@prisma/client';

// Singleton pattern: prevents creating multiple PrismaClient instances
// during hot-reloads in development (ts-node-dev restarts).
// In production, ESM module caching guarantees a single instance anyway.
const prisma = new PrismaClient({
  log: process.env['NODE_ENV'] === 'development' ? ['error', 'warn'] : ['error'],
});

export default prisma;
