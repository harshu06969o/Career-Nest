import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import prisma from '../config/prismaClient.js';

// =============================================================================
// Constants
// =============================================================================
const SALT_ROUNDS = 12; // bcrypt work factor — 12 is the production sweet spot
                        // (slow enough to resist brute-force, fast enough for UX)

/**
 * Registers a new user and provisions their role-specific profile.
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  const {
    email,
    password,
    role,
    adminSecret,
    firstName,
    lastName,
    college,
    cgpa,
    companyName,
    designation,
  } = req.body as {
    email?: string;
    password?: string;
    role?: string;
    adminSecret?: string;
    firstName?: string;
    lastName?: string;
    college?: string;
    cgpa?: number;
    companyName?: string;
    designation?: string;
  };

  if (!email || !password || !role) {
    res.status(400).json({ success: false, message: 'email, password, and role are required.' });
    return;
  }

  const allowedRoles: Role[] = ['STUDENT', 'RECRUITER', 'ADMIN'];
  if (!allowedRoles.includes(role as Role)) {
    res.status(400).json({ success: false, message: `role must be one of: ${allowedRoles.join(', ')}.` });
    return;
  }

  if (role === 'ADMIN') {
    if (!adminSecret || adminSecret !== process.env['ADMIN_SECRET']) {
      res.status(403).json({ success: false, message: 'Forbidden: Invalid Admin Secret.' });
      return;
    }
  }

  try {
    const cleanEmail = email.trim();
    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: cleanEmail,
          mode: 'insensitive',
        },
      },
    });
    
    if (existingUser) {
      res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        role: role as Role,
      },
    });

    try {
      if (role === 'STUDENT') {
        const parsedCgpa = parseFloat(String(cgpa ?? ''));
        const safeCgpa   = (!isNaN(parsedCgpa) && parsedCgpa >= 0 && parsedCgpa <= 10)
          ? parsedCgpa
          : 0;

        await prisma.studentProfile.create({
          data: {
            userId:          user.id,
            firstName:       typeof firstName === 'string' ? firstName.trim() : '',
            lastName:        typeof lastName  === 'string' ? lastName.trim()  : '',
            college:         typeof college   === 'string' ? college.trim()   : '',
            parsedSkills:    [],
            cgpa:            safeCgpa,
            experienceYears: 0,
          },
        });
      } else if (role === 'RECRUITER') {
        await prisma.recruiterProfile.create({
          data: {
            userId:      user.id,
            companyName: typeof companyName === 'string' ? companyName.trim() : '',
            designation: typeof designation  === 'string' ? designation.trim()  : '',
          },
        });
      }
    } catch (profileError) {
      await prisma.user.delete({ where: { id: user.id } });
      console.error('Profile creation failed, user rolled back:', profileError);
      res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
      return;
    }

    res.status(201).json({
      success: true,
      message: 'Account created successfully. Please complete your profile.',
      data: { userId: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'An unexpected error occurred during registration.' });
  }
};

/**
 * Authenticates a user via email/password and issues a JWT.
 * Uses constant-time dummy hash comparisons to prevent timing-based email enumeration.
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ success: false, message: 'email and password are required.' });
    return;
  }

  try {
    const cleanEmail = email.trim();
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: cleanEmail,
          mode: 'insensitive',
        },
      },
    });

    const dummyHash = '$2a$12$invalidhashfortimingnormalization0000000000000000000000';
    const isPasswordValid = await bcrypt.compare(
      password,
      user?.passwordHash ?? dummyHash,
    );

    if (!user || !isPasswordValid) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    const secret = process.env['JWT_SECRET'];
    if (!secret) {
      console.error('FATAL: JWT_SECRET is not set in environment variables.');
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      secret,
      { expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d' } as jwt.SignOptions,
    );

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: { userId: user.id, email: user.email, role: user.role },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'An unexpected error occurred during login.' });
  }
};

// =============================================================================
// Google OAuth — Callback Handler
// =============================================================================
// Called by Passport after Google redirects back to /api/auth/google/callback.
// At this point req.user is populated by the Passport strategy (config/passport.ts).
// We sign our own JWT and redirect the browser to the frontend with it as a URL param.
// =============================================================================
export const googleCallback = (req: Request, res: Response): void => {
  const oauthUser = req.user as {
    userId: string;
    email:  string;
    role:   Role;
    isNew:  boolean;
  } | undefined;

  if (!oauthUser) {
    res.redirect(`${process.env['FRONTEND_URL']}/auth?error=oauth_failed`);
    return;
  }

  const secret = process.env['JWT_SECRET']!;
  const token  = jwt.sign(
    { userId: oauthUser.userId, role: oauthUser.role },
    secret,
    { expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d' } as jwt.SignOptions,
  );

  const params = new URLSearchParams({
    token,
    userId: oauthUser.userId,
    email:  oauthUser.email,
    role:   oauthUser.role,
  });

  if (oauthUser.isNew) {
    // Brand-new user → send to role selection setup page
    res.redirect(`${process.env['FRONTEND_URL']}/auth/setup?${params.toString()}`);
  } else {
    // Existing user → pass JWT to frontend and land on dashboard
    res.redirect(`${process.env['FRONTEND_URL']}/auth/callback?${params.toString()}`);
  }
};

// =============================================================================
// Google OAuth — Setup Role (POST /api/auth/setup-role)
// =============================================================================
// Called from /auth/setup page for brand-new OAuth users.
// They choose their role, fill their profile, and we issue a fresh JWT.
// =============================================================================
export const setupOAuthRole = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { role, firstName, lastName, college, cgpa, companyName, designation } = req.body as {
    role?: string;
    firstName?: string;
    lastName?: string;
    college?: string;
    cgpa?: number;
    companyName?: string;
    designation?: string;
  };

  if (role !== 'STUDENT' && role !== 'RECRUITER') {
    res.status(400).json({ success: false, message: 'role must be STUDENT or RECRUITER.' });
    return;
  }

  try {
    // Update the user's permanent role in DB
    const user = await prisma.user.update({
      where: { id: userId },
      data:  { role: role as Role },
    });

    if (role === 'STUDENT') {
      const parsedCgpa = parseFloat(String(cgpa ?? ''));
      const safeCgpa   = (!isNaN(parsedCgpa) && parsedCgpa >= 0 && parsedCgpa <= 10) ? parsedCgpa : 0;

      await prisma.studentProfile.upsert({
        where:  { userId },
        update: {
          firstName: firstName?.trim() ?? '',
          lastName:  lastName?.trim()  ?? '',
          college:   college?.trim()   ?? '',
          cgpa:      safeCgpa,
        },
        create: {
          userId,
          firstName:       firstName?.trim() ?? '',
          lastName:        lastName?.trim()  ?? '',
          college:         college?.trim()   ?? '',
          parsedSkills:    [],
          cgpa:            safeCgpa,
          experienceYears: 0,
        },
      });
    } else {
      await prisma.recruiterProfile.upsert({
        where:  { userId },
        update: { companyName: companyName?.trim() ?? '', designation: designation?.trim() ?? '' },
        create: { userId, companyName: companyName?.trim() ?? '', designation: designation?.trim() ?? '' },
      });
    }

    // Issue a fresh JWT with the definitive role
    const secret = process.env['JWT_SECRET']!;
    const token  = jwt.sign(
      { userId: user.id, role: user.role },
      secret,
      { expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d' } as jwt.SignOptions,
    );

    res.status(200).json({
      success: true,
      message: 'Profile setup complete.',
      data: { token, user: { userId: user.id, email: user.email, role: user.role } },
    });
  } catch (error) {
    console.error('OAuth setup error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete profile setup.' });
  }
};
