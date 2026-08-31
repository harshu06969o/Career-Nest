// =============================================================================
// Express Request Interface Augmentation
// =============================================================================
// This file globally extends Express's Request type so TypeScript knows about
// `req.user` throughout the entire codebase without any local re-declaration.
//
// IMPORTANT: @types/passport also augments Express.User. To avoid a conflict
// where Passport's empty `User = {}` overwrites our fields, we extend
// Express.User (which Passport reads) AND keep our custom fields on it.
// This means req.user will always have { userId, role } after verifyToken runs.
// =============================================================================

declare global {
  namespace Express {
    // Extending the User interface that Passport declares.
    // passport's @types declares `interface User {}` — we add our fields to it.
    interface User {
      userId: string;
      role:   'STUDENT' | 'RECRUITER' | 'ADMIN';
      email?: string;
      isNew?: boolean;
    }
  }
}

// `export {}` makes this a module (required for `declare global` to work).
export {};
