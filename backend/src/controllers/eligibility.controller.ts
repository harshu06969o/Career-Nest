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

  console.log('[Cache] MISS jobs:all — querying MongoDB');
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

// =============================================================================
// checkAndApply
// =============================================================================
// POST /api/eligibility/apply/:jobId
//
// Full pipeline:
//  1. Resolve student profile from req.user.userId
//  2. Resolve job from URL param :jobId
//  3. Duplicate-application guard (findFirst — no double-apply)
//  4. calculateMatchScore() — pure local computation, 0 LLM calls
//  5. Threshold gate — reject if score < APPLY_THRESHOLD (50)
//  6. Create Application record (matchScore + PENDING status)
//  7. Return 201 with match score and application id
// =============================================================================
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

    // ── Step 3: Duplicate-application guard ───────────────────────────────────
    // As documented in schema.prisma, MongoDB+Prisma cannot enforce @@unique
    // on two ObjectId fields. We enforce it here at the controller layer.
    const existing = await prisma.application.findFirst({
      where: { studentId: studentProfile.id, jobId },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: 'You have already applied to this job.',
        data: { applicationId: existing.id, status: existing.status },
      });
      return;
    }

    // ── Step 4: Calculate match score (pure local — zero LLM tokens) ──────────
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

    // ── Step 6: Create application record ────────────────────────────────────
    const application = await prisma.application.create({
      data: {
        studentId:  studentProfile.id,
        jobId,
        matchScore: matchScore,
        status:     'PENDING',
      },
    });

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

    // ── Step 2: Load active jobs (cache-first) ────────────────────────────────
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

    // ── Step 3: Score every job against this student ──────────────────────────
    // calculateMatchScore is a pure function — safe to call in a tight loop.
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
        return {
          matchScore: calculateMatchScore(studentInput, jobInput),
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
