// =============================================================================
// Express Request Interface Augmentation
// =============================================================================
// This file globally extends Express's Request type so TypeScript knows about
// `req.user` throughout the entire codebase without any local re-declaration.
//
// We use string literals here (not the Prisma Role enum) to keep this
// declaration file free of runtime imports — .d.ts files must be purely
// type-level. The Role type in the middleware enforces consistency via Prisma.
// =============================================================================

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: 'STUDENT' | 'RECRUITER' | 'ADMIN';
      };
    }
  }
}

// `export {}` makes this a module (required for `declare global` to work).
export {};
