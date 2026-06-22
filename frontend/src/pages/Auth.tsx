import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, GraduationCap, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import { useAuthStore, type Role } from '../store/authStore';
import { cn } from '../lib/cn';

// =============================================================================
// Auth Page — Login + Register with animated tab switcher
// =============================================================================

type Tab = 'login' | 'register';

export default function Auth() {
  const navigate  = useNavigate();
  const setAuth   = useAuthStore((s) => s.setAuth);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (tab === 'login') {
        const { data: res } = await api.post<{
          success: boolean;
          message: string;
          data: { token: string; user: { userId: string; role: Role; email: string } };
        }>('/auth/login', { email, password });

        // Backend envelope: { success, message, data: { token, user } }
        setAuth(res.data.token, res.data.user);
        toast.success('Welcome back! 🎉');
        navigate(res.data.user.role === 'STUDENT' ? '/student' : '/recruiter');
      } else {
        // Build payload based on role
        const payload =
          role === 'STUDENT'
            ? { email, password, role, firstName, lastName, college, cgpa: Number(cgpa) }
            : { email, password, role, companyName, designation };

        // Register — backend does NOT return a token, only userId+email+role.
        // So we register then immediately log in to get a token.
        await api.post<{ success: boolean; message: string }>('/auth/register', payload);

        const { data: loginRes } = await api.post<{
          success: boolean;
          message: string;
          data: { token: string; user: { userId: string; role: Role; email: string } };
        }>('/auth/login', { email, password });

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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background glow orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-fade-in">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black gradient-text mb-1">CareerNest</h1>
          <p className="text-slate-400 text-sm tracking-widest uppercase">Crafted to Perfection</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          {/* Tab switcher */}
          <div className="flex bg-slate-800 rounded-xl p-1 mb-6">
            {(['login', 'register'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
                  tab === t
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200',
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
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                          : 'border-slate-700 text-slate-400 hover:border-slate-600',
                      )}
                    >
                      <Icon size={22} />
                      <span className="text-xs font-semibold">{r}</span>
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
            <InputField label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-10
                             text-sm text-slate-100 placeholder-slate-500
                             focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40
                             transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-bold
                         py-3 rounded-xl hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]
                         transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2 mt-2 shadow-lg"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Reusable input sub-component ──────────────────────────────────────────────
function InputField({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                   text-sm text-slate-100 placeholder-slate-500
                   focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40
                   transition-colors"
      />
    </div>
  );
}
