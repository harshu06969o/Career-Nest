import { Router } from 'express';
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js';
import { createJob, getAllJobs } from '../controllers/job.controller.js';

const router = Router();

// =============================================================================
// POST /api/jobs
// =============================================================================
// Creates a new job posting. Protected to RECRUITER and ADMIN only.
// The LLM parses the description ONCE here — never again.
//
// Request body:
//   { title: string, description: string }
//
// Security chain:
//   verifyToken → requireRole(['RECRUITER', 'ADMIN']) → createJob
// =============================================================================
router.post(
  '/',
  verifyToken,
  requireRole(['RECRUITER', 'ADMIN']),
  createJob,
);

// =============================================================================
// GET /api/jobs
// =============================================================================
// Returns all active job listings. All authenticated users (students,
// recruiters, admins) can view the job feed.
//
// Cache behaviour:
//   - FIRST request after a new job post: hits MongoDB, primes Redis
//   - ALL subsequent requests within TTL: served from Redis in O(1)
//   - If Redis is down: transparent fallback to MongoDB
//
// Security chain:
//   verifyToken → getAllJobs
// =============================================================================
router.get(
  '/',
  verifyToken,
  getAllJobs,
);

export default router;
