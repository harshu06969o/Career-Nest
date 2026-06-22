import { useState } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import {
  GraduationCap, Briefcase, LayoutDashboard, LogOut,
  Menu, X, LogIn, UserPlus, Shield
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { cn } from '../lib/cn';

/**
 * Global application shell component.
 * Provides the top navigation bar, responsive drawer, toast notifications, and 
 * role-based dynamic routing links (Student vs Recruiter vs Admin).
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

  const isStudent   = user?.role === 'STUDENT';
  const isRecruiter = user?.role === 'RECRUITER';
  const isAdmin     = user?.role === 'ADMIN';

  const navLinks: NavLink[] = isStudent
    ? [{ label: 'Dashboard', to: '/student',         icon: <LayoutDashboard size={16} /> }]
    : isRecruiter
    ? [{ label: 'Dashboard', to: '/recruiter',        icon: <LayoutDashboard size={16} /> }]
    : isAdmin
    ? [{ label: 'Dashboard', to: '/admin',            icon: <LayoutDashboard size={16} /> }]
    : [];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* ── Toast provider ─────────────────────────────────────────────────── */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1e293b',
            color:      '#f1f5f9',
            border:     '1px solid #334155',
            borderRadius: '12px',
            fontSize:   '14px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />

      {/* ── Top Navigation ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-4 md:px-8">
        <div className="w-full h-16 flex items-center justify-between">
          {/* Left: brand */}
          <Link to="/" className="flex flex-col items-start justify-start">
            <span className="text-xl font-black text-emerald-400 leading-none flex items-center gap-2">
              <SparklesIcon />
              CareerNest
            </span>
          </Link>

          {/* Right: nav links + actions */}
          <div className="hidden md:flex items-center justify-end gap-3">
            {isAuth ? (
              <>
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      location.pathname === link.to
                        ? 'bg-slate-800 text-emerald-400'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50',
                    )}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                ))}
                <div className="h-6 w-px bg-slate-800 mx-1"></div>
                
                <span className="text-sm font-semibold text-slate-300 px-2 flex items-center gap-1.5">
                  {isStudent && <><GraduationCap size={16} className="text-indigo-400"/> Student</>}
                  {isRecruiter && <><Briefcase size={16} className="text-emerald-400"/> Recruiter</>}
                  {isAdmin && <><Shield size={16} className="text-rose-400"/> Admin</>}
                </span>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                             text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-1"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <LogIn size={16} />
                  Login
                </Link>
                <Link
                  to="/auth"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-sm transition-colors"
                >
                  <UserPlus size={16} />
                  Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile: hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-800 py-4 flex flex-col gap-2 animate-slide-up bg-slate-950">
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
                        ? 'bg-slate-800 text-emerald-400'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50',
                    )}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                ))}
                <button
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                             text-red-400 hover:bg-red-500/10 transition-colors mt-2"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 px-4">
                <Link
                  to="/auth"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <LogIn size={16} />
                  Login
                </Link>
                <Link
                  to="/auth"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-sm transition-colors"
                >
                  <UserPlus size={16} />
                  Register
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── Page content ───────────────────────────────────────────────────── */}
      <main className="flex-1 w-full px-4 md:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
    </svg>
  );
}
