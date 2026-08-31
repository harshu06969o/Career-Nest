import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore }     from './store/authStore';
import Layout               from './components/Layout';
import ProtectedRoute       from './components/ProtectedRoute';
import Landing              from './pages/Landing';
import Auth                 from './pages/Auth';
import OAuthCallback        from './pages/OAuthCallback';
import AuthSetup            from './pages/AuthSetup';
import StudentDashboard     from './pages/student/Dashboard';
import RecruiterDashboard   from './pages/recruiter/Dashboard';
import AdminDashboard       from './pages/admin/Dashboard';

// =============================================================================
// App — Root Router
// =============================================================================
// Route structure:
//   /             → Landing (public)
//   /auth         → Auth login/register (public; redirects if already logged in)
//   /auth/callback→ OAuthCallback — processes JWT from Google redirect (public)
//   /auth/setup   → AuthSetup — role/profile setup for new Google users (public)
//   /student/*    → Student pages (STUDENT role only)
//   /recruiter/*  → Recruiter pages (RECRUITER role only)
//   /admin/*      → Admin pages (ADMIN role only)
// =============================================================================
export default function App() {
  const { isAuth, user } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        {/* ── Global Layout wraps everything ─────────────────────────────── */}
        <Route element={<Layout />}>
          
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route
            path="/auth"
            element={
              // Already logged in → redirect to their dashboard
              isAuth ? (
                <Navigate
                  to={user?.role === 'STUDENT' ? '/student' : user?.role === 'ADMIN' ? '/admin' : '/recruiter'}
                  replace
                />
              ) : (
                <Auth />
              )
            }
          />

          {/* OAuth callback pages — always public, no redirect-if-logged-in guard */}
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route path="/auth/setup"    element={<AuthSetup />} />

          {/* Authenticated routes */}
          <Route element={<ProtectedRoute />}>
            
            {/* Student routes */}
            <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
              <Route path="/student" element={<StudentDashboard />} />
            </Route>

            {/* Recruiter routes */}
            <Route element={<ProtectedRoute allowedRoles={['RECRUITER', 'ADMIN']} />}>
              <Route path="/recruiter" element={<RecruiterDashboard />} />
            </Route>

            {/* Admin routes */}
            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>

          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
