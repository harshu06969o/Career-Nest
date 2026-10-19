import 'dotenv/config';
import { createServer, type Server as HttpServer } from 'http';
import app from './app.js';
import redisClient from './config/redisClient.js';
import { initSocketServer, closeSocketServer } from './config/socketServer.js';
import { createResumeWorker } from './workers/resumeParser.worker.js';
import { resumeQueue, resumeQueueEvents, bullRedis, queueEventsRedis } from './config/bullmq.js';
import prisma from './config/prismaClient.js';
import type { Worker } from 'bullmq';

// =============================================================================
// Port Validation
// =============================================================================
function resolvePort(val: string | undefined, defaultPort = 5000): number {
  if (!val) return defaultPort;
  const parsed = Number.parseInt(val, 10);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) {
    return parsed;
  }
  console.warn(`[Config] Invalid PORT "${val}". Falling back to default: ${defaultPort}`);
  return defaultPort;
}

const PORT = resolvePort(process.env['PORT'], 5000);

let httpServer: HttpServer | null = null;
let resumeWorker: Worker | null = null;
let isShuttingDown = false;

// =============================================================================
// Resilient Redis Connectivity Check
// =============================================================================
async function verifyRedisConnection(timeoutMs = 3000): Promise<boolean> {
  try {
    let timeoutId: NodeJS.Timeout | undefined;
    const pingPromise = redisClient.ping();
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Redis ping timed out')), timeoutMs);
    });

    const result = await Promise.race([pingPromise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    console.log(`✅ Redis connection verified: ${result}`);
    return true;
  } catch {
    console.warn('⚠️ Redis is not reachable at startup. API running in degraded mode (caching disabled, resume parsing will queue once connected).');
    return false;
  }
}

// =============================================================================
// Coordinated Graceful Shutdown
// =============================================================================
async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  // Force exit safety timeout (10 seconds)
  const forceExitTimer = setTimeout(() => {
    console.error('⚠️ Graceful shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  try {
    // 1. Stop receiving new HTTP requests & close idle sockets
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
      httpServer.closeIdleConnections?.();
      console.log('✅ HTTP server closed.');
    }

    // 2. Terminate Socket.io gateway
    await closeSocketServer();
    console.log('✅ Socket.io gateway closed.');

    // 3. Gracefully pause and close BullMQ Worker (waits for active job completion)
    if (resumeWorker) {
      await resumeWorker.close();
      console.log('✅ BullMQ resume parser worker closed.');
    }

    // 4. Close BullMQ Queues and Events
    await resumeQueue.close();
    await resumeQueueEvents.close();
    await queueEventsRedis.quit().catch(() => {});
    await bullRedis.quit().catch(() => {});
    console.log('✅ BullMQ queues and connections closed.');

    // 5. Close main Redis client
    await redisClient.quit().catch(() => {});
    console.log('✅ Redis client disconnected.');

    // 6. Disconnect Prisma DB pool
    await prisma.$disconnect();
    console.log('✅ PostgreSQL connection pool closed.');

    console.log('👋 All subsystems stopped cleanly. Exiting.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
}

// =============================================================================
// Server Bootstrap
// =============================================================================
const startServer = async (): Promise<void> => {
  try {
    // 1. Non-blocking Redis health check (logs status without crashing boot)
    await verifyRedisConnection();

    // 2. Wrap Express in a raw HTTP server so Socket.io can share the same port
    httpServer = createServer(app);

    // 3. Explicit HTTP server error listener (catches EADDRINUSE, EACCES)
    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use by another process.`);
      } else if (err.code === 'EACCES') {
        console.error(`❌ Port ${PORT} requires elevated privileges.`);
      } else {
        console.error('❌ HTTP server error:', err);
      }
      process.exit(1);
    });

    // 4. Attach Socket.io
    initSocketServer(httpServer);

    // 5. Start BullMQ resume-parsing worker & hold reference for shutdown
    resumeWorker = createResumeWorker();

    // 6. Listen
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start the server:', error);
    process.exit(1);
  }
};

// =============================================================================
// Process Signal & Unhandled Error Listeners
// =============================================================================
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
  shutdown('unhandledRejection');
});

startServer();

