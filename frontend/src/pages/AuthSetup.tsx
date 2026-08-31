import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, Briefcase, Sparkles, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import { useAuthStore, type Role } from '../store/authStore';
import { cn } from '../lib/cn';

// =============================================================================
// AuthSetup — Role & Profile Setup for Brand-New Google OAuth Users
// =============================================================================
// New OAuth users land here after their first Google login (the backend sets
// isNew = true). They must choose a role and fill in their profile before
// entering the app — exactly mirroring the normal email registration flow.
//
// The temporary JWT from the URL gives us just enough auth to call the
// POST /api/auth/setup-role endpoint. On success we receive a new JWT that
// has the correct, permanent role baked in.
// =============================================================================
export default function AuthSetup() {
  const [searchParams]    = useSearchParams();
  const navigate          = useNavigate();
  const setAuth           = useAuthStore((s) => s.setAuth);

  const [role,        setRole]        = useState<Role>('STUDENT');
  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [college,     setCollege]     = useState('');
  const [cgpa,        setCgpa]        = useState('');
  const [companyName, setCompanyName] = useState('');
  const [designation, setDesignation] = useState('');
  const [loading,     setLoading]     = useState(false);

  // Temporarily store the OAuth JWT so we can use it in the setup request
  const tempToken = searchParams.get('token');
  const userId    = searchParams.get('userId');
  const email     = searchParams.get('email');

  useEffect(() => {
    // If there's no token in the URL, this page was accessed directly — kick them out
    if (!tempToken || !userId) {
      navigate('/auth', { replace: true });
    }
  }, [tempToken, userId, navigate]);

  const handleSetup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload =
        role === 'STUDENT'
          ? { role, firstName, lastName, college, cgpa: Number(cgpa) }
          : { role, companyName, designation };

      // Call setup-role with the temp JWT in the Authorization header
      const { data: res } = await api.post<{
        success: boolean;
        message: string;
        data: { token: string; user: { userId: string; role: Role; email: string } };
      }>('/auth/setup-role', payload, {
        headers: { Authorization: `Bearer ${tempToken}` },
      });

      // Store the final, correct JWT in Zustand
      setAuth(res.data.token, res.data.user);
      toast.success('Account ready! Welcome to CareerNest 🚀');

      const dest = res.data.user.role === 'STUDENT' ? '/student' : '/recruiter';
      navigate(dest, { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Setup failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none opacity-50"
        style={{ backgroundImage: 'radial-gradient(circle, #c7d2fe 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-100/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-100/30 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-fade-in relative z-10">
        {/* Header */}
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
            One last step — tell us who you are, <span className="font-semibold text-indigo-600">{email ?? 'friend'}</span>
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-card">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Complete your profile</h2>
          <p className="text-slate-500 text-sm mb-6">This takes less than 30 seconds.</p>

          <form onSubmit={handleSetup} className="space-y-4">
            {/* Role picker */}
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

            {/* Student fields */}
            {role === 'STUDENT' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <SetupInput label="First Name" value={firstName} onChange={setFirstName} placeholder="Rahul" />
                  <SetupInput label="Last Name"  value={lastName}  onChange={setLastName}  placeholder="Sharma" />
                </div>
                <SetupInput label="College" value={college} onChange={setCollege} placeholder="IIT Bombay" />
                <SetupInput label="CGPA"    value={cgpa}    onChange={setCgpa}    placeholder="8.5" type="number" />
              </>
            )}

            {/* Recruiter fields */}
            {role === 'RECRUITER' && (
              <>
                <SetupInput label="Company Name" value={companyName} onChange={setCompanyName} placeholder="Acme Corp" />
                <SetupInput label="Designation"  value={designation} onChange={setDesignation} placeholder="HR Manager" />
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-lg
                         hover:bg-indigo-700 active:scale-[0.99] transition-all duration-150
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2 mt-2 shadow-sm text-sm"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Enter CareerNest →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function SetupInput({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900
                   placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2
                   focus:ring-indigo-500/20 transition-colors"
      />
    </div>
  );
}
