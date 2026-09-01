import { useNavigate } from 'react-router-dom';
import { GraduationCap, Briefcase, Sparkles, ArrowRight, CheckCircle2, Shield } from 'lucide-react';

// =============================================================================
// Landing Page — Enterprise Light Theme Hero
// =============================================================================
// REDESIGN: Pure white + dot-grid background, indigo primary accents,
// "High Trust" value proposition layout. Routing logic UNCHANGED.
// =============================================================================
export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex flex-col items-center justify-center
                    text-center relative overflow-hidden">

      {/* ── Dot-grid background ─────────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          backgroundImage: 'radial-gradient(circle, #c7d2fe 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* ── Soft gradient blobs ─────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-100/60 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-violet-100/50 rounded-full blur-3xl" />
      </div>

      {/* ── Hero content ─────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 animate-fade-in">

        {/* AI badge — glassmorphism pill */}
        <div className="inline-flex items-center gap-2 mb-8 animate-scale-in"
          style={{ background: 'rgba(238,242,255,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(199,210,254,0.6)', borderRadius: '9999px', padding: '0.375rem 1rem' }}>
          <Sparkles size={12} className="text-indigo-500" />
          <span style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#4338ca' }}>
            AI-Powered Placement Platform
          </span>
        </div>

        {/* Main headline — Plus Jakarta Sans, tight tracking */}
        <h1 style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif', fontSize: 'clamp(2.75rem,8vw,5rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.08, marginBottom: '1.5rem', color: '#0f172a' }} className="animate-view-enter">
          Your Pathway to{' '}
          <span className="gradient-text">Dream Careers</span>
        </h1>

        {/* Subtitle */}
        <p className="text-slate-600 text-lg sm:text-xl max-w-2xl mx-auto mb-3 leading-relaxed font-normal">
          CareerNest connects students to their ideal roles using a{' '}
          <span className="text-indigo-600 font-semibold">Hybrid AI Scoring Engine</span>
          {' '}— analysing skills, CGPA, and experience in milliseconds.
        </p>
        <p className="text-slate-400 text-sm tracking-widest uppercase mb-12 font-medium">
          Trusted by universities and top recruiters
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button
            onClick={() => navigate('/auth')}
            className="group relative w-full sm:w-auto flex items-center justify-center gap-3
                       bg-indigo-600 text-white font-bold text-base px-8 py-4 rounded-xl
                       hover:bg-indigo-700 hover:shadow-indigo active:scale-[0.98]
                       transition-all duration-200 shadow-sm"
          >
            <GraduationCap size={20} />
            I am a Student
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => navigate('/auth')}
            className="group relative w-full sm:w-auto flex items-center justify-center gap-3
                       bg-white text-indigo-600 font-bold text-base px-8 py-4 rounded-xl
                       border-2 border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50
                       active:scale-[0.98] transition-all duration-200"
          >
            <Briefcase size={20} />
            I am a Recruiter
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Admin Link */}
        <div className="mb-12">
          <button
            onClick={() => navigate('/auth')}
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-sm
                       transition-colors cursor-pointer font-medium"
          >
            <Shield size={13} />
            Placement Cell?{' '}
            <span className="underline underline-offset-4 decoration-slate-300">Admin Login</span>
          </button>
        </div>

        {/* Feature trust strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {[
            {
              icon: <Sparkles size={18} className="text-indigo-600" />,
              title: 'AI Skill Matching',
              desc:  'LLM-powered skill extraction & scoring engine',
              bg:    'bg-indigo-50 border-indigo-100',
            },
            {
              icon: <GraduationCap size={18} className="text-emerald-600" />,
              title: 'Student First',
              desc:  'Skill gap analysis with actionable feedback',
              bg:    'bg-emerald-50 border-emerald-100',
            },
            {
              icon: <CheckCircle2 size={18} className="text-violet-600" />,
              title: 'Real-time ATS',
              desc:  'AI-ranked applicant tracking for recruiters',
              bg:    'bg-violet-50 border-violet-100',
            },
          ].map(({ icon, title, desc, bg }) => (
            <div
              key={title}
              className={`flex flex-col items-center gap-3 p-5 rounded-xl border ${bg} text-center`}
            >
              <div className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center border border-slate-100">
                {icon}
              </div>
              <div>
                <p className="text-slate-900 font-semibold text-sm">{title}</p>
                <p className="text-slate-500 text-xs mt-0.5 leading-snug">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof strip */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-0
                        divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border border-slate-200
                        rounded-2xl bg-white shadow-card overflow-hidden">
          {[
            { value: '<50ms',    label: 'AI Match Latency' },
            { value: '3 Roles',  label: 'Student · Recruiter · Admin' },
            { value: '100%',     label: 'Free Platform' },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center gap-0.5 px-10 py-5">
              <span className="text-2xl font-black text-slate-900">{value}</span>
              <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
