import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// =============================================================================
// Types
// =============================================================================
export type Role = 'STUDENT' | 'RECRUITER' | 'ADMIN';

export interface AuthUser {
  userId: string;
  role:   Role;
  email?: string;
}

interface AuthState {
  token:  string | null;
  user:   AuthUser | null;
  isAuth: boolean;
  // Actions
  setAuth:  (token: string, user: AuthUser) => void;
  logout:   () => void;
}

/**
 * Global Zustand Authentication Store.
 * Manages the client-side session state (JWT token and user metadata) and persists
 * it to localStorage. Hydration is handled automatically by the persist middleware.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token:  null,
      user:   null,
      isAuth: false,

      setAuth: (token, user) => set({ token, user, isAuth: true }),

      logout: () => {
        // @architecture
        // Cache Invalidation Strategy: Explicitly removes the persisted store key from 
        // localStorage prior to clearing the in-memory Zustand state. This guarantees 
        // synchronous token destruction and prevents stale JWT leakage during session switching.
        localStorage.removeItem('careernest-auth');
        set({ token: null, user: null, isAuth: false });
        // Force navigation to landing — window.location avoids a React Router
        // dependency in the store layer.
        window.location.href = '/';
      },
    }),
    {
      name: 'careernest-auth', // localStorage key
    },
  ),
);
