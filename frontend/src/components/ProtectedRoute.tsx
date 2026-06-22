import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore, type Role } from '../store/authStore';

// =============================================================================
// ProtectedRoute
// =============================================================================
// Wraps any route that requires authentication and (optionally) a specific role.
// Usage in router:
//   <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
//     <Route path="/student" element={<StudentDashboard />} />
//   </Route>
// =============================================================================
interface Props {
  allowedRoles?: Role[];
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { isAuth, user } = useAuthStore();

  // Not authenticated → send to landing
  if (!isAuth) return <Navigate to="/" replace />;

  // Role mismatch → send to their own dashboard
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    const fallback = user.role === 'STUDENT' ? '/student' : '/recruiter';
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
