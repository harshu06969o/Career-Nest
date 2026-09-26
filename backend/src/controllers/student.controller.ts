import type { Request, Response } from 'express';
import prisma from '../config/prismaClient.js';
import { resumeQueue } from '../config/bullmq.js';

/**
 * Retrieves the profile of the currently authenticated student.
 *
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 * 
 * @architecture
 * Data Isolation: Strictly scopes the database query to `req.user.userId`. A student 
 * can only ever fetch their own profile, completely eliminating cross-user data leakage.
 */
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

/**
 * Updates the basic profile information for the authenticated student.
 *
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 */
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
    await prisma.studentProfile.upsert({
      where: { userId },
      update: {
        ...(firstName !== undefined && { firstName: firstName.trim() }),
        ...(lastName  !== undefined && { lastName:  lastName.trim()  }),
        ...(college   !== undefined && { college:   college.trim()   }),
        ...(cgpaFloat !== undefined && { cgpa:      cgpaFloat        }),
        ...(expFloat  !== undefined && { experienceYears: expFloat   }),
      },
      create: {
        userId,
        firstName: firstName !== undefined ? firstName.trim() : '',
        lastName:  lastName !== undefined ? lastName.trim() : '',
        college:   college !== undefined ? college.trim() : 'Unknown College',
        cgpa:      cgpaFloat !== undefined ? cgpaFloat : 0,
        experienceYears: expFloat !== undefined ? expFloat : 0,
        parsedSkills: [],
      }
    });

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

/**
 * Handles the PDF resume upload asynchronously.
 *
 * @architecture — Async Pipeline (BullMQ + WebSocket)
 * 1. Cloudinary upload is already done by the multer middleware before this runs.
 * 2. This handler enqueues a BullMQ job with { resumeUrl, userId } and returns
 *    HTTP 202 Accepted immediately — the client gets a response in < 200ms.
 * 3. The background worker (resumeParser.worker.ts) does the heavy lifting:
 *    PDF extraction → Gemini LLM parsing → DB upsert.
 * 4. When the worker finishes, it emits 'resume:parsed' (or 'resume:parse-failed')
 *    via Socket.io directly to the authenticated user's socket(s).
 * 5. The frontend listens for these events and updates the UI without polling.
 */
export const uploadResume = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  if (!req.file) {
    res.status(400).json({
      success: false,
      message: 'No file received. Attach a PDF using the form field name "resume".',
    });
    return;
  }

  const { userId } = req.user;

  // multer-storage-cloudinary v4 populates req.file.path with the secure_url.
  // However, for resource_type:'raw', some versions use req.file.secure_url.
  // We try both and prefer the HTTPS URL to guarantee it is fetchable.
  const fileInfo = req.file as Express.Multer.File & { secure_url?: string; path?: string };
  const resumeUrl = fileInfo.secure_url ?? fileInfo.path ?? '';

  if (!resumeUrl || !resumeUrl.startsWith('http')) {
    console.error('[Upload] Could not resolve a valid Cloudinary URL from req.file');
    res.status(500).json({ success: false, message: 'Upload succeeded but could not get file URL. Please try again.' });
    return;
  }

  // Persist the raw resumeUrl immediately so the student can see it in their
  // profile while the AI is still analysing in the background.
  try {
    await prisma.studentProfile.upsert({
      where:  { userId },
      update: { resumeUrl },
      create: {
        userId,
        firstName:       '',
        lastName:        '',
        college:         'Unknown College',
        resumeUrl,
        parsedSkills:    [],
        experienceYears: 0,
        cgpa:            0,
      },
    });
  } catch (dbError) {
    console.error('[DB Write] Could not persist resumeUrl:', dbError);
    // Non-fatal — the worker will upsert the full record anyway
  }

  // Enqueue the heavy work — returns immediately
  const job = await resumeQueue.add(
    'parse-resume',
    { resumeUrl, userId },
    { jobId: `resume-${userId}-${Date.now()}` }
  );

  console.log(`[Upload] Job ${job.id} enqueued for user ${userId}`);

  // 202 Accepted — processing is happening asynchronously
  res.status(202).json({
    success: true,
    message: 'Resume uploaded! AI is analysing your skills in the background.',
    data: {
      jobId:     job.id,
      resumeUrl,
      // Skills will arrive via WebSocket event 'resume:parsed'
    },
  });
};

/**
 * Retrieves the recruiter profile associated with the authenticated user context.
 *
 * @param {Request} req - Express request object containing verified JWT user context.
 * @param {Response} res - Express response object.
 *
 * @throws 401 Unauthorized if request context lacks verified JWT token.
 * @throws 404 Not Found if recruiter profile record has not been provisioned.
 * @throws 500 Internal Server Error on database connection or query failure.
 */
export const getRecruiterProfile = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { userId } = req.user;

  try {
    const profile = await prisma.recruiterProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        companyName: true,
        designation: true,
      },
    });

    if (!profile) {
      res.status(404).json({ success: false, message: 'Recruiter profile not found.' });
      return;
    }

    res.status(200).json({ success: true, data: profile });
  } catch (dbError) {
    console.error('[DB] recruiterProfile.findUnique failed:', dbError);
    res.status(500).json({ success: false, message: 'Failed to retrieve recruiter profile.' });
  }
};

/**
 * Updates organizational metadata (company name, designation) for the authenticated recruiter.
 *
 * @param {Request} req - Express request containing sanitized partial updates in req.body.
 * @param {Response} res - Express response returning the mutated entity.
 *
 * @complexity Time: O(1) indexed lookup on unique foreign key `userId`. Space: O(1).
 */
export const updateRecruiterProfile = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { userId } = req.user;
  const { companyName, designation } = req.body as {
    companyName?: string;
    designation?: string;
  };

  try {
    const result = await prisma.recruiterProfile.updateMany({
      where: { userId },
      data: {
        ...(companyName !== undefined && { companyName: companyName.trim() }),
        ...(designation !== undefined && { designation: designation.trim() }),
      },
    });

    if (result.count === 0) {
      res.status(404).json({ success: false, message: 'Recruiter profile not found.' });
      return;
    }

    const updated = await prisma.recruiterProfile.findUnique({
      where: { userId },
      select: { id: true, companyName: true, designation: true },
    });

    res.status(200).json({ success: true, message: 'Profile updated successfully.', data: updated });
  } catch (dbError) {
    console.error('[DB] recruiterProfile.updateMany failed:', dbError);
    res.status(500).json({ success: false, message: 'Failed to update recruiter profile.' });
  }
};
