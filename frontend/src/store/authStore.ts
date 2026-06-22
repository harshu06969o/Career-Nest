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

// =============================================================================
// Zustand Auth Store
// =============================================================================
// Persisted to localStorage so the user stays logged in across page refreshes.
// Hydration is automatic — Zustand persist middleware handles it transparently.
// =============================================================================
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token:  null,
      user:   null,
      isAuth: false,

      setAuth: (token, user) => set({ token, user, isAuth: true }),

      logout: () => {
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
