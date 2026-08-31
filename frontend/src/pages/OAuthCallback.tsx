import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore, type Role } from '../store/authStore';

// =============================================================================
// OAuthCallback — Hidden processing page for Google OAuth
// =============================================================================
// The backend redirects here after a successful Google login with:
//   ?token=JWT&userId=...&email=...&role=...
//
// This page does NOT render any visible UI — it instantly reads the URL params,
// saves the auth state to Zustand (identical to a normal email/password login),
// and navigates the user to their dashboard. Takes < 50ms total.
// =============================================================================
export default function OAuthCallback() {
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();
  const setAuth         = useAuthStore((s) => s.setAuth);
  const processed       = useRef(false); // prevent double-execution in StrictMode

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const token  = searchParams.get('token');
    const userId = searchParams.get('userId');
    const email  = searchParams.get('email');
    const role   = searchParams.get('role') as Role | null;

    if (!token || !userId || !role) {
      toast.error('Google login failed. Please try again.');
      navigate('/auth', { replace: true });
      return;
    }

    // Save to Zustand (and localStorage via persist middleware) — same as normal login
    setAuth(token, { userId, email: email ?? '', role });
    toast.success('Welcome back! 🎉');

    // Navigate to the correct dashboard
    const dest = role === 'STUDENT' ? '/student' : role === 'ADMIN' ? '/admin' : '/recruiter';
    navigate(dest, { replace: true });
  }, [searchParams, navigate, setAuth]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg animate-pulse">
          <Loader2 size={26} className="text-white animate-spin" />
        </div>
        <p className="text-slate-600 text-sm font-medium">Signing you in…</p>
      </div>
    </div>
  );
}
