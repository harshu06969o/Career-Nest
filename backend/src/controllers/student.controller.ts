import type { Request, Response } from 'express';
import prisma from '../config/prismaClient.js';
import { extractTextFromPdf, parseResumeWithLLM } from '../services/llm.service.js';

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
    console.log(`[LLM Pipeline] Extracting text from: ${req.file.path}`);
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
    console.log(`[LLM Pipeline] Parsed successfully. Skills: ${parsedData.skills.length}, Exp: ${parsedData.experienceYears}yr`);
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
    },
  });
};
