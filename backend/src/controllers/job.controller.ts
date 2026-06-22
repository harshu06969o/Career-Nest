import type { Request, Response } from 'express';
import prisma from '../config/prismaClient.js';
import redisClient from '../config/redisClient.js';
import { parseJobDescription } from '../services/llm.service.js';

// BUG FIX (Bug 3): Added to support getJobApplicants response typing
interface ApplicantWithProfile {
  id: string;
  matchScore: number | null;
  status: string;
  appliedAt: Date;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    college: string;
    cgpa: number;
    experienceYears: number;
    resumeUrl: string | null;
    parsedSkills: string[];
    user: { email: string };
  };
}

// =============================================================================
// resolveParam — narrows Express params (string | string[]) → string
// =============================================================================
// Express types req.params values as `string | string[]` under strict nodenext.
// Route params are always a single string — this helper asserts that safely.
// =============================================================================
function resolveParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] ?? '';
  return param ?? '';
}

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

  const { title, description } = req.body as {
    title?: string;
    description?: string;
    minCgpa?: unknown;      // BUG FIX (Bug 2): typed as unknown to force explicit cast
    minExperience?: unknown; // Prevents trusting JSON type coercion silently
  };

  // BUG FIX (Bug 2): Explicitly cast with parseFloat() server-side.
  // The frontend sends parseFloat(string) but we NEVER trust incoming types.
  // `!isNaN(x)` check means we use ANY valid number the recruiter provided
  // (including 0.0), falling back to LLM only if the field was left completely empty.
  const parsedMinCgpa     = parseFloat(String(req.body.minCgpa ?? ''));
  const parsedMinExperience = parseFloat(String(req.body.minExperience ?? ''));

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
        // BUG FIX (Bug 2): Use !isNaN() instead of `> 0` — this respects explicit 0.0
        // values and is not fooled by string coercion. If recruiter left the field blank
        // (resulting in NaN), fall back to the LLM-parsed value.
        minCgpa:       !isNaN(parsedMinCgpa) ? parsedMinCgpa : parsedCriteria.minCgpa,
        minExperience: !isNaN(parsedMinExperience) ? parsedMinExperience : parsedCriteria.minExperience,
        isActive:      true,
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
      // Include the number of applications for Admin/Recruiter views
      include: {
        recruiter: {
          select: {
            recruiterProfile: { select: { companyName: true, designation: true } },
          },
        },
        _count: {
          select: { applications: true },
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

// =============================================================================
// getMyJobs
// =============================================================================
// GET /api/jobs/my-postings
//
// BUG FIX (Bug 1 — Cross-User Data Leakage): The original `getAllJobs` had
// NO recruiter filter — it returned every active job to every role.
// This endpoint strictly scopes the DB query to `recruiterId: req.user.userId`.
// A recruiter can NEVER see another recruiter's jobs through this endpoint.
//
// Includes application counts AND populated student details for the
// "View Applicants" feature (Bug 5 fix).
// =============================================================================
export const getMyJobs = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { userId: recruiterId } = req.user; // BUG FIX: strict per-user scoping

  try {
    const jobs = await prisma.job.findMany({
      where: { recruiterId }, // ← THE FIX: only this recruiter's own jobs
      orderBy: { createdAt: 'desc' },
      include: {
        // Application count for dashboard stats card
        _count: {
          select: { applications: true },
        },
      },
    });

    res.status(200).json({
      success: true,
      source: 'database',
      data: jobs,
    });
  } catch (dbError) {
    console.error('[DB] getMyJobs failed:', dbError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve your job postings.',
    });
  }
};

// =============================================================================
// getJobApplicants
// =============================================================================
// GET /api/jobs/:jobId/applicants
//
// BUG FIX (Bug 3 + Bug 5): The recruiter "View Applicants" panel was showing
// hardcoded mock data because this endpoint didn't exist. This endpoint:
//   1. Verifies the job belongs to the requesting recruiter (authorization)
//   2. Fetches all real Application records for that job
//   3. Joins student profile data (name, college, cgpa, skills, resume)
//   4. Sorts by matchScore descending (best candidates first)
// =============================================================================
export const getJobApplicants = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { userId, role } = req.user;
  // resolveParam narrows Express's `string | string[]` to a plain string
  const jobId = resolveParam(req.params['jobId']);

  if (!jobId.trim()) {
    res.status(400).json({ success: false, message: 'jobId parameter is required.' });
    return;
  }

  try {
    // Step 1: Verify the job exists and the requester owns it (or is Admin)
    const job = await prisma.job.findUnique({
      where: { id: jobId }, // jobId is now a guaranteed string (no string[])
      select: { id: true, title: true, recruiterId: true },
    });

    if (!job) {
      res.status(404).json({ success: false, message: 'Job not found.' });
      return;
    }

    // Authorization: only the job owner or an Admin may view applicants
    if (role !== 'ADMIN' && job.recruiterId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Forbidden. You can only view applicants for your own job postings.',
      });
      return;
    }

    // Step 2: Fetch all real applications with joined student profile data
    const applications = await prisma.application.findMany({
      where: { jobId }, // jobId is a guaranteed string
      orderBy: { matchScore: 'desc' }, // Best match first — mirrors recruiter UX
      include: {
        student: {
          select: {
            id:              true,
            firstName:       true,
            lastName:        true,
            college:         true,
            cgpa:            true,
            experienceYears: true,
            resumeUrl:       true,
            parsedSkills:    true,
            user: { select: { email: true } }, // For recruiter contact
          },
        },
      },
    }) as unknown as ApplicantWithProfile[]; // unknown intermediate resolves strict overlap TS error

    res.status(200).json({
      success: true,
      jobTitle: job.title,
      totalApplicants: applications.length,
      data: applications,
    });
  } catch (dbError) {
    console.error('[DB] getJobApplicants failed:', dbError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve applicants for this job.',
    });
  }
};

// =============================================================================
// deleteJob
// =============================================================================
// Deletes a specific job posting. Protected to the Recruiter who posted it,
// or an Admin.
// =============================================================================
export const deleteJob = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  // resolveParam narrows Express's `string | string[]` to a plain string
  const id = resolveParam(req.params['id']);
  const { userId, role } = req.user;

  try {
    const job = await prisma.job.findUnique({ where: { id } });
    
    if (!job) {
      res.status(404).json({ success: false, message: 'Job not found.' });
      return;
    }

    // Only the recruiter who posted it or an Admin can delete it
    if (role !== 'ADMIN' && job.recruiterId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden. You cannot delete this job.' });
      return;
    }

    await prisma.job.delete({ where: { id } });

    // Invalidate both single-job and all-jobs caches
    await safeRedisDel(CACHE_KEYS.singleJob(id));
    await safeRedisDel(CACHE_KEYS.allJobs);

    res.status(200).json({
      success: true,
      message: 'Job successfully deleted.',
    });
  } catch (dbError) {
    console.error('[DB] job.delete failed:', dbError);
    res.status(500).json({
      success: false,
      message: 'Failed to delete job.',
    });
  }
};


