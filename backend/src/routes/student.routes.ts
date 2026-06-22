import { Router } from 'express';
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js';
import { uploadResumeSingle } from '../middlewares/upload.middleware.js';
import { uploadResume } from '../controllers/student.controller.js';

const router = Router();

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
