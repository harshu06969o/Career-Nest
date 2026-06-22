import { useNavigate } from 'react-router-dom';
import { GraduationCap, Briefcase, Sparkles, ArrowRight } from 'lucide-react';

// =============================================================================
// Landing Page — full-height hero with gradient typography and role CTA
// =============================================================================
export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-slate-950 flex flex-col items-center justify-center
                    text-center px-4 relative overflow-hidden">

      {/* ── Decorative background glows ──────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px]
                        bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-96 h-96
                        bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80
                        bg-violet-500/5 rounded-full blur-3xl" />
        {/* Animated grid overlay */}
        <div className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      {/* ── Hero content ─────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-4xl mx-auto animate-fade-in">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20
                        rounded-full px-4 py-1.5 mb-6 text-emerald-400 text-xs font-semibold
                        tracking-widest uppercase">
          <Sparkles size={12} />
          AI-Powered Placement Portal
        </div>

        {/* Main headline */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black leading-[1.05] mb-6">
          <span className="gradient-text">YOUR PATHWAY</span>
          <br />
          <span className="text-slate-100">TO SUCCESS</span>
        </h1>

        {/* Subtitle */}
        <p className="text-slate-400 text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-4 leading-relaxed">
          CareerNest matches students to their dream roles using a{' '}
          <span className="text-emerald-400 font-semibold">Hybrid AI Scoring Engine</span>
          {' '}— analysing skills, CGPA, and experience in microseconds.
        </p>
        <p className="text-slate-500 text-sm tracking-[0.25em] uppercase mb-12">
          Crafted to Perfection
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => navigate('/auth')}
            className="group relative w-full sm:w-auto flex items-center justify-center gap-3
                       bg-gradient-to-r from-emerald-500 to-emerald-400
                       text-slate-950 font-bold text-base px-8 py-4 rounded-2xl
                       hover:scale-105 hover:shadow-[0_0_32px_rgba(16,185,129,0.4)]
                       active:scale-[0.98] transition-all duration-300 shadow-lg"
          >
            <GraduationCap size={20} />
            I am a Student
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => navigate('/auth')}
            className="group relative w-full sm:w-auto flex items-center justify-center gap-3
                       bg-transparent border-2 border-blue-500 text-blue-400 font-bold
                       text-base px-8 py-4 rounded-2xl
                       hover:scale-105 hover:bg-blue-500/10
                       hover:shadow-[0_0_32px_rgba(59,130,246,0.3)]
                       active:scale-[0.98] transition-all duration-300"
          >
            <Briefcase size={20} />
            I am a Recruiter
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Admin Login Link */}
        <div className="mt-8">
          <button
            onClick={() => navigate('/auth')}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors cursor-pointer"
          >
            Placement Cell? <span className="underline underline-offset-4">Admin Login here</span>
          </button>
        </div>

        {/* Social proof strip */}
        <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-6
                        text-slate-500 text-sm divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
          {[
            { value: '0ms',   label: 'Match Latency' },
            { value: '3 Roles', label: 'Student · Recruiter · Admin' },
            { value: '100%',  label: 'Free Tier' },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center gap-0.5 px-6 py-2">
              <span className="text-2xl font-black text-slate-200">{value}</span>
              <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
