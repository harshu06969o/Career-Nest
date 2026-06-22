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

// =============================================================================
// REGISTER
// =============================================================================
// Strategy: Create User first, then create the role-specific profile.
// If profile creation fails, we manually delete the User (manual rollback).
//
// Why not prisma.$transaction()? MongoDB transactions require a REPLICA SET.
// This works natively on Atlas (cloud), but fails on a local standalone
// mongod instance. The manual rollback approach works in BOTH environments.
//
// For strict atomicity on Atlas in production, swap to:
//   prisma.$transaction(async (tx) => { ... })
// =============================================================================
export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, role, adminSecret } = req.body as {
    email?: string;
    password?: string;
    role?: string;
    adminSecret?: string;
  };

  // --- Input Validation ---
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
    // --- Check for Existing User ---
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      return;
    }

    // --- Hash Password ---
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // --- Create User ---
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: role as Role,
      },
    });

    // --- Create Role-Specific Profile (with manual rollback on failure) ---
    try {
      if (role === 'STUDENT') {
        await prisma.studentProfile.create({
          data: {
            userId: user.id,
            firstName: '',
            lastName: '',
            college: '',
            parsedSkills: [],
            cgpa: 0,
            experienceYears: 0,
          },
        });
      } else if (role === 'RECRUITER') {
        await prisma.recruiterProfile.create({
          data: {
            userId: user.id,
            companyName: '',
            designation: '',
          },
        });
      }
    } catch (profileError) {
      // Rollback: remove the orphaned User record
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

// =============================================================================
// LOGIN
// =============================================================================
// Returns a signed JWT on success. The token payload is intentionally minimal —
// only userId and role — to avoid storing sensitive data in a decodable token.
// =============================================================================
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ success: false, message: 'email and password are required.' });
    return;
  }

  try {
    // --- Find User ---
    const user = await prisma.user.findUnique({ where: { email } });

    // Use a constant-time comparison check — always run bcrypt.compare even if
    // user doesn't exist (prevents timing-based user enumeration attacks)
    const dummyHash = '$2a$12$invalidhashfortimingnormalization0000000000000000000000';
    const isPasswordValid = await bcrypt.compare(
      password,
      user?.passwordHash ?? dummyHash,
    );

    if (!user || !isPasswordValid) {
      // Single generic message — never reveal whether the email or password was wrong
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    // --- Sign JWT ---
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
