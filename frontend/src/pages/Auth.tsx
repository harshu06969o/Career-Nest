import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, GraduationCap, Briefcase, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import { useAuthStore, type Role } from '../store/authStore';
import { cn } from '../lib/cn';

// The Google icon as an inline SVG — no extra package needed
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.548 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
  </svg>
);

// =============================================================================
// Auth Page — Enterprise Light Theme Login + Register
// =============================================================================
// REDESIGN: White card, slate-50 background, indigo accents, clean typography.
// All form state, API calls, JWT storage, and redirects are UNCHANGED.
// =============================================================================

type Tab = 'login' | 'register';

export default function Auth() {
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const setAuth         = useAuthStore((s) => s.setAuth);

  // Show error toast if Google OAuth failed
  useEffect(() => {
    if (searchParams.get('error') === 'oauth_failed') {
      toast.error('Google sign-in failed. Please try again.');
    }
  }, [searchParams]);

  const [tab,        setTab]        = useState<Tab>('login');
  const [role,       setRole]       = useState<Role>('STUDENT');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);

  // --- Register-only fields ---
  const [firstName,     setFirstName]     = useState('');
  const [lastName,      setLastName]      = useState('');
  const [college,       setCollege]       = useState('');
  const [cgpa,          setCgpa]          = useState('');
  const [companyName,   setCompanyName]   = useState('');
  const [designation,   setDesignation]   = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    // Read directly from DOM to bypass React state bugs with browser autofill
    const formData = new FormData(e.currentTarget);
    const currentEmail = (formData.get('email') as string) || email;
    const currentPassword = (formData.get('password') as string) || password;

    try {
      if (tab === 'login') {
        const { data: res } = await api.post<{
          success: boolean;
          message: string;
          data: { token: string; user: { userId: string; role: Role; email: string } };
        }>('/auth/login', { email: currentEmail, password: currentPassword });

        // Backend envelope: { success, message, data: { token, user } }
        setAuth(res.data.token, res.data.user);
        toast.success('Welcome back! 🎉');
        navigate(res.data.user.role === 'STUDENT' ? '/student' : '/recruiter');
      } else {
        // Build payload based on role
        const payload =
          role === 'STUDENT'
            ? { email: currentEmail, password: currentPassword, role, firstName, lastName, college, cgpa: Number(cgpa) }
            : { email: currentEmail, password: currentPassword, role, companyName, designation };

        // Register — backend does NOT return a token, only userId+email+role.
        // So we register then immediately log in to get a token.
        await api.post<{ success: boolean; message: string }>('/auth/register', payload);

        const { data: loginRes } = await api.post<{
          success: boolean;
          message: string;
          data: { token: string; user: { userId: string; role: Role; email: string } };
        }>('/auth/login', { email: currentEmail, password: currentPassword });

        setAuth(loginRes.data.token, loginRes.data.user);
        toast.success('Account created successfully! 🚀');
        navigate(loginRes.data.user.role === 'STUDENT' ? '/student' : '/recruiter');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Something went wrong';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center p-4">
      {/* Background dot grid */}
      <div
        className="fixed inset-0 pointer-events-none opacity-50"
        style={{
          backgroundImage: 'radial-gradient(circle, #c7d2fe 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* Soft blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-100/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-100/30 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-fade-in relative z-10">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
              <Sparkles size={18} className="text-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Career<span className="text-indigo-600">Nest</span>
            </h1>
          </div>
          <p className="text-slate-500 text-sm font-medium">
            {tab === 'login' ? 'Welcome back! Sign in to continue.' : 'Create your account to get started.'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-card">
          {/* Tab switcher */}
          <div className="flex bg-slate-100 rounded-xl p-1 mb-6 gap-1">
            {(['login', 'register'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
                  tab === t
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {t === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role picker (register only) */}
            {tab === 'register' && (
              <div className="grid grid-cols-2 gap-3 mb-2">
                {(['STUDENT', 'RECRUITER'] as Role[]).map((r) => {
                  const Icon = r === 'STUDENT' ? GraduationCap : Briefcase;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
                        role === r
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white',
                      )}
                    >
                      <Icon size={22} />
                      <span className="text-xs font-bold uppercase tracking-wide">{r}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Register-only fields */}
            {tab === 'register' && role === 'STUDENT' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="First Name" value={firstName} onChange={setFirstName} placeholder="Rahul" />
                  <InputField label="Last Name"  value={lastName}  onChange={setLastName}  placeholder="Sharma" />
                </div>
                <InputField label="College" value={college} onChange={setCollege} placeholder="IIT Bombay" />
                <InputField label="CGPA" value={cgpa} onChange={setCgpa} placeholder="8.5" type="number" />
              </>
            )}
            {tab === 'register' && role === 'RECRUITER' && (
              <>
                <InputField label="Company" value={companyName} onChange={setCompanyName} placeholder="Acme Corp" />
                <InputField label="Designation" value={designation} onChange={setDesignation} placeholder="HR Manager" />
              </>
            )}

            {/* Email */}
            <InputField label="Email" name="email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 pr-10
                             text-sm text-slate-900 placeholder-slate-400
                             focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20
                             transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-bold
                         py-2.5 rounded-lg hover:bg-indigo-700 active:scale-[0.99]
                         transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2 mt-2 shadow-sm text-sm"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {tab === 'login' ? 'Sign In to CareerNest' : 'Create My Account'}
            </button>
          </form>

          {/* ── Google OAuth divider ──────────────────────────────────────── */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Continue with Google — MUST be a real <a> tag, not Axios.
              OAuth requires a full browser navigation to the backend. */}
          <a
            href={`${(import.meta.env['VITE_API_URL'] as string | undefined) || '/api'}/auth/google`}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg
                       border border-slate-300 bg-white hover:bg-slate-50 active:scale-[0.99]
                       text-sm font-semibold text-slate-700 transition-all duration-150 shadow-sm"
          >
            <GoogleIcon />
            Continue with Google
          </a>

          {/* Switch tab hint */}
          <div className="mt-5 text-center">
            <p className="text-slate-500 text-sm">
              {tab === 'login' ? "Don't have an account?" : 'Already registered?'}{' '}
              <button
                onClick={() => setTab(tab === 'login' ? 'register' : 'login')}
                className="text-indigo-600 font-semibold hover:underline"
              >
                {tab === 'login' ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-slate-400 text-xs mt-6">
          By continuing, you agree to CareerNest's Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}

// ── Reusable input sub-component ──────────────────────────────────────────────
function InputField({
  label, value, onChange, placeholder, type = 'text', name
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  name?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5
                   text-sm text-slate-900 placeholder-slate-400
                   focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20
                   transition-colors"
      />
    </div>
  );
}
