// src/config/bullmq.ts
// Shared BullMQ Queue + QueueEvents — both backed by the same ioredis connection.
// Keeping the connection separate from the main redisClient so BullMQ can set
// maxRetriesPerRequest: null (required by BullMQ) without affecting other code.

import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';

const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

// BullMQ requires maxRetriesPerRequest: null on its ioredis connections
export const bullRedis = new Redis(redisUrl, { maxRetriesPerRequest: null });

bullRedis.on('error', (err: Error) => {
  console.error('[BullMQ] Redis connection error:', err.message);
});

// ── Queue ─────────────────────────────────────────────────────────────────────
// Jobs enqueued here: { resumeUrl: string, userId: string }
export const resumeQueue = new Queue('resume-parse', {
  connection: bullRedis,
  defaultJobOptions: {
    attempts:    3,
    backoff:     { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 50  },
  },
});

resumeQueue.on('error', (err: Error) => {
  console.error('[BullMQ] Queue error:', err.message);
});

// ── QueueEvents ───────────────────────────────────────────────────────────────
// Lets server.ts listen for completed/failed events without being the worker.
// (Used only in the server process; the worker also has its own internal events.)
export const queueEventsRedis = new Redis(redisUrl, { maxRetriesPerRequest: null });

queueEventsRedis.on('error', (err: Error) => {
  console.error('[BullMQ] QueueEvents Redis connection error:', err.message);
});

export const resumeQueueEvents = new QueueEvents('resume-parse', {
  connection: queueEventsRedis,
});

resumeQueueEvents.on('error', (err: Error) => {
  console.error('[BullMQ] QueueEvents error:', err.message);
});
