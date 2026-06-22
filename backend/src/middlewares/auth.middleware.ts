import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';

// =============================================================================
// Internal JWT Payload Shape
// =============================================================================
// This interface describes exactly what we sign into the token.
// Keeping it minimal (userId + role) prevents sensitive data leaking
// in a decoded token and keeps token size small.
// =============================================================================
interface JwtPayload {
  userId: string;
  role: Role;
  iat?: number;
  exp?: number;
}

// =============================================================================
// verifyToken
// =============================================================================
// Extracts and validates the JWT from the `Authorization: Bearer <token>` header.
// On success, attaches { userId, role } to req.user and calls next().
// On failure, responds immediately — does NOT call next() — so routes never
// execute with an invalid identity.
// =============================================================================
export const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    return;
  }

  // Split safely — noUncheckedIndexedAccess means [1] could be undefined
  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ success: false, message: 'Access denied. Malformed token header.' });
    return;
  }

  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    // Server misconfiguration — never expose internals to client
    console.error('FATAL: JWT_SECRET is not set in environment variables.');
    res.status(500).json({ success: false, message: 'Internal server error.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = { userId: decoded.userId, role: decoded.role };
    next();
  } catch (error) {
    // Catches TokenExpiredError, JsonWebTokenError, NotBeforeError
    res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

// =============================================================================
// requireRole (Higher-Order Middleware Factory)
// =============================================================================
// Usage: router.get('/admin', verifyToken, requireRole(['ADMIN']), handler)
//
// Always place AFTER verifyToken in the middleware chain — this guard assumes
// req.user is already populated. It is not a standalone auth check.
// =============================================================================
export const requireRole = (roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      // Defensive check — should not happen if verifyToken runs first
      res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
      return;
    }

    if (!roles.includes(req.user.role as Role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden. This resource requires one of the following roles: ${roles.join(', ')}.`,
      });
      return;
    }

    next();
  };
};
