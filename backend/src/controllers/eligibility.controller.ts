import type { Request, Response } from 'express';
import prisma from '../config/prismaClient.js';
import redisClient from '../config/redisClient.js';
import {
  calculateMatchScore,
  APPLY_THRESHOLD,
  type StudentMatchInput,
  type JobMatchInput,
} from '../services/matcher.service.js';
import { sendApplicationConfirmation } from '../services/notification.service.js';
import { emitToUser } from '../config/socketServer.js';

// =============================================================================
// Internal Types
// =============================================================================
// Typed shape of a job as returned from Prisma (or deserialised from Redis).
// Kept narrow — only fields the matching engine and response need.
// =============================================================================
interface JobRecord {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  minCgpa: number;
  minExperience: number;
  isActive: boolean;
  createdAt: string | Date;
  recruiterId: string;
  recruiter?: unknown;
}

interface RankedJob {
  matchScore: number;
  hasApplied: boolean;
  applicationStatus?: string | null;
  conversationId?: string | null;
  job: JobRecord;
}

// =============================================================================
// resolveParam — narrows Express params (string | string[]) → string
// =============================================================================
// Express types req.params values as `string | string[]` under strict nodenext.
// Route params are always a single string — this helper asserts that safely.
// =============================================================================
function resolveParam(param: string | string[] | undefined): string | undefined {
  if (Array.isArray(param)) return param[0];
  return param;
}

// =============================================================================
// Redis helpers (same graceful-degradation pattern as job.controller.ts)
// =============================================================================
const JOBS_ALL_KEY = 'jobs:all';
const JOBS_ALL_TTL = 3_600; // 1 hour

async function safeRedisGet(key: string): Promise<string | null> {
  try {
    return await redisClient.get(key);
  } catch {
    console.error(`[Cache] GET "${key}" failed — falling back to DB`);
    return null;
  }
}

async function safeRedisSetex(key: string, ttl: number, value: string): Promise<void> {
  try {
    await redisClient.setex(key, ttl, value);
  } catch {
    console.error(`[Cache] SETEX "${key}" failed — data still returned`);
  }
}

// =============================================================================
// fetchActiveJobs — Cache-first job list loader
// =============================================================================
// Shared by both checkAndApply and getStudentMatches so we never duplicate
// the Redis-fallback logic. Returns raw JobRecord[] suitable for the matcher.
// =============================================================================
async function fetchActiveJobs(): Promise<JobRecord[]> {
  const cached = await safeRedisGet(JOBS_ALL_KEY);
  if (cached !== null) {
    console.log('[Cache] HIT jobs:all');
    return JSON.parse(cached) as JobRecord[];
  }

  console.log('[Cache] MISS jobs:all — querying DB');
  const jobs = await prisma.job.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    include: {
      recruiter: {
        select: {
          recruiterProfile: { select: { companyName: true, designation: true } },
        },
      },
    },
  });

  await safeRedisSetex(JOBS_ALL_KEY, JOBS_ALL_TTL, JSON.stringify(jobs));
  return jobs as unknown as JobRecord[];
}

// POST /api/eligibility/apply/:jobId
export const checkAndApply = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { userId } = req.user;
  const jobId = resolveParam(req.params['jobId']);

  if (!jobId?.trim()) {
    res.status(400).json({ success: false, message: 'jobId URL parameter is required.' });
    return;
  }

  try {
    // ── Step 1: Fetch student profile ────────────────────────────────────────
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        college: true,
        parsedSkills: true,
        cgpa: true,
        experienceYears: true,
        resumeUrl: true,
        // Included for the confirmation email — no extra DB round-trip.
        user: { select: { email: true } },
      },
    });

    if (!studentProfile) {
      res.status(404).json({
        success: false,
        message: 'Student profile not found. Please complete your profile before applying.',
      });
      return;
    }

    if (!studentProfile.resumeUrl) {
      res.status(400).json({
        success: false,
        message: 'Please upload your resume before applying to jobs.',
      });
      return;
    }

    // ── Step 2: Fetch the target job ──────────────────────────────────────────
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        requiredSkills: true,
        minCgpa: true,
        minExperience: true,
        isActive: true,
        recruiterId: true,
      },
    });

    if (!job) {
      res.status(404).json({ success: false, message: 'Job posting not found.' });
      return;
    }

    if (!job.isActive) {
      res.status(410).json({ success: false, message: 'This job posting is no longer active.' });
      return;
    }

    // Prevent a student from applying to their own college placement poster
    // (edge case: a recruiter cannot also be a student, but belt-and-suspenders)
    if (job.recruiterId === userId) {
      res.status(400).json({ success: false, message: 'You cannot apply to your own job posting.' });
      return;
    }

    // ── Step 3: Calculate match score (pure local — zero LLM tokens) ──────────
    const studentInput: StudentMatchInput = {
      parsedSkills:    studentProfile.parsedSkills,
      cgpa:            studentProfile.cgpa,
      experienceYears: studentProfile.experienceYears,
    };

    const jobInput: JobMatchInput = {
      requiredSkills: job.requiredSkills,
      minCgpa:        job.minCgpa,
      minExperience:  job.minExperience,
    };

    const matchScore = calculateMatchScore(studentInput, jobInput);

    console.log(
      `[Matcher] Student ${userId} ↔ Job ${jobId}: ${matchScore}% ` +
      `(threshold: ${APPLY_THRESHOLD}%)`,
    );

    // ── Step 5: Eligibility gate ──────────────────────────────────────────────
    if (matchScore < APPLY_THRESHOLD) {
      res.status(400).json({
        success: false,
        message: `Not eligible: your match score of ${matchScore}% is below the ` +
                 `minimum threshold of ${APPLY_THRESHOLD}% for this role.`,
        data: {
          matchScore,
          threshold:     APPLY_THRESHOLD,
          requiredSkills: job.requiredSkills,
          yourSkills:     studentProfile.parsedSkills,
        },
      });
      return;
    }

    // ── Step 5: Create application record (DB enforces no duplicate applications) ──
    let application: Awaited<ReturnType<typeof prisma.application.create>>;
    try {
      application = await prisma.application.create({
        data: {
          studentId:  studentProfile.id,
          jobId,
          matchScore: matchScore,
          status:     'PENDING',
        },
      });
    } catch (createErr: unknown) {
      const isUniqueViolation =
        typeof createErr === 'object' &&
        createErr !== null &&
        'code' in createErr &&
        (createErr as { code: string }).code === 'P2002';
      if (isUniqueViolation) {
        res.status(409).json({
          success: false,
          message: 'You have already applied to this job.',
        });
        return;
      }
      throw createErr;
    }

    // ── Step 6b: Invalidate the jobs:all cache ────────────────────────────────
    // The Redis cache stores _count.applications at the time the cache was last
    // built. Without this DEL, every admin/recruiter dashboard shows stale
    // applicant counts (always 0) until the TTL naturally expires (1 hour).
    // Fire-and-forget: cache invalidation failure must never break the apply flow.
    void (async () => {
      try {
        await redisClient.del('jobs:all');
        console.log('[Cache] DEL jobs:all — applicant count updated after new application');
      } catch (cacheErr) {
        console.error('[Cache] DEL jobs:all failed (non-fatal):', cacheErr);
      }
    })();

    // ── Step 7: Send confirmation email (fire-and-forget) ────────────────────
    // We intentionally DO NOT await this promise before sending the HTTP
    // response.  Email delivery is non-critical infrastructure; a slow or
    // failing SMTP server must never delay or break the student's UX.
    //
    // void suppresses the "floating promise" ESLint warning without blocking.
    void sendApplicationConfirmation(
      studentProfile.user.email,
      job.title,
      matchScore,
    );

    // ── Step 8: Real-Time In-App Notification & Socket Alert for Recruiter ───
    void (async () => {
      try {
        const studentName = `${studentProfile.firstName} ${studentProfile.lastName}`.trim() || studentProfile.user.email;
        const notif = await prisma.notification.create({
          data: {
            userId: job.recruiterId,
            type: 'NEW_APPLICATION_RECEIVED',
            title: '📥 New Candidate Applied',
            message: `${studentName} applied to "${job.title}" with a ${matchScore}% match score.`,
            linkUrl: `/recruiter/dashboard?jobId=${job.id}`,
          },
        });
        emitToUser(job.recruiterId, 'recruiter:new_applicant', {
          jobId: job.id,
          jobTitle: job.title,
          studentId: studentProfile.id,
          studentName,
          matchScore,
          appliedAt: application.appliedAt,
        });
        emitToUser(job.recruiterId, 'notification:new', notif);
      } catch (notifErr) {
        console.error('[checkAndApply] Recruiter real-time notification failed (non-fatal):', notifErr);
      }
    })();

    res.status(201).json({
      success: true,
      message: `Application submitted successfully! Your match score is ${matchScore}%.`,
      data: {
        applicationId: application.id,
        jobId,
        matchScore,
        status: application.status,
        appliedAt: application.appliedAt,
      },
    });
  } catch (error) {
    console.error('[checkAndApply] Error:', error);
    res.status(500).json({ success: false, message: 'An error occurred while processing your application.' });
  }
};

// =============================================================================
// getStudentMatches
// =============================================================================
// GET /api/eligibility/matches
//
// Scores the logged-in student against EVERY active job using the local
// matching engine — no API calls, no DB queries beyond the initial fetch.
//
// Performance profile (N = number of active jobs):
//   - Redis HIT  : 1 Redis GET + N in-memory calculations → ~1–5ms total
//   - Redis MISS : 1 Redis GET + 1 DB query + N calculations + 1 Redis SET
//   - No external APIs called regardless of N
//
// Returns top 20 ranked jobs to keep response payloads lean for the UI.
// =============================================================================
export const getStudentMatches = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { userId } = req.user;

  try {
    // ── Step 1: Fetch student profile ─────────────────────────────────────────
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        parsedSkills: true,
        cgpa: true,
        experienceYears: true,
      },
    });

    if (!studentProfile) {
      res.status(404).json({
        success: false,
        message: 'Student profile not found. Please complete your profile to view job matches.',
      });
      return;
    }

    // ── Step 2: Fetch student's existing application jobIds (one query) ────────
    // We fetch ALL jobIds this student has already applied to in a single DB
    // query. Using a Set for O(1) lookups when tagging each ranked job below.
    // This is the key fix for Bug 2: without this, the frontend initializes
    // appliedJobs as an empty Set on every page load, losing applied state.
    const applicationByJobId = new Map<string, { status: string; conversationId: string | null }>();
    try {
      const existingApplications = await prisma.application.findMany({
        where: { studentId: studentProfile.id },
        select: {
          jobId: true,
          status: true,
          conversation: { select: { id: true } },
        },
      });
      existingApplications.forEach((a) => {
        applicationByJobId.set(a.jobId, {
          status: a.status,
          conversationId: a.conversation?.id ?? null,
        });
      });
      console.log(`[Matcher] Student ${userId} has ${existingApplications.length} existing application(s)`);
    } catch (appError) {
      console.error('[getStudentMatches] Failed to fetch existing applications:', appError);
    }

    // ── Step 3: Load active jobs (cache-first) ────────────────────────────────
    let jobs: JobRecord[];
    try {
      jobs = await fetchActiveJobs();
    } catch (dbError) {
      console.error('[getStudentMatches] Job fetch failed:', dbError);
      res.status(500).json({ success: false, message: 'Failed to load job listings.' });
      return;
    }

    if (jobs.length === 0) {
      res.status(200).json({
        success: true,
        message: 'No active job listings available at the moment.',
        data: [],
      });
      return;
    }

    // ── Step 4: Score every job and tag with hasApplied ──────────────────────
    const studentInput: StudentMatchInput = {
      parsedSkills:    studentProfile.parsedSkills,
      cgpa:            studentProfile.cgpa,
      experienceYears: studentProfile.experienceYears,
    };

    const ranked: RankedJob[] = jobs
      .map((job) => {
        const jobInput: JobMatchInput = {
          requiredSkills: job.requiredSkills,
          minCgpa:        job.minCgpa,
          minExperience:  job.minExperience,
        };
        const appInfo = applicationByJobId.get(job.id);
        return {
          matchScore: calculateMatchScore(studentInput, jobInput),
          hasApplied: !!appInfo,
          applicationStatus: appInfo?.status ?? null,
          conversationId: appInfo?.conversationId ?? null,
          job,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore) // Descending by match score
      .slice(0, 20); // Top 20 — keeps API response lean for the UI

    console.log(
      `[Matcher] Scored ${jobs.length} jobs for student ${userId}. ` +
      `Top score: ${ranked[0]?.matchScore ?? 0}%`,
    );

    res.status(200).json({
      success: true,
      totalJobsEvaluated: jobs.length,
      data: ranked,
    });
  } catch (error) {
    console.error('[getStudentMatches] Error:', error);
    res.status(500).json({ success: false, message: 'An error occurred while calculating job matches.' });
  }
};
