import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

// =============================================================================
// Axios Instance
// =============================================================================
// VITE_API_URL must be an absolute URL in production (e.g. https://api.example.com/api).
// In development, leave VITE_API_URL unset or set it to an empty string so the
// Vite proxy (vite.config.ts) handles /api/* → localhost:5000 correctly.
const api = axios.create({
  baseURL: (import.meta.env['VITE_API_URL'] as string | undefined) || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// =============================================================================
// Token reader — reads directly from localStorage
// =============================================================================
// WHY: Zustand's persist middleware hydrates asynchronously. On a hard page
// refresh, useAuthStore.getState().token can be null for a brief moment while
// the store is still rehydrating — causing the very first requests to fire
// without a token and receive 401.
//
// Reading from localStorage directly is 100% synchronous and always available,
// even before Zustand has finished hydrating. This is the recommended pattern
// when you need the token outside of React components.
// =============================================================================
function getStoredToken(): string | null {
  try {
    const raw = localStorage.getItem('careernest-auth'); // must match store `name`
    if (!raw) return null;
    // Zustand persist wraps state as: { state: { token, user, isAuth }, version: 0 }
    const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

// ── Request interceptor: inject Bearer token ──────────────────────────────────
api.interceptors.request.use(
  (config) => {
    // Try Zustand in-memory state first (populated after hydration),
    // fall back to the direct localStorage read for the first few requests.
    const token = useAuthStore.getState().token ?? getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: global error surface ────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const status  = error.response?.status;
      const url     = error.config?.url ?? '';

      // Never trigger a forced logout on auth endpoints — that would create an
      // infinite redirect loop (login fails → logout called → redirect to / → login again).
      const isAuthEndpoint = url.includes('/auth/');

      if (status === 401 && !isAuthEndpoint) {
        useAuthStore.getState().logout();
        toast.error('Session expired. Please sign in again.');
      } else if (status !== undefined && status >= 500) {
        const serverMsg =
          (error.response?.data as { message?: string })?.message ??
          'Something went wrong on our end. Please try again.';
        toast.error(serverMsg);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
