import { Router } from 'express';
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js';
import {
  createJob,
  getAllJobs,
  getMyJobs,
  getJobApplicants,
  deleteJob,
  getAdminStats,   // Real-time platform stats for Admin Dashboard
} from '../controllers/job.controller.js';

const router = Router();

// =============================================================================
// POST /api/jobs
// =============================================================================
// Creates a new job posting. Protected to RECRUITER and ADMIN only.
// The LLM parses the description ONCE here — never again.
//
// Security chain: verifyToken → requireRole(['RECRUITER', 'ADMIN']) → createJob
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
// Returns ALL active job listings. Used by Student feed and Admin overview.
// Cache-first: Redis HIT → O(1), Redis MISS → MongoDB + prime cache.
//
// Security chain: verifyToken → getAllJobs
// =============================================================================
router.get(
  '/',
  verifyToken,
  getAllJobs,
);

// =============================================================================
// GET /api/jobs/my-postings
// =============================================================================
// BUG FIX (Bug 1 — Cross-User Data Leakage):
// Returns ONLY the authenticated recruiter's own job postings.
// The controller enforces `where: { recruiterId: req.user.userId }`.
//
// ⚠ ROUTE ORDER IS CRITICAL: This route MUST be declared before `/:id`
//   so Express doesn't interpret the literal string "my-postings" as
//   an :id param and route it to the wrong handler.
//
// Security chain: verifyToken → requireRole(['RECRUITER','ADMIN']) → getMyJobs
// =============================================================================
router.get(
  '/my-postings',
  verifyToken,
  requireRole(['RECRUITER', 'ADMIN']),
  getMyJobs,
);

// =============================================================================
// GET /api/jobs/admin-stats
// =============================================================================
// Returns real-time platform counts: total students, total applications,
// and active job count. Admin-only. No caching — always fresh from MongoDB.
//
// ⚠ ROUTE ORDER CRITICAL: Must appear BEFORE /:jobId and /:id param routes
//   so Express matches the literal string "admin-stats" here, not as a jobId.
//
// Security chain: verifyToken → requireRole(['ADMIN']) → getAdminStats
// =============================================================================
router.get(
  '/admin-stats',
  verifyToken,
  requireRole(['ADMIN']),
  getAdminStats,
);

// =============================================================================
// GET /api/jobs/:jobId/applicants
// =============================================================================
// BUG FIX (Bug 3 + Bug 5): Fetches real Application records with joined
// student profiles. Replaces the hardcoded mock applicants array in
// RecruiterDashboard. Controller validates job ownership before returning data.
//
// Security chain: verifyToken → requireRole(['RECRUITER','ADMIN']) → getJobApplicants
// =============================================================================
router.get(
  '/:jobId/applicants',
  verifyToken,
  requireRole(['RECRUITER', 'ADMIN']),
  getJobApplicants,
);

// =============================================================================
// DELETE /api/jobs/:id
// =============================================================================
// Deletes a job listing. Protected to RECRUITER and ADMIN.
// Controller enforces recruiters can only delete their own jobs (Bug 6).
// =============================================================================
router.delete(
  '/:id',
  verifyToken,
  requireRole(['RECRUITER', 'ADMIN']),
  deleteJob,
);

export default router;
