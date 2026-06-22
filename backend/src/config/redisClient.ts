import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

// ioredis is a CommonJS package. Under nodenext + ESM, the default export
// is the Redis constructor accessed via the module's default export.
const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy(times: number) {
    // Exponential backoff: caps at 2s between retries.
    // Does NOT crash the app — ioredis silently retries in the background.
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redisClient.on('connect', () => {
  console.log('✅ Redis client connected');
});

redisClient.on('error', (err: Error) => {
  // Log but do NOT throw — lets the app stay alive if Redis is temporarily down.
  console.error('Redis client error:', err.message);
});

export default redisClient;
