import type { Request, Response } from 'express';
import prisma from '../config/prismaClient.js';
import { extractTextFromPdf, parseResumeWithLLM } from '../services/llm.service.js';

// =============================================================================
// getProfile
// =============================================================================
// GET /api/student/profile
//
// BUG FIX (Bug 1 + Bug 3): This route was completely missing. The Student
// Dashboard called GET /api/student/profile on every load but no handler
// existed, causing the profile to always appear as null/empty.
//
// Filters strictly by `userId: req.user.userId` — a student can ONLY ever
// receive their own profile, preventing any cross-user data leakage.
// =============================================================================
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  // verifyToken guarantees req.user — narrow defensively for TypeScript strict mode
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { userId } = req.user; // BUG FIX: always scoped to the authenticated user's ID

  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId }, // Strict per-user filter — never returns another user's profile
      select: {
        id:              true,
        firstName:       true,
        lastName:        true,
        college:         true,
        cgpa:            true,
        experienceYears: true,
        resumeUrl:       true,
        parsedSkills:    true,
      },
    });

    if (!profile) {
      // 404 is expected for new users who haven't completed onboarding
      res.status(404).json({
        success: false,
        message: 'Student profile not found. Please complete your profile setup.',
      });
      return;
    }

    res.status(200).json({ success: true, data: profile });
  } catch (dbError) {
    console.error('[DB] studentProfile.findUnique (getProfile) failed:', dbError);
    res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
  }
};

// =============================================================================
// updateProfile
// =============================================================================
// PUT /api/student/profile
//
// MISSING FEATURE (Production Bug): Students had no way to set their name,
// college, or CGPA after registration. The register controller creates a blank
// profile (firstName: '', cgpa: 0). Without this endpoint, every student's
// eligibility check against jobs always failed because cgpa was always 0.
//
// Input validation: cgpa must be a float between 0.0 and 10.0.
// =============================================================================
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { userId } = req.user;

  const { firstName, lastName, college, cgpa, experienceYears } = req.body as {
    firstName?: string;
    lastName?: string;
    college?: string;
    cgpa?: number;
    experienceYears?: number;
  };

  // Validate CGPA range
  const cgpaFloat = cgpa !== undefined ? parseFloat(String(cgpa)) : undefined;
  if (cgpaFloat !== undefined && (isNaN(cgpaFloat) || cgpaFloat < 0 || cgpaFloat > 10)) {
    res.status(400).json({ success: false, message: 'cgpa must be a number between 0.0 and 10.0.' });
    return;
  }

  const expFloat = experienceYears !== undefined ? parseFloat(String(experienceYears)) : undefined;

  try {
    const result = await prisma.studentProfile.updateMany({
      where: { userId },
      data: {
        ...(firstName !== undefined && { firstName: firstName.trim() }),
        ...(lastName  !== undefined && { lastName:  lastName.trim()  }),
        ...(college   !== undefined && { college:   college.trim()   }),
        ...(cgpaFloat !== undefined && { cgpa:      cgpaFloat        }),
        ...(expFloat  !== undefined && { experienceYears: expFloat   }),
      },
    });

    if (result.count === 0) {
      res.status(404).json({ success: false, message: 'Student profile not found.' });
      return;
    }

    // Return updated profile
    const updated = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true, firstName: true, lastName: true, college: true, cgpa: true, experienceYears: true, resumeUrl: true, parsedSkills: true },
    });

    res.status(200).json({ success: true, message: 'Profile updated successfully.', data: updated });
  } catch (dbError) {
    console.error('[DB] studentProfile.updateMany (updateProfile) failed:', dbError);
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
};

// =============================================================================
// uploadResume
// =============================================================================
// Full pipeline (runs sequentially — each step's output feeds the next):
//
//  [multer+Cloudinary] → File streamed to Cloudinary CDN  → req.file.path = secure HTTPS URL
//      ↓
//  [step 1]  → fetch Cloudinary URL, extract PDF text      → cleaned raw text
//      ↓
//  [step 2]  → parseResumeWithLLM(text)                    → { skills, experienceYears, projects }
//      ↓
//  [step 3]  → prisma.studentProfile.updateMany()          → DB record updated atomically
//      ↓
//  [step 4]  → 200 JSON response with all saved data
//
// Failure contract: if ANY step throws, the entire handler returns 500.
// Cloudinary file may remain (orphaned) but the DB is NOT updated, so the
// profile is never left in a half-written/corrupted state.
// =============================================================================
export const uploadResume = async (req: Request, res: Response): Promise<void> => {
  // verifyToken guarantees req.user, but TypeScript doesn't know that —
  // we narrow defensively to satisfy strict mode.
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  // uploadResumeSingle guarantees req.file, but same defensive check applies.
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: 'No file received. Attach a PDF using the form field name "resume".',
    });
    return;
  }

  const { userId } = req.user;

  // After CloudinaryStorage, req.file.path contains the secure HTTPS URL
  // (e.g. https://res.cloudinary.com/<cloud>/raw/upload/careernest_resumes/<id>.pdf)
  // This URL is stable, CDN-backed, and safe to store directly in MongoDB.
  const resumeUrl = req.file.path;

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1 + 2: PDF Text Extraction → LLM Parsing
  // ─────────────────────────────────────────────────────────────────────────
  // req.file.path is the Cloudinary secure URL. We fetch it and extract text.
  // ─────────────────────────────────────────────────────────────────────────
  let parsedData: Awaited<ReturnType<typeof parseResumeWithLLM>>;

  try {
    console.log(`[LLM Pipeline] Extracting text from Cloudinary URL: ${req.file.path}`);
    const rawText = await extractTextFromPdf(req.file.path);

    if (!rawText || rawText.trim().length < 20) {
      res.status(422).json({
        success: false,
        message: 'Could not extract readable text from the uploaded PDF. Please ensure the file is not scanned/image-only.',
      });
      return;
    }

    console.log(`[LLM Pipeline] Extracted ${rawText.length} chars. Sending to Gemini...`);
    parsedData = await parseResumeWithLLM(rawText);
    console.log(`[LLM Pipeline] Parsed successfully. Exp: ${parsedData.experienceYears}yr`);
    console.log(`[LLM Pipeline] Extracted Skills Array:`, parsedData.skills);
  } catch (llmError) {
    // We log the full error server-side but return a safe message to the client.
    // The file is on disk but the DB is untouched — no corrupted state.
    console.error('[LLM Pipeline] FAILED:', llmError);
    res.status(500).json({
      success: false,
      message:
        'Resume was uploaded but could not be parsed by the AI service. ' +
        'Please try again or contact support.',
    });
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: Single Atomic DB Write
  // ─────────────────────────────────────────────────────────────────────────
  // We write resumeUrl, parsedSkills, AND experienceYears in one operation.
  // Using updateMany (returns { count }) avoids a preceding findUnique call,
  // eliminating the read-then-write race condition on concurrent requests.
  // ─────────────────────────────────────────────────────────────────────────
  try {
    const result = await prisma.studentProfile.updateMany({
      where: { userId },
      data: {
        resumeUrl,
        parsedSkills: parsedData.skills,
        experienceYears: parsedData.experienceYears,
        cgpa: parsedData.cgpa,
        college: parsedData.college !== "" ? parsedData.college : undefined,
      },
    });

    if (result.count === 0) {
      res.status(404).json({
        success: false,
        message: 'Student profile not found. Please complete your profile setup first.',
      });
      return;
    }
  } catch (dbError) {
    console.error('[DB Write] Student profile update failed:', dbError);
    res.status(500).json({
      success: false,
      message: 'Resume was parsed but could not be saved to the database. Please try again.',
    });
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: Success Response
  // ─────────────────────────────────────────────────────────────────────────
  res.status(200).json({
    success: true,
    message: 'Resume uploaded and parsed successfully.',
    data: {
      resumeUrl,
      parsedSkills: parsedData.skills,
      experienceYears: parsedData.experienceYears,
      projects: parsedData.projects,
      cgpa: parsedData.cgpa,
      college: parsedData.college,
    },
  });
};
