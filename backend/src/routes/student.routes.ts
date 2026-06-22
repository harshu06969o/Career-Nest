import { Router } from 'express';
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js';
import { uploadResumeSingle } from '../middlewares/upload.middleware.js';
import { uploadResume, getProfile, updateProfile } from '../controllers/student.controller.js';

const router = Router();

// =============================================================================
// GET /api/student/profile
// =============================================================================
// BUG FIX (Bug 1 + Bug 3): This route was completely missing. The Student
// Dashboard always fetched /api/student/profile but it had no handler —
// every load silently failed with a network error, leaving profile as null.
//
// Security: verifyToken + requireRole('STUDENT') ensures only the
// authenticated student can access their own profile data.
// The getProfile controller enforces `where: { userId: req.user.userId }`.
// =============================================================================
router.get(
  '/profile',
  verifyToken,
  requireRole(['STUDENT']),
  getProfile,
);

// =============================================================================
// PUT /api/student/profile
// =============================================================================
// MISSING FEATURE: Students update their name, college, CGPA, and experience.
// Without this route, every student's profile stays blank (cgpa=0) forever,
// causing all eligibility checks to fail.
// =============================================================================
router.put(
  '/profile',
  verifyToken,
  requireRole(['STUDENT']),
  updateProfile,
);

// =============================================================================
// POST /api/student/resume
// =============================================================================
// Middleware execution order is critical — each layer is a security gate:
//
//  1. verifyToken       → Rejects unauthenticated requests (401)
//  2. requireRole       → Rejects non-STUDENT roles (403)
//  3. uploadResumeSingle→ Validates MIME type, size, writes to disk (400/413)
//  4. uploadResume      → Persists file URL to DB (400/404/500)
//
// The field name "resume" in uploadResumeSingle must match the field name
// the client sends in its multipart/form-data request body.
// =============================================================================
router.post(
  '/resume',
  verifyToken,
  requireRole(['STUDENT']),
  uploadResumeSingle,
  uploadResume,
);

export default router;
