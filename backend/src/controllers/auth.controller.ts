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
 *
 * @param {Request} req - Express request object containing email, password, and role.
 * @param {Response} res - Express response object.
 * 
 * @architecture
 * We manually execute a two-step creation process (User -> Profile) with a programmatic rollback
 * if the profile fails. This avoids Prisma's `$transaction` API which requires a full Replica Set
 * on MongoDB, ensuring compatibility across both local standalone databases and cloud environments.
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, role, adminSecret } = req.body as {
    email?: string;
    password?: string;
    role?: string;
    adminSecret?: string;
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
 * Authenticates a user and issues a stateless JSON Web Token.
 *
 * @param {Request} req - Express request object containing credentials.
 * @param {Response} res - Express response object.
 *
 * @architecture
 * Uses constant-time dummy hash comparisons for invalid emails to prevent 
 * timing-based enumeration attacks. The resulting JWT payload is minimal 
 * (userId and role only) to enforce strict data isolation.
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
