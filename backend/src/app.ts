import express from 'express';
import type { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globalRateLimiter } from './middlewares/rateLimiter.js';
import authRoutes from './routes/auth.routes.js';
import studentRoutes from './routes/student.routes.js';
import jobRoutes from './routes/job.routes.js';
import eligibilityRoutes from './routes/eligibility.routes.js';
import passport from './config/passport.js';

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app: Application = express();

// =============================================================================
// Security Middlewares
// =============================================================================
app.use(helmet());

// CORS: allow both local dev and production frontend origins
const allowedOrigins = [
  'http://localhost:5173',
  process.env['FRONTEND_URL'] ?? '',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(morgan('dev'));

// =============================================================================
// Session — Required by Passport internals even in stateless JWT mode
// =============================================================================
// The session is ephemeral (no persistent store) and used only during the OAuth
// redirect handshake. After googleCallback fires and issues a JWT, the session
// is no longer needed — all subsequent API calls are authenticated via Bearer token.
// =============================================================================
app.use(
  session({
    secret:            process.env['JWT_SECRET'] ?? 'careernest-session-secret',
    resave:            false,
    saveUninitialized: false,
    cookie: { secure: process.env['NODE_ENV'] === 'production', maxAge: 5 * 60 * 1000 }, // 5-min TTL
  }),
);

// =============================================================================
// Passport — OAuth Strategy Initialization
// =============================================================================
app.use(passport.initialize());
app.use(passport.session());

// Global rate limiter — applied before any route is processed
app.use(globalRateLimiter);

// =============================================================================
// Static File Serving — /uploads
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
