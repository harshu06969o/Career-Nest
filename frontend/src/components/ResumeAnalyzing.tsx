// src/components/ResumeAnalyzing.tsx
// Full-screen overlay shown while the BullMQ worker is processing the resume.
// Dismisses automatically when the parent receives the 'resume:parsed' WebSocket event.

import { useEffect, useState, useRef } from 'react';
import { Sparkles, Brain, FileSearch, CheckCircle2, X } from 'lucide-react';

interface Props {
  /** Called by parent or safety timer when finished */
  onComplete?: () => void;
  /** Optional manual dismiss */
  onDismiss?: () => void;
}

const PHASES = [
  { icon: FileSearch,    label: 'Reading your PDF…',           duration: 2500 },
  { icon: Brain,         label: 'Extracting text content…',    duration: 3000 },
  { icon: Sparkles,      label: 'Gemini is analysing skills…', duration: 4500 },
  { icon: CheckCircle2,  label: 'Almost done…',                duration: 15000 },
];

export default function ResumeAnalyzing({ onComplete, onDismiss }: Props) {
  const [phaseIdx,   setPhaseIdx]   = useState(0);
  const [progress,   setProgress]   = useState(0);
  const [exiting,    setExiting]    = useState(false);
  const doneCalledRef = useRef(false);

  const handleDone = () => {
    if (doneCalledRef.current) return;
    doneCalledRef.current = true;
    setProgress(100);
    setExiting(true);
    setTimeout(() => {
      onComplete?.();
      onDismiss?.();
    }, 500);
  };

  // Safety fallback: if processing takes > 22 seconds, auto-complete
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      console.log('[ResumeAnalyzing] Safety auto-complete triggered');
      handleDone();
    }, 22000);
    return () => clearTimeout(safetyTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Advance phases on a timer
  useEffect(() => {
    if (phaseIdx >= PHASES.length - 1) return;
    const t = setTimeout(() => setPhaseIdx(p => p + 1), PHASES[phaseIdx]!.duration);
    return () => clearTimeout(t);
  }, [phaseIdx]);

  // Smooth progress bar
  useEffect(() => {
    const target = phaseIdx === PHASES.length - 1 ? 95 : ((phaseIdx + 1) / PHASES.length) * 85;
    const step = (target - progress) / 35;
    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + step;
        if (Math.abs(next - target) < 0.5) { clearInterval(interval); return target; }
        return next;
      });
    }, 50);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIdx]);

  const CurrentIcon = PHASES[phaseIdx]!.icon;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500
                  ${exiting ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}
      style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(20px)' }}
    >
      {/* Card */}
      <div className="relative w-full max-w-sm mx-4 overflow-hidden animate-view-enter"
           style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '1.5rem', padding: '2.5rem 2rem', backdropFilter: 'blur(24px)' }}>

        {/* Close / Dismiss button */}
        <button
          onClick={handleDone}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Dismiss overlay"
        >
          <X size={16} />
        </button>

        {/* Glowing orb behind icon */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)', filter: 'blur(30px)' }} />

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative p-5 rounded-2xl"
               style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
            <CurrentIcon size={32} className="text-indigo-300" style={{ animation: 'radarPulse 1.8s ease-in-out infinite' }} />
            {/* Spinning ring */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(99,102,241,0.25)" strokeWidth="2" />
              <circle cx="40" cy="40" r="36" fill="none" stroke="#6366f1" strokeWidth="2"
                strokeDasharray="226" strokeDashoffset="170"
                strokeLinecap="round"
                style={{ transformOrigin: 'center', animation: 'spin 2s linear infinite' }} />
            </svg>
          </div>
        </div>

        {/* Headline */}
        <h2 className="text-center text-white text-xl font-black mb-2"
            style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif', letterSpacing: '-0.03em' }}>
          AI is Analysing Your Resume
        </h2>

        {/* Phase label */}
        <p className="text-center text-indigo-300 text-sm font-medium mb-6 transition-all duration-300">
          {PHASES[phaseIdx]!.label}
        </p>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-400 font-semibold mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all duration-500 ease-out"
                 style={{ width: `${progress}%`,
                          background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)',
                          boxShadow: '0 0 12px rgba(99,102,241,0.6)' }} />
          </div>
        </div>

        {/* Phase dots */}
        <div className="flex justify-center gap-2">
          {PHASES.map((_, i) => (
            <div key={i} className="rounded-full transition-all duration-400"
                 style={{
                   width:      i === phaseIdx ? '24px' : '8px',
                   height:     '8px',
                   background: i <= phaseIdx ? '#6366f1' : 'rgba(255,255,255,0.12)',
                 }} />
          ))}
        </div>

        {/* Sub-text */}
        <p className="text-center text-slate-500 text-xs mt-5">
          Skills, CGPA, experience & projects are being extracted
        </p>

        {/* Dev shortcut — hidden in production */}
        {import.meta.env.DEV && (
          <button onClick={handleDone}
            className="mt-4 w-full text-xs text-slate-600 hover:text-slate-400 transition-colors">
            [DEV] Simulate complete
          </button>
        )}
      </div>

      {/* Keyframe for spin (inline since it's component-local) */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
