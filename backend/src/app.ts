import express from 'express';
import type { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globalRateLimiter } from './middlewares/rateLimiter.js';
import authRoutes from './routes/auth.routes.js';
import studentRoutes from './routes/student.routes.js';
import jobRoutes from './routes/job.routes.js';
import eligibilityRoutes from './routes/eligibility.routes.js';

// ESM-safe __dirname: resolves correctly in both dev (ts-node-dev) and
// production (dist/) because it's derived from the current file's URL,
// not a compile-time constant.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app: Application = express();

// =============================================================================
// Security Middlewares
// =============================================================================
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Global rate limiter — applied before any route is processed
app.use(globalRateLimiter);

// =============================================================================
// Static File Serving — /uploads
// =============================================================================
// Serves backend/uploads/ under the /uploads URL prefix.
// Example: GET /uploads/resumes/3f5a1b2c.pdf → backend/uploads/resumes/3f5a1b2c.pdf
//
// Path resolution:
//   Dev  (src/app.ts)  : __dirname = backend/src  → ../uploads = backend/uploads ✓
//   Prod (dist/app.js) : __dirname = backend/dist → ../uploads = backend/uploads ✓
//
// Security note: helmet() is applied BEFORE this, which sets restrictive headers
// (X-Content-Type-Options: nosniff) to prevent MIME-sniffing attacks on served files.
// =============================================================================
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// =============================================================================
// Health Check
// =============================================================================
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'API is healthy' });
});

// =============================================================================
// API Routes
// =============================================================================
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/eligibility', eligibilityRoutes);

export default app;
