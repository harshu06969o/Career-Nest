import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from './prismaClient.js';

// =============================================================================
// Passport Google OAuth 2.0 Strategy
// =============================================================================
// Flow:
//   1. User clicks "Continue with Google" → browser hits GET /api/auth/google
//   2. Passport redirects to Google consent screen
//   3. Google redirects to /api/auth/google/callback with a `code`
//   4. Passport exchanges `code` for profile; this `verify` callback fires
//   5. We find-or-create the user in MongoDB
//   6. The auth.controller googleCallback then issues a JWT and redirects
// =============================================================================

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env['GOOGLE_CLIENT_ID']!,
      clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
      // This must exactly match one of the Authorized redirect URIs in Google Cloud Console
      callbackURL:  `${process.env['BACKEND_URL']}/api/auth/google/callback`,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email    = profile.emails?.[0]?.value;

        if (!email) {
          return done(new Error('No email returned from Google profile'), undefined);
        }

        // ── Step 1: Look up by googleId (returning OAuth users) ──────────────
        let user = await prisma.user.findFirst({ where: { googleId } });

        if (user) {
          // Returning Google user — pass through
          return done(null, { userId: user.id, email: user.email, role: user.role, isNew: false });
        }

        // ── Step 2: Look up by email (account linking) ────────────────────────
        // If the user previously registered with email/password using the same
        // email, we link the accounts by stamping their googleId.
        user = await prisma.user.findFirst({
          where: {
            email: { equals: email, mode: 'insensitive' },
          },
        });

        if (user) {
          // Link the Google account to the existing email/password account
          user = await prisma.user.update({
            where: { id: user.id },
            data:  { googleId },
          });
          return done(null, { userId: user.id, email: user.email, role: user.role, isNew: false });
        }

        // ── Step 3: Brand-new user — create User record only ─────────────────
        // We do NOT create a StudentProfile/RecruiterProfile here because we
        // don't know their role yet. The frontend's /auth/setup page handles that.
        const newUser = await prisma.user.create({
          data: {
            email:        email.toLowerCase().trim(),
            googleId,
            passwordHash: null, // OAuth users have no password
            role:         'STUDENT', // temporary default — overwritten at /auth/setup
          },
        });

        return done(null, {
          userId: newUser.id,
          email:  newUser.email,
          role:   newUser.role,
          isNew:  true, // Signals frontend to redirect to /auth/setup
        });
      } catch (err) {
        return done(err as Error, undefined);
      }
    },
  ),
);

// We use stateless JWT — no need for serialize/deserialize.
// These stubs satisfy Passport's internal requirements.
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user as Express.User));

export default passport;
