import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  UploadCloud, FileText, Zap, Trophy, TrendingUp,
  Briefcase, CheckCircle, Loader2, RefreshCw, ChevronRight,
  Info, GraduationCap, Building2, X, BookOpen, Award,
  Target, LayoutDashboard, BarChart2, Lightbulb,
  Star, Clock, ExternalLink, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';
import CircularProgress from '../../components/CircularProgress';
import { cn } from '../../lib/cn';

// =============================================================================
// Types
// =============================================================================
interface StudentProfile {
  firstName:       string;
  lastName:        string;
  college:         string;
  cgpa:            number;
  experienceYears: number;
  resumeUrl:       string | null;
  parsedSkills:    string[];
}

interface MatchedJob {
  matchScore: number;
  hasApplied: boolean;
  job: {
    id:             string;
    title:          string;
    description:    string;
    requiredSkills: string[];
    minCgpa:        number;
    minExperience:  number;
    isActive?:      boolean;
    createdAt?:     string;
    recruiter?: {
      recruiterProfile?: { companyName: string; designation: string } | null;
    };
  };
}

type ActiveView = 'dashboard' | 'matches' | 'skill-development' | 'documents' | 'analysis';

// =============================================================================
// Frontend Skill Alias Map — mirrors backend matcher.service.ts
// =============================================================================
const FRONTEND_SKILL_ALIASES: Record<string, string> = {
  'dsa': 'data structures and algorithms', 'data structures': 'data structures and algorithms',
  'data structure': 'data structures and algorithms', 'algorithms': 'data structures and algorithms',
  'ds & algorithms': 'data structures and algorithms', 'oop': 'object-oriented programming',
  'oops': 'object-oriented programming', 'object oriented programming': 'object-oriented programming',
  'object-oriented': 'object-oriented programming', 'os': 'operating system',
  'operating systems': 'operating system', 'dbms': 'database management system',
  'database management': 'database management system', 'cn': 'computer networks',
  'computer networking': 'computer networks', 'networking': 'computer networks',
  'ml': 'machine learning', 'dl': 'deep learning', 'ai': 'artificial intelligence',
  'nlp': 'natural language processing', 'cv': 'computer vision', 'computer-vision': 'computer vision',
  'cicd': 'ci cd', 'ci/cd': 'ci cd', 'restapi': 'rest api', 'rest apis': 'rest api',
  'restful': 'rest api', 'restful api': 'rest api', 'restful apis': 'rest api', 'rest': 'rest api',
  'js': 'javascript', 'ts': 'typescript', 'reactjs': 'react', 'react.js': 'react',
  'vuejs': 'vue.js', 'vue': 'vue.js', 'angularjs': 'angular', 'nodejs': 'node.js',
  'node js': 'node.js', 'nextjs': 'next.js', 'next js': 'next.js', 'expressjs': 'express',
  'express.js': 'express', 'postgres': 'postgresql', 'mongo': 'mongodb',
  'gcp': 'google cloud platform', 'google cloud': 'google cloud platform',
  'k8s': 'kubernetes', 'kube': 'kubernetes', 'sklearn': 'scikit-learn',
  'scikit learn': 'scikit-learn', 'tf': 'tensorflow', 'torch': 'pytorch',
};

function normalizeSkillFrontend(s: string): string {
  const lower = s.toLowerCase().trim();
  return FRONTEND_SKILL_ALIASES[lower] ?? lower;
}

function analyzeSkillGap(required: string[], studentSkills: string[]) {
  const studentNormalized = new Set(studentSkills.map(s => normalizeSkillFrontend(s)));
  const matched: string[] = [];
  const missing: string[] = [];
  required.forEach(skill => {
    (studentNormalized.has(normalizeSkillFrontend(skill)) ? matched : missing).push(skill);
  });
  return { matched, missing };
}

// =============================================================================
// Skill Advice Map
// =============================================================================
const SKILL_ADVICE: Record<string, string> = {
  'data structures and algorithms': 'Practice on LeetCode — start with NeetCode 150 roadmap. Target 2–3 problems/day.',
  'react': 'Build a portfolio project: todo-app → weather dashboard → e-commerce. Official docs + Scrimba React cover 90% of interviews.',
  'node.js': 'Build a REST API with Express + MongoDB. Add JWT authentication to stand out.',
  'rest api': 'Create a CRUD API with Node.js + Express. Document with Postman/Swagger.',
  'express': 'Build 2–3 REST APIs. Middleware, routing, and error handling are the key interview topics.',
  'python': 'Complete Python basics on freeCodeCamp, then build a web scraper or data analysis script with pandas.',
  'machine learning': 'Start with Andrew Ng\'s ML Specialization on Coursera. Build a classification project with scikit-learn.',
  'deep learning': 'Complete fast.ai\'s Practical Deep Learning. Build an image classifier using PyTorch or TensorFlow.',
  'docker': 'Complete Docker\'s official "Get Started" guide (2 hrs). Containerize one of your existing projects.',
  'kubernetes': 'After Docker, do the official Kubernetes Basics tutorial. Focus on Pods, Services, and Deployments.',
  'ci cd': 'Set up a GitHub Actions pipeline: lint → test → build. This is a top hiring differentiator.',
  'sql': 'Complete SQLZoo or Mode Analytics SQL Tutorial. Practice JOINs, GROUP BY, and window functions.',
  'postgresql': 'Install Postgres locally, design a schema for a real project, practice complex queries and indexing.',
  'mongodb': 'Build a CRUD app with Mongoose + Express. Understand schema design and aggregation pipelines.',
  'typescript': 'Convert one of your JavaScript projects to TypeScript. Focus on interfaces, generics, and strict mode.',
  'javascript': 'Master async/await, closures, prototypes, and the event loop.',
  'java': 'Practice OOP design patterns (Singleton, Factory, Observer). These appear in almost every Java interview.',
  'spring': 'Build a Spring Boot REST API with JPA/Hibernate. Add Spring Security for authentication.',
  'aws': 'Get the AWS Cloud Practitioner certification. Set up an EC2 + S3 project.',
  'google cloud platform': 'Complete Google Cloud Skills Boost free labs. Build a basic Cloud Run deployment.',
  'system design': 'Study Grokking the System Design Interview. Practice designing URL shortener and Twitter feed.',
  'object-oriented programming': 'Study the SOLID principles and implement design patterns in your primary language.',
  'git': 'Practice branching strategies (GitFlow), pull requests, and conflict resolution.',
  'computer networks': 'Study OSI model, TCP/IP, HTTP/HTTPS, DNS, and sockets.',
  'operating system': 'Focus on process management, memory management, deadlocks, and threading.',
  'database management system': 'Study normalization (1NF–3NF–BCNF), ACID properties, transactions, and indexing.',
  'tensorflow': 'Complete TensorFlow\'s official tutorials. Build a CNN for image classification.',
  'pytorch': 'Complete fast.ai\'s PyTorch course. Build a custom neural network from scratch.',
  'scikit-learn': 'Build end-to-end ML pipelines: preprocessing → training → evaluation → tuning.',
  'next.js': 'Build a full-stack app using Next.js App Router with server components and API routes.',
  'graphql': 'Add a GraphQL API using Apollo Server. Compare REST vs GraphQL in your project README.',
  'redis': 'Implement caching and session management with Redis in a Node.js app.',
};

// =============================================================================
// SVG Radar Chart
// =============================================================================
function RadarChart({ values, size = 180 }: { values: { label: string; value: number }[]; size?: number }) {
  const center = size / 2;
  const maxR   = center - 28;
  const n      = values.length;

  const toXY = (i: number, pct: number) => {
    const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
    return { x: center + pct * maxR * Math.cos(angle), y: center + pct * maxR * Math.sin(angle) };
  };

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const dataPoints = values.map((v, i) => toXY(i, v.value / 100));
  const polygon    = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {/* Grid rings */}
      {gridLevels.map(level => {
        const pts = values.map((_, i) => { const p = toXY(i, level); return `${p.x},${p.y}`; }).join(' ');
        return <polygon key={level} points={pts} fill="none" stroke="#e2e8f0" strokeWidth="1" />;
      })}
      {/* Axis lines */}
      {values.map((_, i) => {
        const p = toXY(i, 1);
        return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth="1" />;
      })}
      {/* Data fill */}
      <polygon points={polygon} fill="rgba(99,102,241,0.15)" stroke="#6366f1" strokeWidth="2" className="radar-polygon" />
      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="#6366f1" stroke="white" strokeWidth="2" className="score-glow" />
      ))}
      {/* Labels */}
      {values.map((v, i) => {
        const lp = toXY(i, 1.22);
        return (
          <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fontWeight="600" fill="#64748b" fontFamily="Inter, sans-serif">
            {v.label}
          </text>
        );
      })}
    </svg>
  );
}

// =============================================================================
// StudentDashboard
// =============================================================================
export default function StudentDashboard() {

  // ── State ──────────────────────────────────────────────────────────────────
  const [profile,        setProfile]        = useState<StudentProfile | null>(null);
  const [matches,        setMatches]        = useState<MatchedJob[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [uploading,      setUploading]      = useState(false);
  const [applying,       setApplying]       = useState<string | null>(null);
  const [appliedJobs,    setAppliedJobs]    = useState<Set<string>>(new Set());
  const [dragOver,       setDragOver]       = useState(false);
  const [selectedJob,    setSelectedJob]    = useState<MatchedJob | null>(null);
  const [activeView,     setActiveView]     = useState<ActiveView>('dashboard');
  const [matchFilter,    setMatchFilter]    = useState<'all' | 'eligible' | 'applied'>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Fetchers ───────────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: StudentProfile }>('/student/profile');
      setProfile(data.data);
    } catch { /* 404 = not yet created */ } finally { setLoadingProfile(false); }
  }, []);

  const fetchMatches = useCallback(async () => {
    setLoadingMatches(true);
    try {
      const { data } = await api.get<{ data: MatchedJob[] }>('/eligibility/matches');
      const fetched  = data.data ?? [];
      setMatches(fetched);
      setAppliedJobs(new Set(fetched.filter(m => m.hasApplied).map(m => m.job.id)));
    } catch { /* silently fail */ } finally { setLoadingMatches(false); }
  }, []);

  useEffect(() => { void fetchProfile(); void fetchMatches(); }, [fetchProfile, fetchMatches]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleUpload = async (file: File) => {
    if (file.type !== 'application/pdf') { toast.error('Please upload a PDF file.'); return; }
    if (file.size > 5 * 1024 * 1024)    { toast.error('File size must be under 5 MB.'); return; }
    setUploading(true);
    const form = new FormData();
    form.append('resume', file);
    try {
      await api.post('/student/resume', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Resume uploaded & parsed! ✨');
      await fetchProfile(); await fetchMatches();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Upload failed.');
    } finally { setUploading(false); }
  };

  const handleApply = async (jobId: string, jobTitle: string) => {
    setApplying(jobId);
    try {
      await api.post(`/eligibility/apply/${jobId}`);
      toast.success(`Successfully applied to "${jobTitle}"! 🎉`);
      setAppliedJobs(prev => new Set(prev).add(jobId));
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Application failed.');
    } finally { setApplying(null); }
  };

  // ── Computed: Skill Mastery ────────────────────────────────────────────────
  const skillMastery = useMemo(() => {
    if (!profile?.parsedSkills.length) return [];
    return profile.parsedSkills.slice(0, 7).map(skill => {
      const normalized = normalizeSkillFrontend(skill);
      const demandCount = matches.filter(m => m.job.requiredSkills.some(s => normalizeSkillFrontend(s) === normalized)).length;
      const pct = matches.length > 0 ? Math.max(8, Math.round((demandCount / matches.length) * 100)) : 70;
      return { skill, pct };
    }).sort((a, b) => b.pct - a.pct);
  }, [profile, matches]);

  // ── Computed: Skill Development data ──────────────────────────────────────
  const skillDevData = useMemo(() => {
    if (!profile || !matches.length) return { missing: [], have: [] };
    const missingFreq: Record<string, number> = {};
    matches.forEach(m => {
      analyzeSkillGap(m.job.requiredSkills, profile.parsedSkills).missing.forEach(s => {
        const k = s.toLowerCase();
        missingFreq[k] = (missingFreq[k] ?? 0) + 1;
      });
    });
    const missing = Object.entries(missingFreq)
      .map(([skill, count]) => ({
        skill, count,
        jobsPct: Math.round((count / matches.length) * 100),
        advice: SKILL_ADVICE[skill] ?? `Build a hands-on project demonstrating ${skill} and document it on GitHub.`,
      }))
      .sort((a, b) => b.count - a.count);
    return { missing };
  }, [profile, matches]);

  // ── Computed: Analysis data ────────────────────────────────────────────────
  const analysisData = useMemo(() => {
    if (!profile) return null;
    const totalRequired = matches.reduce((s, m) => s + m.job.requiredSkills.length, 0);
    const totalMatched  = matches.reduce((s, m) => s + analyzeSkillGap(m.job.requiredSkills, profile.parsedSkills).matched.length, 0);
    const skillMatchPct = totalRequired > 0 ? Math.round((totalMatched / totalRequired) * 100) : 0;
    const cgpaPct       = Math.min(100, Math.round((profile.cgpa / 10) * 100));
    const maxExpReq     = matches.length > 0 ? Math.max(...matches.map(m => m.job.minExperience)) : 1;
    const expPct        = maxExpReq > 0 ? Math.min(100, Math.round(((profile.experienceYears + 0.5) / Math.max(maxExpReq, 1)) * 100)) : 75;
    const appliedCount  = appliedJobs.size;
    const topScore      = matches[0]?.matchScore ?? 0;
    const overallScore  = Math.round((skillMatchPct * 0.5) + (cgpaPct * 0.3) + (expPct * 0.2));

    const rec = overallScore >= 75
      ? 'Excellent profile. You are highly competitive for most available roles. Apply confidently.'
      : overallScore >= 55
      ? 'Strong profile. Focus on 2–3 missing skills to unlock significantly more opportunities.'
      : overallScore >= 35
      ? 'Developing profile. Prioritize building the top missing skills shown in Skill Development.'
      : 'Early stage. Upload an updated resume with more technical skills to improve match rate.';

    return { skillMatchPct, cgpaPct, expPct, appliedCount, topScore, overallScore, recommendation: rec,
      appliedJobs: matches.filter(m => appliedJobs.has(m.job.id)) };
  }, [profile, matches, appliedJobs]);

  const displayName   = profile ? `${profile.firstName}${profile.lastName ? ' ' + profile.lastName : ''}`.trim() : 'Student';
  const eligibleCount = matches.filter(m => m.matchScore >= 50).length;

  const filteredMatches = useMemo(() => {
    if (matchFilter === 'eligible') return matches.filter(m => m.matchScore >= 50);
    if (matchFilter === 'applied')  return matches.filter(m => appliedJobs.has(m.job.id));
    return matches;
  }, [matches, matchFilter, appliedJobs]);

  // ── Sidebar nav config ─────────────────────────────────────────────────────
  const navItems: { view: ActiveView; icon: React.ReactNode; label: string }[] = [
    { view: 'dashboard',        icon: <LayoutDashboard size={15} />, label: 'Dashboard'         },
    { view: 'matches',          icon: <Briefcase size={15} />,       label: 'Job Matches'        },
    { view: 'skill-development',icon: <Target size={15} />,          label: 'Skill Development'  },
    { view: 'documents',        icon: <FileText size={15} />,        label: 'Documents'          },
    { view: 'analysis',         icon: <BarChart2 size={15} />,       label: 'My Analysis'        },
  ];

  return (
    <div className="flex gap-6 items-start w-full">

      {/* ══════════════════════════════════════════════════════════════════════
          LEFT SIDEBAR
      ══════════════════════════════════════════════════════════════════════ */}
      <aside className="w-56 shrink-0 hidden lg:flex flex-col gap-3 sticky top-24 self-start animate-slide-in-left">

        {/* Profile card */}
        <div className="enterprise-card p-5 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600
                          flex items-center justify-center shadow-md ring-4 ring-indigo-100">
            <span className="text-white font-black text-xl">
              {profile?.firstName?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          {loadingProfile ? (
            <div className="space-y-2 w-full">
              <div className="skeleton h-3.5 w-24 mx-auto" />
              <div className="skeleton h-3 w-32 mx-auto" />
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-bold text-slate-900">{displayName}</p>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[180px]">{profile?.college ?? 'College not set'}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                  CGPA {profile?.cgpa.toFixed(1) ?? '—'}
                </span>
                <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full border border-slate-200">
                  {profile?.experienceYears ?? 0} yrs
                </span>
              </div>
              <div className={cn(
                'w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold',
                profile?.resumeUrl ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                   : 'bg-red-50 text-red-600 border border-red-100',
              )}>
                {profile?.resumeUrl ? <><CheckCircle size={11} /> Resume Active</> : <><UploadCloud size={11} /> No Resume</>}
              </div>
            </>
          )}
        </div>

        {/* Nav */}
        <div className="enterprise-card p-2 flex flex-col gap-0.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1.5">Navigation</p>
          {navItems.map(({ view, icon, label }) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={cn('nav-item w-full text-left', activeView === view && 'active')}
            >
              <span className="nav-icon text-slate-400">{icon}</span>
              <span>{label}</span>
              {view === 'matches' && matches.length > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">
                  {matches.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Upload CTA */}
        <button
          onClick={() => { setActiveView('documents'); fileRef.current?.click(); }}
          disabled={uploading}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-indigo-600 text-white
                     text-sm font-bold rounded-xl hover:bg-indigo-700 active:scale-[0.97] transition-all
                     shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
          {uploading ? 'Parsing…' : profile?.resumeUrl ? 'Update Resume' : 'Upload Resume'}
        </button>

        <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void handleUpload(f); e.target.value = ''; }} />
      </aside>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN CONTENT — view switcher
      ══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 min-w-0">

        {/* ─── VIEW: DASHBOARD ─────────────────────────────────────────────── */}
        {activeView === 'dashboard' && (
          <div className="space-y-5 animate-view-enter">
            {/* Header */}
            <div className="section-header">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">Student Talent Hub</h1>
                  <p className="text-slate-500 mt-0.5 text-sm">Welcome back, <span className="font-semibold text-slate-700">{displayName}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  {profile && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
                      <CheckCircle size={14} className="text-emerald-600" />
                      <span className="text-xs font-semibold text-emerald-700">Profile Active</span>
                    </div>
                  )}
                  <button onClick={() => void fetchMatches()} disabled={loadingMatches}
                    className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <RefreshCw size={15} className={loadingMatches ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {loadingProfile ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="stat-card"><div className="skeleton h-3.5 w-20 mb-4" /><div className="skeleton h-8 w-14 mb-1" /><div className="skeleton h-3 w-24" /></div>
              )) : [
                { label: 'Skills Parsed', value: profile?.parsedSkills.length ?? 0, sub: 'from your resume', icon: <Zap size={18} className="text-indigo-600" />, bg: 'bg-indigo-50' },
                { label: 'Job Matches',   value: matches.length,  sub: `${eligibleCount} eligible`, icon: <Trophy size={18} className="text-emerald-600" />, bg: 'bg-emerald-50' },
                { label: 'Top Score',     value: matches[0] ? `${matches[0].matchScore}%` : '—', sub: 'best AI match', icon: <TrendingUp size={18} className="text-violet-600" />, bg: 'bg-violet-50' },
              ].map(({ label, value, sub, icon, bg }, i) => (
                <div key={label} className={cn('stat-card animate-view-enter', i === 0 && 'stagger-1', i === 1 && 'stagger-2', i === 2 && 'stagger-3')}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
                    <div className={cn('p-2 rounded-lg', bg)}>{icon}</div>
                  </div>
                  <p className="text-3xl font-black text-slate-900 mb-0.5 animate-count">{value}</p>
                  <p className="text-xs text-slate-400 font-medium">{sub}</p>
                </div>
              ))}
            </div>

            {/* Profile overview + Skill mastery */}
            {profile && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="enterprise-card p-5 animate-view-enter stagger-2">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                    <GraduationCap size={13} className="text-indigo-400" />Profile Overview
                  </h2>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: 'CGPA',    value: profile.cgpa.toFixed(1),          accent: 'text-indigo-700' },
                      { label: 'Exp.',    value: `${profile.experienceYears} yrs`,  accent: 'text-slate-800' },
                      { label: 'Resume',  value: profile.resumeUrl ? 'Active ✓' : 'Missing ✗', accent: profile.resumeUrl ? 'text-emerald-700' : 'text-red-600' },
                    ].map(({ label, value, accent }) => (
                      <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-center">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">{label}</p>
                        <p className={cn('text-sm font-black truncate', accent)}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 mb-4">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5 font-semibold">College</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{profile.college}</p>
                  </div>
                  {profile.parsedSkills.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-2 font-bold flex items-center gap-1"><Zap size={10} className="text-indigo-400" />Parsed Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {profile.parsedSkills.slice(0, 12).map(skill => (
                          <span key={skill} className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-semibold rounded-md">{skill}</span>
                        ))}
                        {profile.parsedSkills.length > 12 && <span className="text-xs text-slate-400 font-medium self-center">+{profile.parsedSkills.length - 12} more</span>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Skill Mastery */}
                <div className="enterprise-card p-5 animate-view-enter stagger-3">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <BarChart2 size={13} className="text-indigo-400" />Skill Mastery
                  </h2>
                  <p className="text-[10px] text-slate-400 mb-4">% of available jobs requiring each skill</p>
                  {skillMastery.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-28 text-center">
                      <UploadCloud size={28} className="text-slate-300 mb-2" /><p className="text-sm text-slate-400">Upload resume to see skill demand</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {skillMastery.map(({ skill, pct }, i) => (
                        <div key={skill} className={cn('animate-view-enter', `stagger-${Math.min(i + 1, 6)}`)}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-semibold text-slate-700 capitalize truncate max-w-[70%]">{skill}</span>
                            <span className="text-xs font-bold text-indigo-600 ml-2">{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full skill-bar-fill', pct >= 70 ? 'bg-gradient-to-r from-indigo-500 to-violet-500' : pct >= 40 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-amber-400 to-orange-400')}
                              style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick match preview */}
            <div className="enterprise-card p-6 animate-view-enter stagger-4">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Briefcase size={15} className="text-indigo-500" />Job Match Feed
                  {matches.length > 0 && <span className="ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">{matches.length}</span>}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg uppercase tracking-wide">AI Match</span>
                  {matches.length > 3 && (
                    <button onClick={() => setActiveView('matches')} className="text-xs text-indigo-600 font-semibold hover:underline underline-offset-2">View All →</button>
                  )}
                </div>
              </div>
              <JobMatchList matches={matches.slice(0, 3)} profile={profile} loadingMatches={loadingMatches} appliedJobs={appliedJobs} applying={applying} onApply={handleApply} onViewDetails={setSelectedJob} />
            </div>
          </div>
        )}

        {/* ─── VIEW: JOB MATCHES ───────────────────────────────────────────── */}
        {activeView === 'matches' && (
          <div className="space-y-5 animate-view-enter">
            <div className="section-header">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">Job Matches</h1>
                  <p className="text-slate-500 mt-0.5 text-sm">AI-ranked roles based on your skills, CGPA and experience</p>
                </div>
                <button onClick={() => void fetchMatches()} disabled={loadingMatches}
                  className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                  <RefreshCw size={15} className={loadingMatches ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit border border-slate-200">
              {([['all', 'All'], ['eligible', `Eligible (${eligibleCount})`], ['applied', `Applied (${appliedJobs.size})`]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setMatchFilter(key)}
                  className={cn('px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200',
                    matchFilter === key ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100' : 'text-slate-500 hover:text-slate-700')}>
                  {label}
                </button>
              ))}
            </div>

            <JobMatchList matches={filteredMatches} profile={profile} loadingMatches={loadingMatches} appliedJobs={appliedJobs} applying={applying} onApply={handleApply} onViewDetails={setSelectedJob} showAll />
          </div>
        )}

        {/* ─── VIEW: SKILL DEVELOPMENT ─────────────────────────────────────── */}
        {activeView === 'skill-development' && (
          <div className="space-y-5 animate-view-enter">
            <div className="section-header">
              <h1 className="text-2xl font-black text-slate-900">Skill Development</h1>
              <p className="text-slate-500 mt-0.5 text-sm">
                Prioritised learning roadmap based on {matches.length} available job{matches.length !== 1 ? 's' : ''}
              </p>
            </div>

            {!profile ? (
              <div className="enterprise-card p-12 text-center">
                <UploadCloud size={36} className="text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-slate-700">Upload your resume first</p>
                <p className="text-slate-400 text-sm mt-1">We need your parsed skills to generate a roadmap</p>
                <button onClick={() => fileRef.current?.click()} className="btn-primary mt-4">Upload Resume</button>
              </div>
            ) : skillDevData.missing.length === 0 && matches.length === 0 ? (
              <div className="enterprise-card p-12 text-center">
                <Briefcase size={36} className="text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-slate-700">No job matches to analyse yet</p>
                <p className="text-slate-400 text-sm mt-1">Job matches drive the skill gap analysis</p>
              </div>
            ) : skillDevData.missing.length === 0 ? (
              <div className="enterprise-card p-8 text-center border-emerald-200 bg-emerald-50">
                <CheckCircle size={36} className="text-emerald-500 mx-auto mb-3" />
                <p className="font-bold text-emerald-800 text-lg">You cover all required skills! 🎉</p>
                <p className="text-emerald-700 text-sm mt-1">Your resume matches every required skill across all available jobs.</p>
              </div>
            ) : (
              <>
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Skills to Build', value: skillDevData.missing.length, icon: <Target size={18} className="text-red-500" />, bg: 'bg-red-50' },
                    { label: 'Skills You Have', value: profile.parsedSkills.length, icon: <CheckCircle size={18} className="text-emerald-600" />, bg: 'bg-emerald-50' },
                    { label: 'Top Priority',    value: skillDevData.missing[0]?.skill ?? '—', icon: <Star size={18} className="text-amber-500" />, bg: 'bg-amber-50', small: true },
                  ].map(({ label, value, icon, bg, small }) => (
                    <div key={label} className="stat-card animate-view-enter">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
                        <div className={cn('p-2 rounded-lg', bg)}>{icon}</div>
                      </div>
                      <p className={cn('font-black text-slate-900 mb-0.5', small ? 'text-base capitalize truncate' : 'text-3xl')}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Missing skills list */}
                <div className="enterprise-card p-6">
                  <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-5">
                    <Lightbulb size={15} className="text-amber-500" />
                    Skills to Build — Prioritised by Market Demand
                  </h2>
                  <div className="space-y-4">
                    {skillDevData.missing.map(({ skill, jobsPct, advice }, i) => (
                      <div key={skill} className={cn('border border-slate-200 rounded-xl p-5 hover:border-indigo-200 hover:shadow-card transition-all duration-200 animate-view-enter', `stagger-${Math.min(i + 1, 6)}`)}>
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-3">
                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white',
                              i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : i <= 4 ? 'bg-amber-500' : 'bg-slate-400')}>
                              #{i + 1}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 capitalize">{skill}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{Math.round((jobsPct / 100) * matches.length)} of {matches.length} jobs require this</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-black text-indigo-600">{jobsPct}%</p>
                            <p className="text-[10px] text-slate-400 font-medium">demand</p>
                          </div>
                        </div>

                        {/* Demand bar */}
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                          <div className={cn('h-full rounded-full skill-bar-fill',
                            jobsPct >= 70 ? 'bg-gradient-to-r from-red-500 to-red-400'
                            : jobsPct >= 40 ? 'bg-gradient-to-r from-orange-400 to-amber-400'
                            : 'bg-gradient-to-r from-slate-400 to-slate-300')}
                            style={{ width: `${jobsPct}%` }} />
                        </div>

                        {/* Advice */}
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-start gap-2">
                          <Lightbulb size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-slate-600 leading-relaxed">{advice}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Existing skills */}
                {profile.parsedSkills.length > 0 && (
                  <div className="enterprise-card p-5">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                      <CheckCircle size={13} className="text-emerald-500" />Your Existing Skills
                    </h2>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.parsedSkills.map(skill => (
                        <span key={skill} className="skill-matched">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ─── VIEW: DOCUMENTS ─────────────────────────────────────────────── */}
        {activeView === 'documents' && (
          <div className="space-y-5 animate-view-enter">
            <div className="section-header">
              <h1 className="text-2xl font-black text-slate-900">Documents</h1>
              <p className="text-slate-500 mt-0.5 text-sm">Manage your resume — the AI parses it on every upload</p>
            </div>

            {/* Status card */}
            {profile?.resumeUrl && (
              <div className="enterprise-card p-5 border-emerald-200 bg-emerald-50 animate-view-enter">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <FileText size={20} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-bold text-emerald-900">Resume Uploaded</p>
                      <p className="text-sm text-emerald-700 mt-0.5">
                        {profile.parsedSkills.length} skills parsed successfully
                      </p>
                    </div>
                  </div>
                  <a href={profile.resumeUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 bg-white border border-emerald-200 text-emerald-700
                               text-xs font-bold rounded-xl hover:bg-emerald-100 transition-colors flex-shrink-0">
                    <ExternalLink size={13} />View Resume
                  </a>
                </div>
              </div>
            )}

            {/* Upload dropzone */}
            <div className="enterprise-card p-6 animate-view-enter stagger-2">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                <UploadCloud size={15} className="text-indigo-500" />
                {profile?.resumeUrl ? 'Replace Resume' : 'Upload Resume'}
              </h2>
              <div
                onClick={() => !uploading && fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) void handleUpload(f); }}
                className={cn(
                  'border-2 border-dashed rounded-2xl p-14 flex flex-col items-center gap-4 cursor-pointer transition-all duration-300',
                  uploading ? 'border-indigo-300 bg-indigo-50/50 cursor-not-allowed'
                  : dragOver  ? 'border-indigo-500 bg-indigo-50 scale-[1.01] shadow-lg'
                  : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/30 hover:scale-[1.005]',
                )}
              >
                {uploading ? (
                  <>
                    <Loader2 size={40} className="text-indigo-500 animate-spin" />
                    <div className="text-center">
                      <p className="text-indigo-700 font-bold text-base">Uploading & Parsing…</p>
                      <p className="text-indigo-400 text-sm mt-1">AI is extracting your skills</p>
                    </div>
                  </>
                ) : dragOver ? (
                  <>
                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center animate-scale-in">
                      <UploadCloud size={32} className="text-indigo-600" />
                    </div>
                    <p className="text-indigo-700 font-bold text-base">Drop to upload!</p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                      <UploadCloud size={32} className="text-slate-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-slate-700 font-semibold text-base">Drop your PDF here</p>
                      <p className="text-slate-500 text-sm mt-1">
                        or <span className="text-indigo-600 font-bold underline underline-offset-2">click to browse</span>
                      </p>
                      <p className="text-slate-400 text-xs mt-2">PDF only · Max 5 MB · AI skill extraction</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Parsed skills summary */}
            {profile?.parsedSkills && profile.parsedSkills.length > 0 && (
              <div className="enterprise-card p-5 animate-view-enter stagger-3">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <Zap size={13} className="text-indigo-400" />AI-Parsed Skills ({profile.parsedSkills.length} found)
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {profile.parsedSkills.map(skill => (
                    <span key={skill} className="skill-matched">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Tip */}
            <div className="enterprise-card p-4 border-amber-200 bg-amber-50 animate-view-enter stagger-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-900">For best results</p>
                  <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                    Use a text-based PDF (not a scanned image). Include a clear skills section listing tools, languages, and frameworks. Avoid tables in skill sections — plain text extracts most accurately.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── VIEW: ANALYSIS ──────────────────────────────────────────────── */}
        {activeView === 'analysis' && (
          <div className="space-y-5 animate-view-enter">
            <div className="section-header">
              <h1 className="text-2xl font-black text-slate-900">Detailed Candidate Analysis</h1>
              <p className="text-slate-500 mt-0.5 text-sm">In-depth profile breakdown — your competitive positioning</p>
            </div>

            {!profile || !analysisData ? (
              <div className="enterprise-card p-12 text-center">
                <BarChart2 size={36} className="text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-slate-700">Upload resume to unlock analysis</p>
                <p className="text-slate-400 text-sm mt-1">We need your profile data to generate this report</p>
                <button onClick={() => { setActiveView('documents'); fileRef.current?.click(); }} className="btn-primary mt-4">Upload Resume</button>
              </div>
            ) : (
              <>
                {/* Top hero: score + recommendation */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                  {/* Overall score card */}
                  <div className="enterprise-card p-6 flex flex-col items-center text-center gap-4 animate-view-enter stagger-1">
                    <div className="relative">
                      <CircularProgress score={analysisData.overallScore} size={110} stroke={9} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Overall AI Score</p>
                      <p className={cn('text-base font-black mt-1',
                        analysisData.overallScore >= 75 ? 'text-emerald-700'
                        : analysisData.overallScore >= 55 ? 'text-amber-700' : 'text-red-600')}>
                        {analysisData.overallScore >= 75 ? 'Excellent' : analysisData.overallScore >= 55 ? 'Good' : analysisData.overallScore >= 35 ? 'Developing' : 'Early Stage'}
                      </p>
                    </div>
                    <div className="w-full text-left space-y-2 pt-3 border-t border-slate-100">
                      {[
                        { label: 'Skills Match',  value: analysisData.skillMatchPct },
                        { label: 'CGPA Score',    value: analysisData.cgpaPct },
                        { label: 'Experience',    value: analysisData.expPct },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-slate-500 font-medium">{label}</span>
                            <span className="font-bold text-indigo-600">{value}%</span>
                          </div>
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full skill-bar-fill" style={{ width: `${value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Radar chart */}
                  <div className="enterprise-card p-6 flex flex-col items-center gap-4 animate-view-enter stagger-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest self-start">Skill Radar</p>
                    <RadarChart size={190} values={[
                      { label: 'Skills',      value: analysisData.skillMatchPct },
                      { label: 'CGPA',        value: analysisData.cgpaPct },
                      { label: 'Experience',  value: analysisData.expPct },
                      { label: 'Applications',value: Math.min(100, analysisData.appliedCount * 20) },
                    ]} />
                    <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                      Radar shows your strength across 4 dimensions relative to job requirements
                    </p>
                  </div>

                  {/* Quick stats */}
                  <div className="flex flex-col gap-3 animate-view-enter stagger-3">
                    {[
                      { label: 'Top Match Score',   value: `${analysisData.topScore}%`, icon: <Trophy size={16} className="text-indigo-600" />,   bg: 'bg-indigo-50' },
                      { label: 'Jobs Applied',       value: analysisData.appliedCount,   icon: <CheckCircle size={16} className="text-emerald-600" />, bg: 'bg-emerald-50' },
                      { label: 'Skills Parsed',      value: profile.parsedSkills.length,  icon: <Zap size={16} className="text-violet-600" />,       bg: 'bg-violet-50' },
                      { label: 'Skills to Build',    value: skillDevData.missing.length,   icon: <Target size={16} className="text-amber-600" />,      bg: 'bg-amber-50' },
                    ].map(({ label, value, icon, bg }) => (
                      <div key={label} className="enterprise-card p-4 flex items-center gap-4">
                        <div className={cn('p-2.5 rounded-xl flex-shrink-0', bg)}>{icon}</div>
                        <div>
                          <p className="text-xl font-black text-slate-900">{value}</p>
                          <p className="text-xs text-slate-400 font-medium">{label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendation banner */}
                <div className={cn('enterprise-card p-5 flex items-start gap-4 animate-view-enter stagger-4',
                  analysisData.overallScore >= 75 ? 'border-emerald-200 bg-emerald-50'
                  : analysisData.overallScore >= 55 ? 'border-amber-200 bg-amber-50'
                  : 'border-red-200 bg-red-50')}>
                  <div className={cn('p-2.5 rounded-xl flex-shrink-0',
                    analysisData.overallScore >= 75 ? 'bg-emerald-100' : analysisData.overallScore >= 55 ? 'bg-amber-100' : 'bg-red-100')}>
                    <Star size={18} className={analysisData.overallScore >= 75 ? 'text-emerald-600' : analysisData.overallScore >= 55 ? 'text-amber-600' : 'text-red-500'} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Overall Recommendation</p>
                    <p className="text-sm text-slate-700 mt-1 leading-relaxed">{analysisData.recommendation}</p>
                  </div>
                </div>

                {/* Applied jobs timeline */}
                {analysisData.appliedJobs.length > 0 && (
                  <div className="enterprise-card p-6 animate-view-enter stagger-5">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-1.5">
                      <Clock size={13} className="text-indigo-400" />Application Timeline
                    </h2>
                    <div className="relative pl-5">
                      {/* Vertical line */}
                      <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-300 to-slate-200 rounded-full" />
                      <div className="space-y-5">
                        {analysisData.appliedJobs.map(({ job, matchScore }, i) => (
                          <div key={job.id} className={cn('relative flex items-start gap-4 animate-view-enter', `stagger-${Math.min(i + 1, 6)}`)}>
                            {/* Timeline dot */}
                            <div className="absolute -left-[18px] top-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white shadow-sm timeline-dot" />
                            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 hover:border-indigo-200 hover:shadow-card transition-all duration-200">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-bold text-slate-900 text-sm">{job.title}</p>
                                  {job.recruiter?.recruiterProfile && (
                                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                      <Building2 size={10} />{job.recruiter.recruiterProfile.companyName}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                                    {matchScore}% match
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Applied ✓
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Skill comparison table */}
                <div className="enterprise-card p-6 animate-view-enter stagger-6">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-1.5">
                    <BarChart2 size={13} className="text-indigo-400" />Skills Comparison — Your Profile vs. Job Requirements
                  </h2>
                  {matches.slice(0, 3).map(({ job, matchScore }) => {
                    const { matched, missing } = analyzeSkillGap(job.requiredSkills, profile.parsedSkills);
                    return (
                      <div key={job.id} className="mb-5 last:mb-0 pb-5 last:pb-0 border-b last:border-0 border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-bold text-slate-800 text-sm">{job.title}</p>
                          <span className="text-xs font-bold text-indigo-600">{matchScore}% match</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                          <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full skill-bar-fill"
                            style={{ width: `${Math.round((matched.length / Math.max(job.requiredSkills.length, 1)) * 100)}%` }} />
                        </div>
                        <p className="text-xs text-slate-500">{matched.length}/{job.requiredSkills.length} skills matched · {missing.length} to build</p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* ── Job Details Modal ────────────────────────────────────────────────── */}
      {selectedJob && (
        <JobDetailsModal
          match={selectedJob} profile={profile} applying={applying}
          appliedJobs={appliedJobs} onApply={handleApply}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Shared: JobMatchList
// =============================================================================
function JobMatchList({ matches, profile, loadingMatches, appliedJobs, applying, onApply, onViewDetails, showAll = false }: {
  matches: MatchedJob[]; profile: StudentProfile | null; loadingMatches: boolean;
  appliedJobs: Set<string>; applying: string | null;
  onApply: (id: string, title: string) => Promise<void>;
  onViewDetails: (m: MatchedJob) => void; showAll?: boolean;
}) {
  if (loadingMatches) return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="border border-slate-200 rounded-xl p-5">
          <div className="skeleton h-4 w-1/2 mb-3" /><div className="skeleton h-3 w-1/3" />
        </div>
      ))}
    </div>
  );

  if (matches.length === 0) return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Briefcase size={28} className="text-slate-400" />
      </div>
      <p className="font-semibold text-slate-700 text-base">No matches found</p>
      <p className="text-slate-400 text-sm mt-1">{!profile ? 'Upload your resume to start matching' : 'Try a different filter'}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {(showAll ? matches : matches).map(({ matchScore, job }, idx) => {
        const { matched, missing } = analyzeSkillGap(job.requiredSkills, profile?.parsedSkills ?? []);
        const isApplied = appliedJobs.has(job.id);
        const canApply  = matchScore >= 50 && !isApplied;

        return (
          <div key={job.id} className={cn('job-card flex flex-col gap-4 animate-view-enter', idx < 6 && `stagger-${Math.min(idx + 1, 6)}`)}>
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              {/* Score */}
              <div className="flex-shrink-0 flex flex-col items-center gap-1">
                <CircularProgress score={matchScore} size={72} stroke={7} />
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                  matchScore >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : matchScore >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-red-50 text-red-700 border border-red-200')}>
                  {matchScore >= 80 ? 'Excellent' : matchScore >= 50 ? 'Good Fit' : 'Low Match'}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-slate-900 text-base leading-snug mb-0.5">{job.title}</h3>
                {job.recruiter?.recruiterProfile && (
                  <p className="text-sm text-slate-500 mb-2 flex items-center gap-1.5">
                    <Building2 size={12} className="text-slate-400" />
                    <span className="font-semibold text-slate-700">{job.recruiter.recruiterProfile.companyName}</span>
                    <span className="text-slate-300">·</span>
                    <span>{job.recruiter.recruiterProfile.designation}</span>
                  </p>
                )}
                {job.description && (
                  <p className="text-xs text-slate-500 leading-relaxed mb-2 line-clamp-2">
                    {job.description.slice(0, 120)}{job.description.length > 120 ? '…' : ''}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-600">
                    Min CGPA: <span className="font-bold text-slate-800">{job.minCgpa}</span>
                  </span>
                  <span className="text-xs bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-600">
                    Exp: <span className="font-bold text-slate-800">{job.minExperience} yrs</span>
                  </span>
                  <button onClick={() => onViewDetails({ matchScore, hasApplied: isApplied, job })}
                    className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline underline-offset-2 transition-colors">
                    <BookOpen size={11} />View Full Details
                  </button>
                </div>
              </div>

              {/* Apply */}
              <button onClick={() => void onApply(job.id, job.title)}
                disabled={applying === job.id || !canApply}
                className={cn('flex-shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 w-full sm:w-auto',
                  isApplied ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed'
                  : canApply ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm active:scale-[0.97]'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200',
                  applying === job.id && 'opacity-70')}>
                {applying === job.id ? <Loader2 size={14} className="animate-spin" /> : isApplied ? <CheckCircle size={14} /> : <ChevronRight size={14} />}
                {isApplied ? 'Applied' : matchScore >= 50 ? 'Apply Now' : 'Below Threshold'}
              </button>
            </div>

            {/* Skill gap */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {matched.map(s => <span key={s} className="skill-matched">✓ {s}</span>)}
                {missing.map(s  => <span key={s} className="skill-missing">✗ {s}</span>)}
              </div>
              {missing.length === 0 && matched.length > 0 ? (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2">
                  <CheckCircle size={13} className="text-emerald-600 flex-shrink-0" />
                  <p className="text-xs font-bold text-emerald-800">Perfect Match — all {matched.length} skills covered!</p>
                </div>
              ) : missing.length > 0 ? (
                <div className={cn('rounded-xl p-4 space-y-2 border',
                  missing.length <= 2 ? 'bg-amber-50 border-amber-100' : missing.length <= 5 ? 'bg-orange-50 border-orange-100' : 'bg-red-50 border-red-100')}>
                  <div className="flex items-center gap-2">
                    <Info size={13} className={missing.length <= 2 ? 'text-amber-600' : missing.length <= 5 ? 'text-orange-600' : 'text-red-500'} />
                    <p className={cn('text-xs font-bold uppercase tracking-wide', missing.length <= 2 ? 'text-amber-800' : missing.length <= 5 ? 'text-orange-800' : 'text-red-800')}>
                      {matched.length}/{matched.length + missing.length} matched · {missing.length} to build
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {missing.slice(0, 3).map(skill => (
                      <div key={skill} className="flex items-start gap-2 bg-white/70 rounded-lg p-2">
                        <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', missing.length <= 2 ? 'bg-amber-400' : missing.length <= 5 ? 'bg-orange-400' : 'bg-red-400')} />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 capitalize">{skill}</span>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            {SKILL_ADVICE[skill.toLowerCase()] ?? `Build a project demonstrating ${skill}.`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {missing.length > 3 && (
                    <p className={cn('text-xs font-medium pl-3', missing.length <= 5 ? 'text-orange-700' : 'text-red-700')}>
                      +{missing.length - 3} more — focus on above first.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// JobDetailsModal (preserved exactly)
// =============================================================================
function JobDetailsModal({ match, profile, applying, appliedJobs, onApply, onClose }: {
  match: MatchedJob; profile: StudentProfile | null; applying: string | null;
  appliedJobs: Set<string>; onApply: (id: string, title: string) => Promise<void>; onClose: () => void;
}) {
  const { matchScore, job } = match;
  const isApplied   = appliedJobs.has(job.id);
  const canApply    = matchScore >= 50 && !isApplied;
  const company     = job.recruiter?.recruiterProfile?.companyName;
  const designation = job.recruiter?.recruiterProfile?.designation;
  const { matched, missing } = analyzeSkillGap(job.requiredSkills, profile?.parsedSkills ?? []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-white w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-slide-up overflow-hidden">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-200 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-slate-900">{job.title}</h2>
            {company && <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5"><Building2 size={13} className="text-slate-400" /><span className="font-semibold text-slate-700">{company}</span>{designation && <><span className="text-slate-300">·</span><span>{designation}</span></>}</p>}
          </div>
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <CircularProgress score={matchScore} size={60} stroke={6} />
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', matchScore >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : matchScore >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200')}>
              {matchScore >= 80 ? 'Excellent' : matchScore >= 50 ? 'Good Fit' : 'Low Match'}
            </span>
          </div>
          <button onClick={onClose} className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700"><Award size={12} className="text-indigo-500" />Min CGPA: <span className="text-indigo-700 font-black ml-0.5">{job.minCgpa}</span></span>
            <span className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700"><Briefcase size={12} className="text-indigo-500" />Min Experience: <span className="text-indigo-700 font-black ml-0.5">{job.minExperience} yrs</span></span>
          </div>
          <div><h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><FileText size={12} className="text-indigo-400" />Job Description</h3><p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{job.description}</p></div>
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Zap size={12} className="text-indigo-400" />Required Skills<span className="ml-auto text-[10px] font-bold text-slate-400 normal-case">{matched.length}/{job.requiredSkills.length} matched</span></h3>
            <div className="flex flex-wrap gap-1.5">
              {job.requiredSkills.map(skill => {
                const isMat = matched.map(s => s.toLowerCase()).includes(skill.toLowerCase());
                return <span key={skill} className={cn('px-2.5 py-1 rounded-md text-xs font-semibold border', isMat ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200')}>{isMat ? '✓' : '✗'} {skill}</span>;
              })}
            </div>
          </div>
          {missing.length > 0 && (
            <div className={cn('rounded-xl p-4 space-y-3 border', missing.length <= 2 ? 'bg-amber-50 border-amber-100' : missing.length <= 5 ? 'bg-orange-50 border-orange-100' : 'bg-red-50 border-red-100')}>
              <div className="flex items-center gap-2"><Info size={14} className={missing.length <= 2 ? 'text-amber-600' : missing.length <= 5 ? 'text-orange-600' : 'text-red-500'} /><p className={cn('text-xs font-bold uppercase tracking-wide', missing.length <= 2 ? 'text-amber-800' : missing.length <= 5 ? 'text-orange-800' : 'text-red-800')}>{missing.length} skill{missing.length !== 1 ? 's' : ''} to build</p></div>
              <div className="space-y-2">{missing.map(skill => <div key={skill} className="flex items-start gap-2.5 bg-white/70 rounded-lg p-2.5"><span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', missing.length <= 2 ? 'bg-amber-400' : missing.length <= 5 ? 'bg-orange-400' : 'bg-red-400')} /><div><span className="text-xs font-bold text-slate-800 capitalize">{skill}</span><p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{SKILL_ADVICE[skill.toLowerCase()] ?? `Build a hands-on project demonstrating ${skill}.`}</p></div></div>)}</div>
            </div>
          )}
          {matched.length === job.requiredSkills.length && job.requiredSkills.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-start gap-2.5"><CheckCircle size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" /><div><p className="text-sm font-bold text-emerald-800">Perfect Skill Match! 🎉</p><p className="text-xs text-emerald-700 mt-0.5">Your resume covers every required skill.</p></div></div>
          )}
        </div>
        <div className="flex-shrink-0 border-t border-slate-200 p-5 bg-white flex items-center gap-3">
          <button onClick={() => void onApply(job.id, job.title)} disabled={applying === job.id || !canApply}
            className={cn('flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-150',
              isApplied ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed'
              : canApply ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm active:scale-[0.97]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200',
              applying === job.id && 'opacity-70 cursor-not-allowed')}>
            {applying === job.id ? <Loader2 size={16} className="animate-spin" /> : isApplied ? <CheckCircle size={16} /> : <ChevronRight size={16} />}
            {isApplied ? 'Already Applied' : matchScore >= 50 ? 'Apply Now' : 'Score Below Threshold (50%)'}
          </button>
          <button onClick={onClose} className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 text-sm font-semibold transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}
