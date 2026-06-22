import { Router } from 'express';
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js';
import { checkAndApply, getStudentMatches } from '../controllers/eligibility.controller.js';

const router = Router();

// =============================================================================
// POST /api/eligibility/apply/:jobId
// =============================================================================
// Student submits an application for a specific job.
// The matching engine runs locally (zero LLM cost) and rejects
// applications below the APPLY_THRESHOLD (50%) automatically.
//
// Security chain: verifyToken → requireRole(['STUDENT']) → checkAndApply
// =============================================================================
router.post(
  '/apply/:jobId',
  verifyToken,
  requireRole(['STUDENT']),
  checkAndApply,
);

// =============================================================================
// GET /api/eligibility/matches
// =============================================================================
// Returns all active jobs ranked by match score for the logged-in student.
// Powers the "Job Matches" feed in the frontend. Pulls from Redis cache
// for the job list — only the scoring is computed at request time.
//
// Security chain: verifyToken → requireRole(['STUDENT']) → getStudentMatches
// =============================================================================
router.get(
  '/matches',
  verifyToken,
  requireRole(['STUDENT']),
  getStudentMatches,
);

export default router;
