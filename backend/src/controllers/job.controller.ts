import type { Request, Response } from 'express';
import prisma from '../config/prismaClient.js';
import redisClient from '../config/redisClient.js';
import { parseJobDescription } from '../services/llm.service.js';
import { emitToUser } from '../config/socketServer.js';

// BUG FIX (Bug 3): Added to support getJobApplicants response typing
interface ApplicantWithProfile {
  id: string;
  matchScore: number | null;
  status: string;
  appliedAt: Date;
  conversation?: { id: string } | null;
  conversationId?: string | null;
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
// unavailable, it logs and returns null — the caller falls through to PostgreSQL.
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

/**
 * Creates a new job posting and extracts structured hiring criteria via LLM.
 *
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 *
 * @architecture
 * Zero-Token Recurring Cost Strategy: The job description is parsed by the LLM exactly once 
 * during creation. The extracted schema (skills, CGPA, experience) is persisted to the database. 
 * All subsequent matching queries execute locally in O(1) time without triggering external APIs.
 */
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

  // ── Step 2: Persist to PostgreSQL ──────────────────────────────────────────
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
  // rebuild from PostgreSQL with the new job included.
  await safeRedisDel(CACHE_KEYS.allJobs);

  res.status(201).json({
    success: true,
    message: 'Job posted and AI-parsed successfully.',
    data: job,
  });
};

/**
 * Retrieves all active job postings for the global feed.
 *
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 *
 * @architecture
 * Cache-first read strategy utilizing Redis. If a cache miss occurs, data is fetched 
 * from PostgreSQL, cached, and returned. Graceful degradation ensures that if the Redis 
 * layer is unavailable, queries safely fall through directly to PostgreSQL.
 */
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

  // ── Cache Miss: query PostgreSQL ───────────────────────────────────────────
  console.log('[Cache] MISS jobs:all — querying DB');
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

/**
 * Retrieves job postings created by the authenticated recruiter.
 *
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 */
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

/**
 * Retrieves a ranked list of student applicants for a specific job posting.
 *
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 * 
 * @architecture
 * Data Isolation: Strictly enforces that only the job owner (recruiter) or an Admin 
 * can view the applicants. Candidates are returned pre-sorted by their algorithmic 
 * matchScore descending.
 */
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

    // Step 2: Fetch all real applications with joined student profile data & conversation
    const applications = await prisma.application.findMany({
      where: { jobId }, // jobId is a guaranteed string
      orderBy: { matchScore: 'desc' }, // Best match first — mirrors recruiter UX
      include: {
        conversation: { select: { id: true } },
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
    });

    const mapped = applications.map(app => ({
      ...app,
      conversationId: app.conversation?.id ?? null,
    })) as unknown as ApplicantWithProfile[];

    res.status(200).json({
      success: true,
      jobTitle: job.title,
      totalApplicants: mapped.length,
      data: mapped,
    });
  } catch (dbError) {
    console.error('[DB] getJobApplicants failed:', dbError);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve applicants for this job.',
    });
  }
};

/**
 * Deletes a specific job posting and invalidates relevant caches.
 *
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 */
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


// =============================================================================
// getAdminStats
// =============================================================================
// GET /api/jobs/admin-stats
//
// Returns real-time platform-wide counts for the Admin Dashboard.
// Runs 3 parallel Prisma queries using Promise.all for efficiency.
// No caching — admin stats are always served fresh.
// =============================================================================
export const getAdminStats = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  try {
    const [totalStudents, totalApplications, activeJobCount] = await Promise.all([
      prisma.studentProfile.count(),
      prisma.application.count(),
      prisma.job.count({ where: { isActive: true } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalStudents,
        totalApplications,
        activeJobCount,
      },
    });
  } catch (dbError) {
    console.error('[DB] getAdminStats failed:', dbError);
    res.status(500).json({ success: false, message: 'Failed to fetch admin statistics.' });
  }
};

/**
 * Updates application status (`PENDING`, `SHORTLISTED`, `REJECTED`).
 *
 * @state_transitions
 * - SHORTLISTED:
 *   1. Upserts 1-on-1 `Conversation` connecting candidate and recruiter.
 *   2. Provisions persistent `APPLICATION_SHORTLISTED` notification.
 *   3. Emits `application:status_changed` and `notification:new` over WebSocket for instant UI celebration and unlocked chat drawer.
 * - REJECTED:
 *   1. Provisions courteous `APPLICATION_REJECTED` notification.
 *   2. Emits `application:status_changed` over WebSocket for instant state synchronization.
 *
 * @authorization Strictly restricted to the job's creator (`recruiterId === userId`) or system `ADMIN`.
 * @route PATCH /api/jobs/applications/:id/status
 */
export const updateApplicationStatus = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { userId, role } = req.user;
  const applicationId = resolveParam(req.params['id'] || req.params['applicationId']);
  const { status } = req.body as { status?: string };

  if (!applicationId || !status || !['PENDING', 'SHORTLISTED', 'REJECTED'].includes(status)) {
    res.status(400).json({
      success: false,
      message: 'Valid applicationId and status (PENDING, SHORTLISTED, REJECTED) are required.',
    });
    return;
  }

  try {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: { select: { id: true, title: true, recruiterId: true } },
        student: {
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            user: { select: { email: true } },
          },
        },
        conversation: { select: { id: true } },
      },
    });

    if (!application) {
      res.status(404).json({ success: false, message: 'Application not found.' });
      return;
    }

    // Security check: Only the recruiter who posted the job or an ADMIN can update status
    if (role !== 'ADMIN' && application.job.recruiterId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to manage this application.',
      });
      return;
    }

    // Update status in PostgreSQL
    const updatedApplication = await prisma.application.update({
      where: { id: applicationId },
      data: { status: status as 'PENDING' | 'SHORTLISTED' | 'REJECTED' },
    });

    let conversationId: string | null = application.conversation?.id ?? null;

    if (status === 'SHORTLISTED') {
      // 1. Upsert Conversation
      const conversation = await prisma.conversation.upsert({
        where: { applicationId: application.id },
        create: {
          applicationId: application.id,
          recruiterId: application.job.recruiterId,
          studentId: application.student.userId,
        },
        update: {},
      });
      conversationId = conversation.id;

      // 2. Create in-app Notification for student
      const notif = await prisma.notification.create({
        data: {
          userId: application.student.userId,
          type: 'APPLICATION_SHORTLISTED',
          title: '🎉 You have been Shortlisted!',
          message: `Congratulations! Your application for "${application.job.title}" has been shortlisted. Real-time chat with the recruiter is now open!`,
          linkUrl: `/student/dashboard?conversationId=${conversation.id}`,
        },
      });

      // 3. Emit real-time events to student
      emitToUser(application.student.userId, 'application:status_changed', {
        applicationId: application.id,
        jobId: application.job.id,
        jobTitle: application.job.title,
        status: 'SHORTLISTED',
        conversationId: conversation.id,
      });
      emitToUser(application.student.userId, 'notification:new', notif);
    } else if (status === 'REJECTED') {
      // 1. Create in-app Notification for student
      const notif = await prisma.notification.create({
        data: {
          userId: application.student.userId,
          type: 'APPLICATION_REJECTED',
          title: 'Application Status Update',
          message: `Your application for "${application.job.title}" has been reviewed. The recruiter has chosen to proceed with other candidates.`,
          linkUrl: `/student/dashboard`,
        },
      });

      // 2. Emit real-time events to student
      emitToUser(application.student.userId, 'application:status_changed', {
        applicationId: application.id,
        jobId: application.job.id,
        jobTitle: application.job.title,
        status: 'REJECTED',
      });
      emitToUser(application.student.userId, 'notification:new', notif);
    }

    res.status(200).json({
      success: true,
      message: `Application status updated to ${status}.`,
      data: {
        application: updatedApplication,
        conversationId,
      },
    });
  } catch (error) {
    console.error('[updateApplicationStatus] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update application status.' });
  }
};
