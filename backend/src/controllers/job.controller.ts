import type { Request, Response } from 'express';
import prisma from '../config/prismaClient.js';
import redisClient from '../config/redisClient.js';
import { parseJobDescription } from '../services/llm.service.js';

// =============================================================================
// Redis Key Registry & TTL Constants
// =============================================================================
// Centralising key strings prevents typos across controller actions.
// Invalidation logic (DEL jobs:all) depends on this matching exactly.
// =============================================================================
const CACHE_KEYS = {
  allJobs: 'jobs:all',
  singleJob: (id: string) => `job:${id}`,
} as const;

const TTL = {
  singleJob: 86_400,  // 24 hours — individual jobs rarely change after creation
  allJobs:    3_600,  // 1 hour  — proactively invalidated on every new post anyway
} as const;

// =============================================================================
// Graceful Redis wrapper
// =============================================================================
// ALL Redis operations are wrapped in this helper. If Redis is temporarily
// unavailable, it logs and returns null — the caller falls through to MongoDB.
// This ensures zero cascading failures: Redis down ≠ API down.
// =============================================================================
async function safeRedisGet(key: string): Promise<string | null> {
  try {
    return await redisClient.get(key);
  } catch (err) {
    console.error(`[Cache] GET "${key}" failed — falling back to DB:`, err);
    return null;
  }
}

async function safeRedisSetex(key: string, ttl: number, value: string): Promise<void> {
  try {
    await redisClient.setex(key, ttl, value);
    console.log(`[Cache] SET "${key}" (TTL: ${ttl}s)`);
  } catch (err) {
    console.error(`[Cache] SETEX "${key}" failed — data still returned from DB:`, err);
    // Non-fatal: the response is still sent, just not cached this cycle
  }
}

async function safeRedisDel(key: string): Promise<void> {
  try {
    await redisClient.del(key);
    console.log(`[Cache] DEL "${key}" (invalidated)`);
  } catch (err) {
    console.error(`[Cache] DEL "${key}" failed:`, err);
  }
}

// =============================================================================
// createJob
// =============================================================================
// Pipeline:
//  1. Validate body → 400
//  2. Parse description with LLM (ONE-TIME cost) → structured criteria
//  3. Atomic Prisma write → MongoDB
//  4. Cache individual job at job:${id}
//  5. Invalidate jobs:all so the next GET rebuilds a fresh list
//  6. Return 201
//
// Token contract: parseJobDescription is called exactly ONCE per job.
// Every subsequent read hits Redis in O(1) — zero LLM calls, zero DB queries.
// =============================================================================
export const createJob = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { title, description } = req.body as { title?: string; description?: string };

  if (!title?.trim() || !description?.trim()) {
    res.status(400).json({
      success: false,
      message: 'Both "title" and "description" fields are required and must not be empty.',
    });
    return;
  }

  const { userId: recruiterId } = req.user;

  // ── Step 1: LLM Parse (one-time, never repeated for this job) ──────────────
  let parsedCriteria: Awaited<ReturnType<typeof parseJobDescription>>;
  try {
    console.log(`[LLM] Parsing job description for: "${title}"`);
    parsedCriteria = await parseJobDescription(description);
    console.log(
      `[LLM] Parsed — skills: ${parsedCriteria.requiredSkills.length}, ` +
      `minCgpa: ${parsedCriteria.minCgpa}, minExp: ${parsedCriteria.minExperience}yr`,
    );
  } catch (llmError) {
    console.error('[LLM] parseJobDescription failed:', llmError);
    res.status(500).json({
      success: false,
      message: 'Failed to parse job description with AI service. Please try again.',
    });
    return;
  }

  // ── Step 2: Persist to MongoDB ─────────────────────────────────────────────
  let job: Awaited<ReturnType<typeof prisma.job.create>>;
  try {
    job = await prisma.job.create({
      data: {
        recruiterId,
        title: title.trim(),
        description: description.trim(),
        requiredSkills: parsedCriteria.requiredSkills,
        minCgpa:        parsedCriteria.minCgpa,
        minExperience:  parsedCriteria.minExperience,
        isActive:       true,
      },
    });
  } catch (dbError) {
    console.error('[DB] job.create failed:', dbError);
    res.status(500).json({
      success: false,
      message: 'Failed to save job posting to the database.',
    });
    return;
  }

  // ── Step 3: Prime individual job cache ─────────────────────────────────────
  // Serialise the full job record so single-job GETs (GET /api/jobs/:id)
  // never touch the DB on the first read either.
  const serialised = JSON.stringify(job);
  await safeRedisSetex(CACHE_KEYS.singleJob(job.id), TTL.singleJob, serialised);

  // ── Step 4: Invalidate the all-jobs list cache ─────────────────────────────
  // The cached list is now stale. DEL forces the next GET /api/jobs to
  // rebuild from MongoDB with the new job included.
  await safeRedisDel(CACHE_KEYS.allJobs);

  res.status(201).json({
    success: true,
    message: 'Job posted and AI-parsed successfully.',
    data: job,
  });
};

// =============================================================================
// getAllJobs
// =============================================================================
// Cache-first read strategy:
//
//   Redis HIT  → return immediately (0 DB queries, 0 LLM calls, O(1) latency)
//   Redis MISS → query MongoDB, prime cache, return data
//   Redis DOWN → gracefully fall through to MongoDB (no crash)
//
// The `source` field in the response tells the caller (and developers)
// whether the data came from cache or the database — useful for debugging.
// =============================================================================
export const getAllJobs = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  // ── Cache Check ────────────────────────────────────────────────────────────
  const cached = await safeRedisGet(CACHE_KEYS.allJobs);

  if (cached !== null) {
    console.log('[Cache] HIT jobs:all — returning from Redis');
    res.status(200).json({
      success: true,
      source: 'cache',
      data: JSON.parse(cached) as unknown[],
    });
    return;
  }

  // ── Cache Miss: query MongoDB ──────────────────────────────────────────────
  console.log('[Cache] MISS jobs:all — querying MongoDB');
  try {
    const jobs = await prisma.job.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      // Include recruiter company name so the student feed has context
      include: {
        recruiter: {
          select: {
            recruiterProfile: { select: { companyName: true, designation: true } },
          },
        },
      },
    });

    // ── Prime the cache for subsequent requests ──────────────────────────────
    await safeRedisSetex(CACHE_KEYS.allJobs, TTL.allJobs, JSON.stringify(jobs));

    res.status(200).json({
      success: true,
      source: 'database',
      data: jobs,
    });
  } catch (dbError) {
    console.error('[DB] job.findMany failed:', dbError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve job listings.',
    });
  }
};
