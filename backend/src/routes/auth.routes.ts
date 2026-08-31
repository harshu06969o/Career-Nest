import { Router } from 'express';
import passport from 'passport';
import { register, login, googleCallback, setupOAuthRole } from '../controllers/auth.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

// ── Email / Password ─────────────────────────────────────────────────────────
// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// ── Google OAuth 2.0 ─────────────────────────────────────────────────────────

// Step 1 — Initiate: browser navigates here, Passport redirects to Google
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false }),
);

// Step 2 — Callback: Google redirects here after user grants consent
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth?error=oauth_failed' }),
  googleCallback,
);

// ── OAuth Role Setup ──────────────────────────────────────────────────────────
// POST /api/auth/setup-role
// Called from /auth/setup page for brand-new OAuth users who need to choose a role
router.post('/setup-role', verifyToken, setupOAuthRole);

export default router;
