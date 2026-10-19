import { useState } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import {
  GraduationCap, Briefcase, LayoutDashboard, LogOut,
  Menu, X, LogIn, UserPlus, Shield, MessageSquare,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { cn } from '../lib/cn';
import ProfilePanel from './ProfilePanel';
import NotificationBell from './NotificationBell';
import LiveChatDrawer from './LiveChatDrawer';

interface NavLink {
  label: string;
  to:    string;
  icon:  React.ReactNode;
}

export default function Layout() {
  const { isAuth, user, logout } = useAuthStore();
  const { isOpen: isChatOpen, activeConversationId, openChat, closeChat } = useChatStore();
  const navigate          = useNavigate();
  const location          = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const isLanding   = location.pathname === '/';
  const isStudent   = user?.role === 'STUDENT';
  const isRecruiter = user?.role === 'RECRUITER';
  const isAdmin     = user?.role === 'ADMIN';

  const navLinks: NavLink[] = isStudent
    ? [{ label: 'Dashboard', to: '/student',   icon: <LayoutDashboard size={14} /> }]
    : isRecruiter
    ? [{ label: 'Dashboard', to: '/recruiter', icon: <LayoutDashboard size={14} /> }]
    : isAdmin
    ? [{ label: 'Dashboard', to: '/admin',     icon: <LayoutDashboard size={14} /> }]
    : [];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const roleMeta = isStudent
    ? { label: 'Student',   icon: <GraduationCap size={12} />, cls: 'bg-rose-50 text-rose-700 border-rose-200' }
    : isRecruiter
    ? { label: 'Recruiter', icon: <Briefcase size={12} />,     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : isAdmin
    ? { label: 'Admin',     icon: <Shield size={12} />,        cls: 'bg-purple-50 text-purple-700 border-purple-200' }
    : null;

  return (
    <div className="w-full min-h-screen flex flex-col bg-[#FAFAFA] text-[#0F172A] selection:bg-rose-100 selection:text-rose-900">
      {/* ── Toast notifications ─────────────────────────────────────────────── */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background:   '#FFFFFF',
            color:        '#0F172A',
            border:       '1px solid #E5E7EB',
            borderRadius: '12px',
            fontSize:     '13.5px',
            fontWeight:   '500',
            boxShadow:    '0 8px 30px rgba(0,0,0,0.08)',
            fontFamily:   'Inter, system-ui, sans-serif',
          },
          success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#E83B72', secondary: '#fff' } },
        }}
      />

      {/* ── Top Navigation (Wellfound-inspired aesthetic) ────────────────────── */}
      <header
        className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 transition-all"
      >
        <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

          {/* Left: Brand Logo & Title */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
              <img
                src="/logo.png"
                alt="CareerNest Logo"
                className="w-9 h-9 rounded-full object-cover shadow-sm ring-2 ring-rose-200/70 group-hover:scale-105 group-hover:ring-rose-400 transition-all duration-200"
              />
              <span
                className="text-xl font-black tracking-tight flex items-center text-slate-900"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Career<span className="text-[#E83B72]">Nest</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#E83B72] ml-0.5 mt-2 animate-pulse" />
              </span>
            </Link>

            {/* Wellfound style public nav tabs */}
            {!isAuth && (
              <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
                <a
                  href="#for-recruiters"
                  className="hover:text-slate-950 transition-colors"
                >
                  For Recruiters
                </a>
                <a
                  href="#for-candidates"
                  className="hover:text-slate-950 transition-colors"
                >
                  For Candidates
                </a>
                <a
                  href="#matching-model"
                  className="hover:text-slate-950 transition-colors"
                >
                  Matching Algorithm
                </a>
                <a
                  href="#benchmarks"
                  className="hover:text-slate-950 transition-colors"
                >
                  Benchmarks
                </a>
              </nav>
            )}
          </div>

          {/* Desktop Right Nav */}
          <div className="hidden md:flex items-center gap-3">
            {isAuth ? (
              <>
                {/* Page nav links */}
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={cn(
                      'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150',
                      location.pathname === link.to
                        ? 'bg-rose-50 text-[#E83B72] font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
                    )}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                ))}

                <div className="h-4 w-px bg-slate-200 mx-1" />

                {/* Role badge */}
                {roleMeta && (
                  <span className={cn(
                    'flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
                    roleMeta.cls,
                  )}>
                    {roleMeta.icon}
                    {roleMeta.label}
                  </span>
                )}

                <div className="h-4 w-px bg-slate-200 mx-1" />

                {/* Messages button */}
                <button
                  type="button"
                  onClick={() => openChat(null)}
                  className="p-2 rounded-full text-slate-600 hover:text-[#E83B72] hover:bg-rose-50 transition-colors"
                  title="Live 1-on-1 Messages"
                  aria-label="Open messages"
                >
                  <MessageSquare size={17} />
                </button>

                {/* Notification bell */}
                <NotificationBell onOpenChat={(convId) => openChat(convId ?? null)} />

                <div className="h-4 w-px bg-slate-200 mx-1" />

                {/* Avatar */}
                <button
                  onClick={() => setIsProfileOpen(true)}
                  className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm hover:ring-2 hover:ring-rose-200 transition-all duration-150"
                  style={{ background: 'linear-gradient(135deg, #E83B72, #BE185D)' }}
                  aria-label="Open profile settings"
                >
                  <span className="text-white text-[11px] font-bold tracking-wide">
                    {user?.email?.substring(0, 2).toUpperCase() || 'U'}
                  </span>
                </button>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-slate-500 hover:text-[#E83B72] hover:bg-rose-50 transition-all duration-150"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="px-4 py-2 rounded-full text-sm font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  to="/auth"
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold text-white bg-[#E83B72] hover:bg-[#D62D64] transition-all shadow-sm active:scale-95"
                >
                  <UserPlus size={14} />
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            {isAuth && <NotificationBell onOpenChat={(convId) => openChat(convId ?? null)} />}
            <button
              className="p-2 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition-colors"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white py-4 px-4 flex flex-col gap-2 shadow-lg animate-slide-up">
            {isAuth ? (
              <>
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                ))}
                <button
                  onClick={() => { setMenuOpen(false); openChat(null); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 text-left"
                >
                  <MessageSquare size={14} />
                  Messages
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setIsProfileOpen(true); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 text-left"
                >
                  <GraduationCap size={14} />
                  My Profile
                </button>
                <div className="h-px bg-slate-100 my-1" />
                <button
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 text-left"
                >
                  <LogOut size={14} />
                  Log Out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                <a
                  href="#for-recruiters"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  For Recruiters
                </a>
                <a
                  href="#for-candidates"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  For Candidates
                </a>
                <Link
                  to="/auth"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full text-sm font-medium text-slate-700 border border-slate-200 mt-2"
                >
                  <LogIn size={14} />
                  Log in
                </Link>
                <Link
                  to="/auth"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full text-sm font-semibold text-white bg-[#E83B72] hover:bg-[#D62D64] shadow-sm"
                >
                  <UserPlus size={14} />
                  Get Started
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── Page Content Container ─────────────────────────────────────────── */}
      <main className="flex-1 w-full relative">
        {isLanding ? (
          <Outlet />
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
            <Outlet />
          </div>
        )}
      </main>

      {/* Profile side panel */}
      <ProfilePanel
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      {/* Global 1-on-1 Live Chat Drawer */}
      {isAuth && (
        <LiveChatDrawer
          isOpen={isChatOpen}
          onClose={closeChat}
          initialConversationId={activeConversationId}
        />
      )}
    </div>
  );
}
