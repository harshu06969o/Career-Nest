import { useState } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import {
  GraduationCap, Briefcase, LayoutDashboard, LogOut,
  Menu, X, LogIn, UserPlus, Shield
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { cn } from '../lib/cn';
import ProfilePanel from './ProfilePanel';

/**
 * Global application shell component.
 * Provides the top navigation bar, responsive drawer, toast notifications, and 
 * role-based dynamic routing links (Student vs Recruiter vs Admin).
 * 
 * REDESIGN: Enterprise light theme — white nav, slate-200 border, indigo accents.
 * All routing logic, auth checks, and logout behaviour are UNCHANGED.
 */

interface NavLink {
  label: string;
  to:    string;
  icon:  React.ReactNode;
}

export default function Layout() {
  const { isAuth, user, logout } = useAuthStore();
  const navigate          = useNavigate();
  const location          = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const isStudent   = user?.role === 'STUDENT';
  const isRecruiter = user?.role === 'RECRUITER';
  const isAdmin     = user?.role === 'ADMIN';

  const navLinks: NavLink[] = isStudent
    ? [{ label: 'Dashboard', to: '/student',   icon: <LayoutDashboard size={15} /> }]
    : isRecruiter
    ? [{ label: 'Dashboard', to: '/recruiter', icon: <LayoutDashboard size={15} /> }]
    : isAdmin
    ? [{ label: 'Dashboard', to: '/admin',     icon: <LayoutDashboard size={15} /> }]
    : [];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const roleMeta = isStudent
    ? { label: 'Student',   icon: <GraduationCap size={13} />, cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
    : isRecruiter
    ? { label: 'Recruiter', icon: <Briefcase size={13} />,     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : isAdmin
    ? { label: 'Admin',     icon: <Shield size={13} />,        cls: 'bg-rose-50 text-rose-700 border-rose-200' }
    : null;

  return (
    <div className="w-full min-h-full flex flex-col bg-slate-50">
      {/* ── Toast provider ─────────────────────────────────────────────────── */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background:   '#ffffff',
            color:        '#0f172a',
            border:       '1px solid #e2e8f0',
            borderRadius: '10px',
            fontSize:     '14px',
            fontWeight:   '500',
            boxShadow:    '0 4px 12px rgba(0,0,0,0.08)',
          },
          success: { iconTheme: { primary: '#059669', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
        }}
      />

      {/* ── Top Navigation ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto w-full px-4 md:px-8 h-16 flex items-center justify-between">

          {/* Left: brand */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm group-hover:bg-indigo-700 transition-colors">
              <BrandIcon />
            </div>
            <span className="text-lg font-black text-slate-900 tracking-tight">
              Career<span className="text-indigo-600">Nest</span>
            </span>
          </Link>

          {/* Right: nav links + actions */}
          <div className="hidden md:flex items-center gap-2">
            {isAuth ? (
              <>
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                      location.pathname === link.to
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
                    )}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                ))}

                <div className="h-5 w-px bg-slate-200 mx-1" />

                {/* Role pill badge */}
                {roleMeta && (
                  <span className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
                    roleMeta.cls,
                  )}>
                    {roleMeta.icon}
                    {roleMeta.label}
                  </span>
                )}

                <div className="h-5 w-px bg-slate-200 mx-1" />

                {/* Avatar Button */}
                <button
                  onClick={() => setIsProfileOpen(true)}
                  className="w-9 h-9 ml-1 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm hover:ring-2 hover:ring-indigo-300 transition-all duration-150"
                  aria-label="Open profile settings"
                >
                  <span className="text-white text-sm font-bold tracking-wide">
                    {user?.email?.substring(0, 2).toUpperCase() || 'U'}
                  </span>
                </button>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                             text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-150 ml-1"
                >
                  <LogOut size={15} />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                             text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-150"
                >
                  <LogIn size={15} />
                  Login
                </Link>
                <Link
                  to="/auth"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold
                             bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm
                             transition-all duration-150 active:scale-[0.98]"
                >
                  <UserPlus size={15} />
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile: hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white py-3 flex flex-col gap-1 animate-slide-up px-4 shadow-md">
            {isAuth ? (
              <>
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      location.pathname === link.to
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
                    )}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                ))}

                {/* Role badge in mobile */}
                {roleMeta && (
                  <div className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border w-fit ml-4 mt-1',
                    roleMeta.cls,
                  )}>
                    {roleMeta.icon}
                    {roleMeta.label}
                  </div>
                )}

                <div className="h-px bg-slate-200 my-2" />

                <button
                  onClick={() => { setMenuOpen(false); setIsProfileOpen(true); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                             text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <UserPlus size={15} />
                  Profile Settings
                </button>

                <div className="h-px bg-slate-200 my-2" />

                <button
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                             text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={15} />
                  Logout
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  to="/auth"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium
                             text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  <LogIn size={15} />
                  Login
                </Link>
                <Link
                  to="/auth"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold
                             bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors"
                >
                  <UserPlus size={15} />
                  Get Started
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── Page content ───────────────────────────────────────────────────── */}
      <main className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
          <Outlet />
        </div>
      </main>

      {/* Profile Settings Panel */}
      <ProfilePanel 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
      />
    </div>
  );
}

/** Minimal nest/briefcase icon for brand mark */
function BrandIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
         fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
    </svg>
  );
}
