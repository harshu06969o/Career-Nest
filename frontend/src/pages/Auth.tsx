import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2, GraduationCap, Briefcase, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/axios";
import { useAuthStore, type Role } from "../store/authStore";

// =============================================================================
// Auth Page v3 — God-tier Apple glass morphing card
// Single box · floats on a red mesh · seamless sign-in/up morph · no reload
// All API calls, JWT logic, redirects UNCHANGED.
// =============================================================================

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.548 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
  </svg>
);

/** Phoenix wing brand mark */
const PhoenixMark = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <path d="M15 60 C22 42,38 30,50 28 C38 38,27 52,26 66 Z" fill="white" opacity=".95"/>
    <path d="M85 60 C78 42,62 30,50 28 C62 38,73 52,74 66 Z" fill="white" opacity=".95"/>
    <line x1="50" y1="28" x2="50" y2="72" stroke="white" strokeWidth="5.5" strokeLinecap="round"/>
    <path d="M40 52 L50 28 L60 52" fill="white"/>
  </svg>
);

type Tab = "login" | "register";

export default function Auth() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth        = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    if (searchParams.get("error") === "oauth_failed") {
      toast.error("Google sign-in failed. Please try again.");
    }
  }, [searchParams]);

  const [tab,      setTab]      = useState<Tab>("login");
  const [role,     setRole]     = useState<Role>("STUDENT");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [morphKey, setMorphKey] = useState(0);

  const [firstName,   setFirstName]   = useState("");
  const [lastName,    setLastName]    = useState("");
  const [college,     setCollege]     = useState("");
  const [cgpa,        setCgpa]        = useState("");
  const [companyName, setCompanyName] = useState("");
  const [designation, setDesignation] = useState("");

  const switchTab = (t: Tab) => {
    if (t === tab) return;
    setTab(t);
    setMorphKey(k => k + 1);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd  = new FormData(e.currentTarget);
    const em  = (fd.get("email") as string) || email;
    const pw  = (fd.get("password") as string) || password;

    try {
      if (tab === "login") {
        const { data: res } = await api.post<{
          success: boolean; message: string;
          data: { token: string; user: { userId: string; role: Role; email: string } };
        }>("/auth/login", { email: em, password: pw });
        setAuth(res.data.token, res.data.user);
        toast.success("Welcome back!");
        navigate(res.data.user.role === "STUDENT" ? "/student" : "/recruiter");
      } else {
        const payload = role === "STUDENT"
          ? { email: em, password: pw, role, firstName, lastName, college, cgpa: Number(cgpa) }
          : { email: em, password: pw, role, companyName, designation };
        await api.post("/auth/register", payload);
        const { data: lr } = await api.post<{
          success: boolean; message: string;
          data: { token: string; user: { userId: string; role: Role; email: string } };
        }>("/auth/login", { email: em, password: pw });
        setAuth(lr.data.token, lr.data.user);
        toast.success("Account created!");
        navigate(lr.data.user.role === "STUDENT" ? "/student" : "/recruiter");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg,#FAFAFA 0%,#FFFFFF 50%,#FEF2F2 100%)" }}
    >

      {/* ── Floating mesh background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* blob top-left */}
        <div style={{ position:"absolute", top:"-15%", left:"-10%", width:"600px", height:"600px", borderRadius:"50%", background:"radial-gradient(circle,rgba(230,46,45,.11) 0%,transparent 60%)", filter:"blur(90px)", animation:"floatA 24s ease-in-out infinite" }} />
        {/* blob bottom-right */}
        <div style={{ position:"absolute", bottom:"-15%", right:"-10%", width:"700px", height:"700px", borderRadius:"50%", background:"radial-gradient(circle,rgba(230,46,45,.08) 0%,transparent 60%)", filter:"blur(100px)", animation:"floatB 30s ease-in-out infinite" }} />
        {/* blob center */}
        <div style={{ position:"absolute", top:"30%", left:"35%", width:"400px", height:"400px", borderRadius:"50%", background:"radial-gradient(circle,rgba(230,46,45,.05) 0%,transparent 60%)", filter:"blur(70px)", animation:"floatC 20s ease-in-out infinite" }} />
        {/* dot grid */}
        <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(circle,rgba(0,0,0,.05) 1px,transparent 1px)", backgroundSize:"30px 30px", opacity:.6 }} />
      </div>

      {/* ── Auth card ── */}
      <div className="w-full max-w-[450px] relative z-10 animate-scale-in">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex flex-col items-center gap-3">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg,#E62E2D 0%,#B91C1C 100%)",
                boxShadow: "0 8px 32px rgba(230,46,45,.40), 0 0 0 1px rgba(255,255,255,.15) inset",
              }}
            >
              <PhoenixMark size={30} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily:"var(--font-heading)", color:"var(--color-text-primary)", letterSpacing:"-0.04em" }}>
                Career<span style={{ color:"var(--color-brand)" }}>Nest</span>
              </h1>
              <p className="text-xs mt-0.5" style={{ color:"var(--color-text-tertiary)" }}>
                {tab === "login" ? "Welcome back" : "Create your account"}
              </p>
            </div>
          </div>
        </div>

        {/* Morphing glass card */}
        <div
          style={{
            background: "rgba(255,255,255,0.78)",
            backdropFilter: "blur(40px) saturate(200%)",
            WebkitBackdropFilter: "blur(40px) saturate(200%)",
            border: "1px solid rgba(255,255,255,0.85)",
            borderRadius: "24px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.9) inset, 0 0 0 0.5px rgba(0,0,0,0.05)",
            padding: "2rem",
            transition: "all .35s cubic-bezier(.16,1,.3,1)",
          }}
        >

          {/* Tab switcher */}
          <div
            className="flex p-1 rounded-xl gap-1 mb-6"
            style={{ background:"rgba(244,244,245,0.80)", border:"1px solid rgba(228,228,231,.6)" }}
          >
            {(["login","register"] as Tab[]).map(t => (
              <button
                key={t}
                id={`tab-${t}`}
                onClick={() => switchTab(t)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-250"
                style={tab === t ? {
                  background:"rgba(255,255,255,0.95)",
                  color:"var(--color-text-primary)",
                  boxShadow:"0 2px 8px rgba(0,0,0,0.08)",
                  border:"1px solid rgba(228,228,231,.6)",
                } : {
                  color:"var(--color-text-tertiary)",
                  background:"transparent",
                  border:"1px solid transparent",
                }}
              >
                {t === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <form key={`${tab}-${morphKey}`} onSubmit={handleSubmit} className="space-y-4">

            {/* Role picker */}
            {tab === "register" && (
              <div className="grid grid-cols-2 gap-2.5 auth-field-enter">
                {(["STUDENT","RECRUITER"] as Role[]).map(r => {
                  const Icon = r === "STUDENT" ? GraduationCap : Briefcase;
                  return (
                    <button key={r} type="button" id={`role-${r.toLowerCase()}`} onClick={() => setRole(r)}
                      className="flex flex-col items-center gap-1.5 p-3.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200"
                      style={role === r ? {
                        border:"2px solid var(--color-brand)",
                        background:"rgba(254,242,242,0.80)",
                        color:"var(--color-brand)",
                        boxShadow:"0 0 0 4px rgba(230,46,45,.08)",
                      } : {
                        border:"1.5px solid rgba(228,228,231,.8)",
                        background:"rgba(255,255,255,0.60)",
                        color:"var(--color-text-secondary)",
                      }}
                    >
                      <Icon size={20} />
                      {r === "STUDENT" ? "Student" : "Recruiter"}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Student fields */}
            {tab === "register" && role === "STUDENT" && (
              <div className="space-y-4 auth-field-enter">
                <div className="grid grid-cols-2 gap-3">
                  <GlassInput label="First Name" value={firstName} onChange={setFirstName} placeholder="Rahul" />
                  <GlassInput label="Last Name"  value={lastName}  onChange={setLastName}  placeholder="Sharma" />
                </div>
                <GlassInput label="College" value={college} onChange={setCollege} placeholder="IIT Bombay" />
                <GlassInput label="CGPA" value={cgpa} onChange={setCgpa} placeholder="8.5" type="number" />
              </div>
            )}

            {/* Recruiter fields */}
            {tab === "register" && role === "RECRUITER" && (
              <div className="space-y-4 auth-field-enter">
                <GlassInput label="Company" value={companyName} onChange={setCompanyName} placeholder="Acme Corp" />
                <GlassInput label="Designation" value={designation} onChange={setDesignation} placeholder="HR Manager" />
              </div>
            )}

            <GlassInput label="Email" name="email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />

            {/* Password */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color:"var(--color-text-secondary)" }}>
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="cn-input pr-10"
                  style={{
                    background:"rgba(250,250,250,0.70)",
                    backdropFilter:"blur(8px)",
                    border:"1.5px solid rgba(228,228,231,.8)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color:"var(--color-text-tertiary)" }}
                  onMouseEnter={e => e.currentTarget.style.color = "var(--color-text-secondary)"}
                  onMouseLeave={e => e.currentTarget.style.color = "var(--color-text-tertiary)"}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="btn-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-bold text-sm mt-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.97]"
              style={{ background:"linear-gradient(135deg,#E62E2D,#CC2120)", fontFamily:"var(--font-heading)", boxShadow:"0 4px 20px rgba(230,46,45,.40)" }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow = "0 8px 28px rgba(230,46,45,.55)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(230,46,45,.40)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {tab === "login" ? "Sign In" : "Create Account"}
              {!loading && <ArrowRight size={13} />}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background:"rgba(228,228,231,.8)" }} />
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color:"var(--color-text-tertiary)" }}>or</span>
            <div className="flex-1 h-px" style={{ background:"rgba(228,228,231,.8)" }} />
          </div>

          {/* Google OAuth */}
          <a
            id="btn-google"
            href={`${(import.meta.env["VITE_API_URL"] as string | undefined) || "/api"}/auth/google`}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-180 active:scale-[0.99]"
            style={{ background:"rgba(255,255,255,0.80)", border:"1.5px solid rgba(228,228,231,.7)", color:"var(--color-text-primary)", backdropFilter:"blur(8px)", boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.95)"; e.currentTarget.style.borderColor = "rgba(204,204,207,.9)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.80)"; e.currentTarget.style.borderColor = "rgba(228,228,231,.7)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <GoogleIcon />
            Continue with Google
          </a>

          {/* Switch hint */}
          <p className="text-center text-sm mt-5" style={{ color:"var(--color-text-secondary)" }}>
            {tab === "login" ? "No account?" : "Already registered?"}{" "}
            <button
              id="btn-switchtab"
              onClick={() => switchTab(tab === "login" ? "register" : "login")}
              className="font-bold"
              style={{ color:"var(--color-brand)" }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
              onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
            >
              {tab === "login" ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>

        <p className="text-center text-[11px] mt-5" style={{ color:"var(--color-text-tertiary)" }}>
          By continuing, you agree to CareerNest&apos;s Terms &amp; Privacy Policy.
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Glass-style input field
// =============================================================================
function GlassInput({
  label, value, onChange, placeholder, type = "text", name,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; name?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color:"var(--color-text-secondary)" }}>
        {label}
      </label>
      <input
        type={type} name={name} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required
        className="cn-input"
        style={{ background:"rgba(250,250,250,0.70)", backdropFilter:"blur(8px)", border:"1.5px solid rgba(228,228,231,.8)" }}
      />
    </div>
  );
}
