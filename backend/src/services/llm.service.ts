import { readFile } from 'node:fs/promises';
import { GoogleGenAI, Type } from '@google/genai';
// =============================================================================
// BUG FIX (Bug 4) — PDF Parse Import
// =============================================================================
// pdf-parse@2.x ESM build exports `PDFParse` as a NAMED CLASS export (not a
// default function like v1). The original code had the class name right but
// used a wrong property name: `{ source: Buffer }` instead of `{ data: Buffer }`.
//
// Verified API (from node_modules/pdf-parse/dist/pdf-parse/esm/PDFParse.js):
//   constructor({ data: Buffer, verbosity? }) — converts Buffer to Uint8Array
//   async getText(params?) → TextResult with { text: string, total: number, pages: [] }
//   async destroy() → releases pdfjs worker
//
// The old code called `new PDFParse({ source: buffer })` which left `data`
// undefined — pdfjs would fail with an internal error, which the controller's
// catch silently swallowed, causing ALL resume uploads to return zero skills.
// =============================================================================
import { PDFParse } from 'pdf-parse';

// =============================================================================
// Types
// =============================================================================
export interface ParsedResume {
  skills: string[];
  experienceYears: number;
  projects: string[];
  cgpa: number;
  college: string;
}

// =============================================================================
// Token Budget
// =============================================================================
// Gemini 1.5 Flash free tier: 1 500 requests/day, 1M tokens/day.
// A typical 2-page resume is ~800 words ≈ ~1000 tokens after encoding.
// We cap at 8 000 chars (~2 000 tokens) — leaves 98%+ of the daily budget
// for other API calls and eliminates runaway cost from abnormally large PDFs.
// =============================================================================
const MAX_TEXT_CHARS = 8_000;

/**
 * Extracts raw text from a given PDF buffer or secure URL.
 *
 * @param {string} filePathOrUrl - The secure CDN URL or local path to the PDF.
 * @returns {Promise<string>} A cleaned and aggressively truncated text string.
 *
 * @architecture
 * Buffer Conversion: Utilizes `pdf-parse@2.x` API natively supporting Buffer injection 
 * to bypass disk I/O completely for cloud-hosted files. The text is hard-truncated to 
 * 8,000 characters (~2,000 tokens) to guarantee the payload remains well within the Gemini 
 * free-tier budget while dropping irrelevant verbose sections.
 */
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

  // BUG FIX (Bug 4): Use `data` not `source` — this is the verified constructor
  // parameter name from the pdf-parse@2.x source. The library converts Buffer
  // to Uint8Array internally (Buffer IS a Uint8Array subclass in Node 18+).
  const parser = new PDFParse({ data: buffer });
  let rawText: string;

  try {
    // getText() returns TextResult: { text: string, total: number, pages: [...] }
    // result.text is the full concatenated document string across all pages.
    const result = await parser.getText();
    rawText = result.text;

    // Log extracted length for debugging — helps diagnose scanned/image-only PDFs
    console.log(`[PDFParse] Extracted ${rawText.length} chars from ${result.total} pages`);
  } finally {
    // Always release pdfjs worker resources, even if getText() throws.
    await parser.destroy();
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
      // BUG FIX (Bug 4): Expanded description to demand EXHAUSTIVE extraction.
      // The more specific the enum examples, the better gemini-1.5-flash extracts.
      description:
        'EXHAUSTIVE list of every technical skill. Include: programming languages ' +
        '(Python, Java, C++, JavaScript, TypeScript, Go, Rust, Swift, Kotlin, etc.), ' +
        'frameworks (React, Angular, Vue, Django, Flask, Spring, Express, FastAPI, etc.), ' +
        'libraries (NumPy, Pandas, TensorFlow, PyTorch, Scikit-learn, etc.), ' +
        'databases (MySQL, PostgreSQL, MongoDB, Redis, Cassandra, Firebase, etc.), ' +
        'cloud (AWS, GCP, Azure, Heroku, Vercel, Netlify, etc.), ' +
        'DevOps (Docker, Kubernetes, GitHub Actions, Jenkins, Terraform, etc.), ' +
        'and ALL other tools or technologies mentioned. Normalize ALL to lowercase.',
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
    cgpa: {
      type: Type.NUMBER,
      description: 'The CGPA or Cumulative GPA out of 10. Might be written as "CG", "Cumulative GPA" etc. If it is out of 4, convert proportionally to 10. Default to 0.0 if not found.',
    },
    college: {
      type: Type.STRING,
      description: 'The name of the university, college, or institute attended. Default to empty string if not found.',
    },
  },
  required: ['skills', 'experienceYears', 'projects', 'cgpa', 'college'],
};

// =============================================================================
// System Instruction — Resume Parser
// =============================================================================
// Injected as system-level prompt (not user-turn). Being explicit about
// "no markdown, no prose" at system level is critical — models default to
// wrapping JSON in ```json fences which breaks JSON.parse().
// temperature: 0 → deterministic, parseable output.
// =============================================================================
const SYSTEM_INSTRUCTION = `You are an immutable, stateless resume-to-JSON compiler. Your only function is to extract structured data from resume text.

ABSOLUTE RULES:
1. Respond with ONLY a single valid JSON object. Zero markdown, zero code fences, zero prose. DO NOT output conversational text like "Here is the JSON requested".
2. skills: extract an EXHAUSTIVE array of EVERY programming language, framework, library, database, cloud platform, DevOps tool, and any technical keyword mentioned ANYWHERE in the text. Do NOT omit any. Normalize ALL to lowercase. Examples: "react", "node.js", "python", "tensorflow", "docker", "aws", "mongodb", "typescript".
3. experienceYears: convert all work/internship durations to a decimal float. Use 0.0 for students with no work experience.
4. projects: list only named project titles. Omit generic descriptions.
5. cgpa: extract CGPA or Cumulative GPA on a 10-point scale. Convert 4-point scales to 10-point proportionally.
6. college: extract the name of the most recent university or college.
7. If a field cannot be determined, return its empty default ([] for arrays, 0.0 for numbers, "" for strings).
8. Never hallucinate skills or experience that are not present in the text.
9. ACRONYM EXPANSION (CRITICAL): Always expand well-known tech acronyms to their full canonical lowercase form AND include the expansion in skills. Examples:
   - "DSA" → "data structures and algorithms"
   - "OOP" or "OOPS" → "object-oriented programming"
   - "OS" → "operating system"
   - "DBMS" → "database management system"
   - "CN" or "Computer Networks" → "computer networks"
   - "ML" → "machine learning"
   - "DL" → "deep learning"
   - "AI" → "artificial intelligence"
   - "NLP" → "natural language processing"
   - "CV" (in tech context) → "computer vision"
   - "CI/CD" or "CICD" → "ci cd"
   - "REST API", "RESTful", "restAPI", "REST APIs" → "rest api"
   - "GraphQL API" → "graphql"
   - "ORM" → "orm"
   - "MVC" → "mvc"
   - "JS" → "javascript"
   - "TS" → "typescript"
   - "PY" → "python"
   - "STL" → "standard template library"
   - "SDLC" → "software development lifecycle"
   - "AWS" → "aws" (keep as-is, already canonical)
   - "GCP" → "google cloud platform"
   - "k8s" or "K8s" → "kubernetes"
10. NORMALIZATION: Normalize all skill variant spellings to a single canonical lowercase form:
   - "Node.js", "NodeJS", "node js" → "node.js"
   - "ReactJS", "React.js", "React" → "react"
   - "VueJS", "Vue.js" → "vue.js"
   - "AngularJS", "Angular" → "angular"
   - "PostgreSQL", "Postgres" → "postgresql"
   - "MongoDB", "Mongo" → "mongodb"
   - "TensorFlow", "Tensorflow" → "tensorflow"
   - "PyTorch", "pytorch" → "pytorch"
   - "scikit-learn", "sklearn" → "scikit-learn"
11. CONTEXT-AWARE EXTRACTION (CRITICAL): Extract implied skills from EVERY sentence in the resume — not just the "Skills" or "Technical Skills" section. Achievement statements, project bullets, and experience descriptions ALL contain skills. Examples of what to extract:
   - "Solved 650+ DSA problems on LeetCode" → extract "data structures and algorithms"
   - "Solved 500+ problems on LeetCode/Codeforces" → extract "data structures and algorithms", "competitive programming"
   - "Built and deployed REST API endpoints" → extract "rest api"
   - "Developed RESTful web services" → extract "rest api"
   - "Implemented CRUD operations using Node.js" → extract "node.js", "rest api"
   - "Applied OOP principles in Java" → extract "object-oriented programming", "java"
   - "Optimized SQL queries reducing latency by 40%" → extract "sql"
   - "Containerized the application using Docker" → extract "docker"
   - "Deployed on AWS EC2" → extract "aws"
   - "Used Git for version control" → extract "git"
   - "Designed database schema in MongoDB" → extract "mongodb"
   - "Experience with Agile/Scrum methodology" → extract "agile", "scrum"
   - "Knowledge of DBMS concepts" → extract "database management system"
   - "Familiar with OS scheduling and memory management" → extract "operating system"
   - "Studied Computer Networks including TCP/IP" → extract "computer networks"
   RULE: If ANY part of a sentence references a skill, tool, or technology — even indirectly — extract it. Do NOT miss skills just because they appear in achievement or experience lines.`;

/**
 * Processes unstructured resume text through the Gemini LLM API to extract a structured schema.
 *
 * @param {string} rawText - Unstructured text extracted from the candidate's PDF.
 * @returns {Promise<ParsedResume>} A structured JSON object containing skills and metrics.
 *
 * @architecture
 * Schema Constraint Layer: Injects `responseSchema` and `responseMimeType: 'application/json'` 
 * to activate Gemini's "Controlled Generation". This constrains the LLM at the decoding layer 
 * to strictly emit valid JSON conforming to our Zod-equivalent interface, eliminating hallucinated 
 * formatting. We use a regex extraction fallback to strip trailing conversational prose.
 */
export async function parseResumeWithLLM(rawText: string): Promise<ParsedResume> {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Set it in your .env file.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: `Extract structured data from this resume:\n\n${rawText}`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',  // Activates Controlled Generation
      responseSchema: RESPONSE_SCHEMA,       // Schema-constrained decoding
      temperature: 0,       // Deterministic — no creative variance in JSON output
      maxOutputTokens: 1024, // Increased from 512 — EXHAUSTIVE skill lists can be long
    },
  });

  // response.text is a getter on the first candidate's first text part
  const rawJson = response.text;
  if (!rawJson) {
    throw new Error('Gemini returned an empty response. The prompt may have been blocked by safety filters.');
  }

  // Parse defensively — even with controlled generation, we validate the shape
  let cleanedJson = rawJson.trim();
  
  // Extract only the JSON object, ignoring any conversational prose like "Here is the JSON: "
  const match = cleanedJson.match(/\{[\s\S]*\}/);
  if (match) {
    cleanedJson = match[0];
  } else {
    // Fallback to strip markdown if the match somehow fails
    cleanedJson = cleanedJson.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '').trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanedJson);
  } catch {
    throw new Error(`LLM response is not valid JSON. Raw response: "${rawJson.slice(0, 300)}"`);
  }

  // Runtime type guard: ensures schema contract is honoured before any DB write
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as ParsedResume).skills) ||
    typeof (parsed as ParsedResume).experienceYears !== 'number' ||
    !Array.isArray((parsed as ParsedResume).projects) ||
    typeof (parsed as ParsedResume).cgpa !== 'number' ||
    typeof (parsed as ParsedResume).college !== 'string'
  ) {
    throw new Error(
      `LLM response did not match expected schema. Aborting DB update. Got: ${JSON.stringify(parsed)}`,
    );
  }

  const result = parsed as ParsedResume;

  // Normalize skills to lowercase — the matching engine performs
  // case-sensitive set intersection, so "React" ≠ "react" without this.
  result.skills = result.skills.map((s) => s.toLowerCase().trim()).filter((s) => s.length > 0);

  console.log(`[LLM] Extracted ${result.skills.length} skills, ${result.experienceYears}yr exp`);

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

const JOB_SYSTEM_INSTRUCTION = `You are a senior technical recruiter and a stateless job-description-to-JSON compiler. Think like a hiring manager with 10+ years of experience. Extract ALL hiring requirements — both explicit and strongly implied — from the job posting.

ABSOLUTE RULES:
1. Respond with ONLY a single valid JSON object. Zero markdown, zero code fences, zero prose. DO NOT output conversational text like "Here is the JSON requested".
2. requiredSkills: Extract ALL technical skills — explicit AND implied. Normalize ALL to lowercase canonical form. Think like a recruiter: if the JD says "Backend developer with Node.js", it implies javascript, node.js, rest api, express. If it says "Full Stack React role", it implies react, javascript, html, css, rest api. If it says "Data Science role", it implies python, machine learning, sql, pandas, numpy.
3. ACRONYM EXPANSION (CRITICAL): Expand all tech acronyms to their canonical lowercase form:
   - "DSA" → "data structures and algorithms"
   - "OOP" or "OOPS" → "object-oriented programming"
   - "REST API", "RESTful", "restAPI", "REST APIs", "Restful APIs" → "rest api"
   - "ML" → "machine learning"
   - "DL" → "deep learning"
   - "AI" → "artificial intelligence"
   - "NLP" → "natural language processing"
   - "CI/CD" or "CICD" → "ci cd"
   - "DBMS" → "database management system"
   - "OS" → "operating system"
   - "k8s" or "K8s" → "kubernetes"
   - "GCP" → "google cloud platform"
4. NORMALIZATION: Normalize all variant spellings to canonical lowercase:
   - "Node.js", "NodeJS", "node js" → "node.js"
   - "ReactJS", "React.js", "React" → "react"
   - "PostgreSQL", "Postgres" → "postgresql"
   - "MongoDB", "Mongo" → "mongodb"
5. minCgpa: extract minimum GPA on a 10-point scale. Convert 4.0-scale values proportionally (3.5/4.0 → 8.75/10). Use 0.0 if not stated.
6. minExperience: extract minimum years of experience as a decimal float. Use 0.0 for freshers or internship roles.
7. If a field cannot be determined, use its zero default ([] or 0.0).
8. Never hallucinate requirements that are NOT mentioned or strongly implied by the job description.`;

/**
 * Processes unstructured job description text to extract hiring requirements.
 *
 * @param {string} rawDescription - The plaintext job description entered by the recruiter.
 * @returns {Promise<ParsedJobDescription>} A structured JSON object of hiring criteria.
 *
 * @architecture
 * Zero-Token API Mitigation: This function executes exactly once upon job creation. The 
 * resulting JSON schema is immediately persisted to the primary database, guaranteeing that 
 * matching engines never re-invoke the LLM for identical job criteria.
 */
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
    model: 'gemini-3.1-flash-lite',
    contents: `Extract structured hiring requirements from this job description:\n\n${cleaned}`,
    config: {
      systemInstruction: JOB_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: JOB_RESPONSE_SCHEMA,
      temperature: 0,
      maxOutputTokens: 1024, // Increased to prevent incomplete JSON if the LLM adds prose before the JSON block
    },
  });

  const rawJson = response.text;
  if (!rawJson) {
    throw new Error('Gemini returned an empty response for the job description.');
  }

  let cleanedJson = rawJson.trim();
  
  // Extract only the JSON object, ignoring any conversational prose
  const match = cleanedJson.match(/\{[\s\S]*\}/);
  if (match) {
    cleanedJson = match[0];
  } else {
    cleanedJson = cleanedJson.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '').trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanedJson);
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
