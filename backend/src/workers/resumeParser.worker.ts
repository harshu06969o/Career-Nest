// src/workers/resumeParser.worker.ts
// BullMQ Worker — runs in the SAME Node process as the server but executes
// asynchronously via the Redis queue. The HTTP response for /upload-resume
// returns BEFORE this worker does any work.
//
// Job payload: { resumeUrl: string, userId: string }
// On success:  emits "resume:parsed"  via Socket.io to the user
// On failure:  emits "resume:parse-failed" via Socket.io to the user

import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import prisma from '../config/prismaClient.js';
import { extractTextFromPdf, parseResumeWithLLM } from '../services/llm.service.js';
import { emitToUser } from '../config/socketServer.js';

dotenv.config();

const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

export interface ResumeParseJobData {
  resumeUrl: string;
  userId:    string;
}

// ── Processor function ────────────────────────────────────────────────────────
async function processResumeJob(job: Job<ResumeParseJobData>): Promise<void> {
  const { resumeUrl, userId } = job.data;
  console.log(`[Worker] Processing job ${job.id} for user ${userId}`);

  // Phase 1 — Extract text from Cloudinary PDF
  await job.updateProgress(10);
  let rawText: string;
  try {
    rawText = await extractTextFromPdf(resumeUrl);
  } catch (err) {
    console.error(`[Worker] PDF extraction failed for job ${job.id}:`, err);
    emitToUser(userId, 'resume:parse-failed', {
      message: 'Could not extract text from your PDF. Please ensure it is not a scanned image.',
    });
    throw err; // lets BullMQ retry
  }

  if (!rawText || rawText.trim().length < 20) {
    const msg = 'Resume PDF appears to be empty or image-only. Please upload a text-based PDF.';
    emitToUser(userId, 'resume:parse-failed', { message: msg });
    throw new Error(msg); // mark job as failed — no point retrying
  }

  // Phase 2 — Gemini LLM parsing
  await job.updateProgress(40);
  let parsedData: Awaited<ReturnType<typeof parseResumeWithLLM>>;
  try {
    parsedData = await parseResumeWithLLM(rawText);
    console.log(`[Worker] Job ${job.id} — parsed ${parsedData.skills.length} skills`);
  } catch (err) {
    console.error(`[Worker] Gemini parse failed for job ${job.id}:`, err);
    emitToUser(userId, 'resume:parse-failed', {
      message: 'AI parsing failed. Please try again in a moment.',
    });
    throw err; // retry
  }

  // Phase 3 — Persist to database
  await job.updateProgress(80);
  try {
    await prisma.studentProfile.upsert({
      where:  { userId },
      update: {
        resumeUrl,
        parsedSkills:    parsedData.skills,
        experienceYears: parsedData.experienceYears,
        cgpa:            parsedData.cgpa,
        ...(parsedData.college !== '' && { college: parsedData.college }),
      },
      create: {
        userId,
        firstName:       '',
        lastName:        '',
        college:         parsedData.college !== '' ? parsedData.college : 'Unknown College',
        resumeUrl,
        parsedSkills:    parsedData.skills,
        experienceYears: parsedData.experienceYears,
        cgpa:            parsedData.cgpa,
      },
    });
  } catch (err) {
    console.error(`[Worker] DB write failed for job ${job.id}:`, err);
    emitToUser(userId, 'resume:parse-failed', {
      message: 'Resume was parsed but could not be saved. Please try again.',
    });
    throw err;
  }

  // Phase 4 — Notify client via WebSocket
  await job.updateProgress(100);
  emitToUser(userId, 'resume:parsed', {
    resumeUrl,
    parsedSkills:    parsedData.skills,
    experienceYears: parsedData.experienceYears,
    cgpa:            parsedData.cgpa,
    college:         parsedData.college,
    projects:        parsedData.projects,
    skillCount:      parsedData.skills.length,
  });

  console.log(`[Worker] Job ${job.id} completed — notified user ${userId}`);
}

// ── Worker instance ───────────────────────────────────────────────────────────
export function createResumeWorker(): Worker<ResumeParseJobData> {
  const worker = new Worker<ResumeParseJobData>(
    'resume-parse',
    processResumeJob,
    {
      connection:  new Redis(redisUrl, { maxRetriesPerRequest: null }),
      concurrency: 5, // process up to 5 resumes in parallel
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] ✅ Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] ❌ Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
  });

  worker.on('progress', (job, progress) => {
    console.log(`[Worker] Job ${job.id} progress: ${progress}%`);
  });

  console.log('[Worker] Resume parser worker started — concurrency: 5');
  return worker;
}
