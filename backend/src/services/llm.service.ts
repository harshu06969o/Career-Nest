import { readFile } from 'node:fs/promises';
import { GoogleGenAI, Type } from '@google/genai';
import { PDFParse } from 'pdf-parse';

// =============================================================================
// Types
// =============================================================================
export interface ParsedResume {
  skills: string[];
  experienceYears: number;
  projects: string[];
}

// =============================================================================
// Token Budget
// =============================================================================
// Gemini 2.0 Flash-Lite free tier: 1M tokens/day, 1M context window.
// A typical 2-page resume is ~800 words ≈ ~1000 tokens after encoding.
// We cap at 8 000 chars (~2 000 tokens) — leaves 98%+ of the daily budget
// for other API calls and eliminates runaway cost from abnormally large PDFs.
// =============================================================================
const MAX_TEXT_CHARS = 8_000;

// =============================================================================
// extractTextFromPdf
// =============================================================================
// Uses pdf-parse v2's class-based API:
//   new PDFParse({ source: Buffer }) → instance.getText() → TextResult.document
//
// The `source` field accepts a Node.js Buffer directly.
// We call destroy() in a finally block to release internal pdfjs resources.
// =============================================================================
export async function extractTextFromPdf(filePathOrUrl: string): Promise<string> {
  let buffer: Buffer;

  if (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://')) {
    // ── Cloudinary path: fetch the PDF bytes over HTTPS ──────────────────────
    // After the Cloudinary storage migration, req.file.path is a secure CDN URL.
    // We fetch the raw bytes using Node's built-in fetch (Node 18+).
    const response = await fetch(filePathOrUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch resume from Cloudinary: ${response.status} ${response.statusText}`,
      );
    }
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    // ── Local path: read from disk (dev / legacy fallback) ───────────────────
    buffer = await readFile(filePathOrUrl);
  }

  // pdf-parse v2 class-based API:
  //   LoadParameters.data accepts Buffer/TypedArray (Buffer IS a Uint8Array subclass)
  //   getText() returns TextResult whose `.text` is the full concatenated document string
  const parser = new PDFParse({ data: buffer });
  let rawText: string;

  try {
    const result = await parser.getText();
    rawText = result.text; // TextResult.text — full document string
  } finally {
    await parser.destroy(); // Always release pdfjs worker resources
  }

  const cleaned = rawText
    .replace(/\r\n/g, '\n')         // Normalize Windows line endings
    .replace(/[ \t]{2,}/g, ' ')     // Collapse horizontal whitespace runs
    .replace(/\n{3,}/g, '\n\n')     // Collapse excessive blank lines (≥3 → 2)
    .trim();

  // Hard truncation — 8 000 chars ≈ 2 000 tokens, well within the free-tier budget.
  return cleaned.slice(0, MAX_TEXT_CHARS);
}

// =============================================================================
// Gemini Response Schema
// =============================================================================
// Using a typed responseSchema with responseMimeType: 'application/json'
// activates Gemini's "Controlled Generation" mode. The model is constrained
// at the decoding layer — it literally cannot produce tokens outside the
// schema. This is strictly more reliable than prompt-only instructions.
// =============================================================================
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'All technical and domain skills found. Normalize to lowercase (e.g. "react", "node.js", "python").',
    },
    experienceYears: {
      type: Type.NUMBER,
      description:
        'Total professional experience in decimal years (internships + full-time). Use 0.0 for freshers or students.',
    },
    projects: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Named projects only (e.g. "CareerNest", "Inventory Management System"). No generic descriptions.',
    },
  },
  required: ['skills', 'experienceYears', 'projects'],
};

// =============================================================================
// System Instruction
// =============================================================================
// Injected as a system-level prompt (not user-turn), which primes the model's
// behaviour before it sees any resume content. Being explicit about the
// "no markdown, no prose" rule at the system level is critical — models
// default to wrapping JSON in ```json fences which breaks JSON.parse().
// temperature: 0 removes all creative variance → deterministic, parseable output.
// =============================================================================
const SYSTEM_INSTRUCTION = `You are an immutable, stateless resume-to-JSON compiler. Your only function is to extract structured data from resume text.

ABSOLUTE RULES:
1. Respond with ONLY a single valid JSON object. Zero markdown, zero code fences, zero prose.
2. skills: extract every technical skill, framework, language, and tool. Normalize all to lowercase.
3. experienceYears: convert all work/internship durations to a decimal float. Use 0 if the person is a student with no work experience.
4. projects: list only named project titles. Omit generic descriptions.
5. If a field cannot be determined, return its empty default ([] for arrays, 0.0 for numbers).
6. Never hallucinate skills or experience that are not present in the text.`;

// =============================================================================
// parseResumeWithLLM
// =============================================================================
// Core LLM call. Initializes a fresh GoogleGenAI client per invocation to
// avoid shared state between requests. Validates the parsed structure as a
// belt-and-suspenders check even though controlled generation enforces it —
// any schema drift from an SDK update will surface here, not in the DB write.
// =============================================================================
export async function parseResumeWithLLM(rawText: string): Promise<ParsedResume> {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Set it in your .env file.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Extract structured data from this resume:\n\n${rawText}`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',  // Activates Controlled Generation
      responseSchema: RESPONSE_SCHEMA,       // Schema-constrained decoding
      temperature: 0,       // Deterministic — no creative variance in JSON output
      maxOutputTokens: 512, // Our schema is tiny; 512 tokens is a generous ceiling
    },
  });

  // response.text is a getter on the first candidate's first text part
  const rawJson = response.text;
  if (!rawJson) {
    throw new Error('Gemini returned an empty response. The prompt may have been blocked by safety filters.');
  }

  // Parse defensively — even with controlled generation, we validate the shape
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error(`LLM response is not valid JSON. Raw response: "${rawJson.slice(0, 300)}"`);
  }

  // Runtime type guard: ensures schema contract is honoured before any DB write
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as ParsedResume).skills) ||
    typeof (parsed as ParsedResume).experienceYears !== 'number' ||
    !Array.isArray((parsed as ParsedResume).projects)
  ) {
    throw new Error(
      `LLM response did not match expected schema. Aborting DB update. Got: ${JSON.stringify(parsed)}`,
    );
  }

  const result = parsed as ParsedResume;

  // Normalize skills to lowercase — the matching engine performs
  // case-sensitive set intersection, so "React" ≠ "react" without this.
  result.skills = result.skills.map((s) => s.toLowerCase().trim());

  return result;
}

// =============================================================================
// ParsedJobDescription — Job LLM Output Contract
// =============================================================================
export interface ParsedJobDescription {
  requiredSkills: string[];
  minCgpa: number;
  minExperience: number;
}

// =============================================================================
// Job Description Response Schema
// =============================================================================
// Smaller schema than resume = fewer output tokens = more free-tier headroom.
// maxOutputTokens: 256 is deliberately tight — the schema never needs more.
// =============================================================================
const JOB_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    requiredSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'All technical skills, frameworks, and tools required. Normalize to lowercase.',
    },
    minCgpa: {
      type: Type.NUMBER,
      description: 'Minimum CGPA on a 10-point scale. Convert 4.0-scale GPAs proportionally. Use 0.0 if not mentioned.',
    },
    minExperience: {
      type: Type.NUMBER,
      description: 'Minimum years of professional experience as a decimal. Use 0.0 for freshers or internship roles.',
    },
  },
  required: ['requiredSkills', 'minCgpa', 'minExperience'],
};

const JOB_SYSTEM_INSTRUCTION = `You are an immutable, stateless job-description-to-JSON compiler. Extract hiring requirements from job posting text.

ABSOLUTE RULES:
1. Respond with ONLY a single valid JSON object. Zero markdown, zero code fences, zero prose.
2. requiredSkills: extract all technical skills, tools, languages, and frameworks. Normalize ALL to lowercase.
3. minCgpa: extract minimum GPA on a 10-point scale. Convert 4.0-scale values proportionally (3.5/4.0 → 8.75/10). Use 0.0 if not stated.
4. minExperience: extract minimum years of experience as a decimal float. Use 0.0 for freshers or internship roles.
5. If a field cannot be determined, use its zero default ([] or 0.0).
6. Never hallucinate requirements not present in the job description.`;

// =============================================================================
// parseJobDescription
// =============================================================================
// Called ONCE at job creation time. The LLM result is immediately persisted to
// MongoDB AND cached in Redis, so this call is never repeated for the same
// job — achieving true zero-token-waste for all subsequent read requests.
// =============================================================================
export async function parseJobDescription(rawDescription: string): Promise<ParsedJobDescription> {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Set it in your .env file.');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Same whitespace normalization as the resume pipeline.
  // Job descriptions are shorter — 4 000 char cap is still generous.
  const cleaned = rawDescription
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 4_000);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Extract structured hiring requirements from this job description:\n\n${cleaned}`,
    config: {
      systemInstruction: JOB_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: JOB_RESPONSE_SCHEMA,
      temperature: 0,
      maxOutputTokens: 256, // Schema is tiny — strict ceiling to prevent verbose output
    },
  });

  const rawJson = response.text;
  if (!rawJson) {
    throw new Error('Gemini returned an empty response for the job description.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error(`LLM job response is not valid JSON. Raw: "${rawJson.slice(0, 200)}"`);
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as ParsedJobDescription).requiredSkills) ||
    typeof (parsed as ParsedJobDescription).minCgpa !== 'number' ||
    typeof (parsed as ParsedJobDescription).minExperience !== 'number'
  ) {
    throw new Error(`Job LLM response schema mismatch. Got: ${JSON.stringify(parsed)}`);
  }

  const result = parsed as ParsedJobDescription;

  // Normalize skills to lowercase for consistent matching engine behaviour
  result.requiredSkills = result.requiredSkills.map((s) => s.toLowerCase().trim());

  return result;
}
