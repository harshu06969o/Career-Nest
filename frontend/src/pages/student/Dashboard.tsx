import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  UploadCloud, FileText, Zap, Trophy, TrendingUp,
  Briefcase, CheckCircle, Loader2, RefreshCw, ChevronRight,
  Info, GraduationCap, Building2, X, BookOpen, Award,
  Target, LayoutDashboard, BarChart2, Lightbulb,
  Star, Clock, ExternalLink, AlertCircle, MessageSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';
import { getSocket } from '../../lib/socket';
import CircularProgress from '../../components/CircularProgress';
import ResumeAnalyzing from '../../components/ResumeAnalyzing';
import NotificationBell, { playNotificationChime } from '../../components/NotificationBell';
import { useChatStore } from '../../store/chatStore';
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
  applicationStatus?: string | null;
  conversationId?: string | null;
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
// Skill Alias Map — mirrors backend matcher.service.ts normalization
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

// Cloudinary raw URLs are application/octet-stream — Google Docs Viewer forces inline PDF rendering.
function getViewableResumeUrl(url: string): string {
  if (!url) return url;
  return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
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
// Skill Advice Map — actionable guidance for every missing skill
// =============================================================================
const SKILL_ADVICE: Record<string, string> = {
  'data structures and algorithms': 'Practice on LeetCode — start with NeetCode 150 roadmap. Target 2–3 problems/day.',
  'react': 'Build a portfolio project: todo-app → weather dashboard → e-commerce. Official docs + Scrimba React cover 90% of interviews.',
  'node.js': 'Build a REST API with Express + MongoDB. Add JWT authentication to stand out.',
  'rest api': 'Create a CRUD API with Node.js + Express. Document with Postman/Swagger.',
  'express': 'Build 2–3 REST APIs. Middleware, routing, and error handling are the key interview topics.',
  'python': 'Complete Python basics on freeCodeCamp, then build a web scraper or data analysis script with pandas.',
  'machine learning': "Start with Andrew Ng's ML Specialization on Coursera. Build a classification project with scikit-learn.",
  'deep learning': "Complete fast.ai's Practical Deep Learning. Build an image classifier using PyTorch or TensorFlow.",
  'docker': "Complete Docker's official \"Get Started\" guide (2 hrs). Containerize one of your existing projects.",
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
  'tensorflow': "Complete TensorFlow's official tutorials. Build a CNN for image classification.",
  'pytorch': "Complete fast.ai's PyTorch course. Build a custom neural network from scratch.",
  'scikit-learn': 'Build end-to-end ML pipelines: preprocessing → training → evaluation → tuning.',
  'next.js': 'Build a full-stack app using Next.js App Router with server components and API routes.',
  'graphql': 'Add a GraphQL API using Apollo Server. Compare REST vs GraphQL in your project README.',
  'redis': 'Implement caching and session management with Redis in a Node.js app.',
};

// =============================================================================
// Radar Chart — SVG-based skill radar
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
        return <polygon key={level} points={pts} fill="none" stroke="#E8E8E4" strokeWidth="1" />;
      })}
      {/* Axis lines */}
      {values.map((_, i) => {
        const p = toXY(i, 1);
        return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#E8E8E4" strokeWidth="1" />;
      })}
      {/* Data polygon fill */}
      <polygon points={polygon} fill="rgba(79,70,229,0.12)" stroke="#4F46E5" strokeWidth="1.5" className="radar-polygon" />
      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#4F46E5" stroke="white" strokeWidth="1.5" className="score-glow" />
      ))}
      {/* Labels */}
      {values.map((v, i) => {
        const lp = toXY(i, 1.22);
        return (
          <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fontWeight="600" fill="#6B6B68" fontFamily="Inter, sans-serif">
            {v.label}
          </text>
        );
      })}
    </svg>
  );
}

// =============================================================================
// StudentDashboard — Main Component
// =============================================================================
export default function StudentDashboard() {

  // ── State ──────────────────────────────────────────────────────────────────
  const [profile,        setProfile]        = useState<StudentProfile | null>(null);
  const [matches,        setMatches]        = useState<MatchedJob[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [uploading,      setUploading]      = useState(false);
  const [isAnalyzing,    setIsAnalyzing]    = useState(false);
  const [applying,       setApplying]       = useState<string | null>(null);
  const [appliedJobs,    setAppliedJobs]    = useState<Set<string>>(new Set());
  const [dragOver,       setDragOver]       = useState(false);
  const [selectedJob,    setSelectedJob]    = useState<MatchedJob | null>(null);
  const [activeView,     setActiveView]     = useState<ActiveView>('dashboard');
  const [matchFilter,    setMatchFilter]    = useState<'all' | 'eligible' | 'applied'>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  // Real-time chat integration
  const openChat = useChatStore((s) => s.openChat);
  const [searchParams] = useSearchParams();

  // Open chat from URL query param (e.g. notification deep-link)
  useEffect(() => {
    const qConvId = searchParams.get('conversationId');
    if (qConvId) {
      openChat(qConvId);
    }
  }, [searchParams, openChat]);

  // ── Data Fetchers ──────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: StudentProfile }>('/student/profile');
      setProfile(data.data);
    } catch { /* 404 = profile not yet created */ } finally { setLoadingProfile(false); }
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

  // ── WebSocket listeners — resume parsing and application status changes ────
  useEffect(() => {
    const socket = getSocket();

    const onParsed = (data: {
      parsedSkills:    string[];
      experienceYears: number;
      cgpa:            number;
      college:         string;
      resumeUrl:       string;
      skillCount:      number;
    }) => {
      console.log('[Dashboard] resume:parsed', data);
      setProfile(prev => prev ? {
        ...prev,
        parsedSkills:    data.parsedSkills,
        experienceYears: data.experienceYears,
        cgpa:            data.cgpa,
        college:         data.college || prev.college,
        resumeUrl:       data.resumeUrl,
      } : prev);
      setIsAnalyzing(false);
      toast.success(`✨ AI extracted ${data.skillCount} skills from your resume!`, { duration: 5000 });
      void fetchMatches();
      void fetchProfile();
    };

    const onFailed = (data: { message: string }) => {
      console.warn('[Dashboard] resume:parse-failed', data);
      setIsAnalyzing(false);
      setUploading(false);
      toast.error(data.message ?? 'AI parsing failed. Please try again.');
    };

    const onStatusChanged = (data: { applicationId: string; jobTitle: string; status: string; conversationId?: string }) => {
      console.log('[Dashboard] application:status_changed', data);
      if (data.status === 'SHORTLISTED') {
        toast.success(`🎉 Congratulations! You have been Shortlisted for "${data.jobTitle}"! Live recruiter chat is now unlocked.`, { duration: 8000 });
        playNotificationChime();
      } else if (data.status === 'REJECTED') {
        toast(`Application update: Your application for "${data.jobTitle}" has been reviewed.`, { duration: 5000 });
      }
      void fetchMatches();
      void fetchProfile();
    };

    socket.on('resume:parsed',             onParsed);
    socket.on('resume:parse-failed',       onFailed);
    socket.on('application:status_changed', onStatusChanged);

    return () => {
      socket.off('resume:parsed',             onParsed);
      socket.off('resume:parse-failed',       onFailed);
      socket.off('application:status_changed', onStatusChanged);
    };
  }, [fetchMatches, fetchProfile]);

  // ── Polling fallback — safety net if WebSocket event is dropped ─────────────
  // Polls for parsed skills every 3s for up to 24s while isAnalyzing is true.
  useEffect(() => {
    if (!isAnalyzing) return;

    let pollCount = 0;
    const maxPolls = 8;

    const interval = setInterval(async () => {
      pollCount++;
      try {
        const { data } = await api.get<{ data: StudentProfile }>('/student/profile');
        if (data.data?.parsedSkills && data.data.parsedSkills.length > 0) {
          console.log('[Dashboard Polling] Skills detected:', data.data.parsedSkills.length);
          setProfile(data.data);
          setIsAnalyzing(false);
          toast.success(`✨ AI extracted ${data.data.parsedSkills.length} skills from your resume!`, { duration: 5000 });
          void fetchMatches();
          clearInterval(interval);
          return;
        }
      } catch { /* silently retry */ }

      if (pollCount >= maxPolls) {
        console.log('[Dashboard Polling] Max attempts reached, closing overlay');
        setIsAnalyzing(false);
        void fetchProfile();
        void fetchMatches();
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isAnalyzing, fetchMatches, fetchProfile]);

  // Initial data load
  useEffect(() => { void fetchProfile(); void fetchMatches(); }, [fetchProfile, fetchMatches]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleUpload = async (file: File) => {
    if (file.type !== 'application/pdf') { toast.error('Please upload a PDF file.'); return; }
    if (file.size > 5 * 1024 * 1024)    { toast.error('File size must be under 5 MB.'); return; }
    setUploading(true);
    const form = new FormData();
    form.append('resume', file);
    try {
      // Backend responds 202 Accepted immediately — BullMQ worker handles LLM parsing asynchronously
      await api.post('/student/resume', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploading(false);
      setIsAnalyzing(true);
      toast('📤 Resume received! AI is now analysing your skills…', { icon: '🤖', duration: 4000 });
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Upload failed.');
      setUploading(false);
    }
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
      const normalized  = normalizeSkillFrontend(skill);
      const demandCount = matches.filter(m => m.job.requiredSkills.some(s => normalizeSkillFrontend(s) === normalized)).length;
      const pct = matches.length > 0 ? Math.max(8, Math.round((demandCount / matches.length) * 100)) : 70;
      return { skill, pct };
    }).sort((a, b) => b.pct - a.pct);
  }, [profile, matches]);

  // ── Computed: Skill Development ────────────────────────────────────────────
  const skillDevData = useMemo(() => {
    if (!profile || !matches.length) return { missing: [] };
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

  // ── Computed: Profile Analysis ─────────────────────────────────────────────
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

    return {
      skillMatchPct, cgpaPct, expPct, appliedCount, topScore, overallScore, recommendation: rec,
      appliedJobs: matches.filter(m => appliedJobs.has(m.job.id)),
    };
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
    { view: 'dashboard',         icon: <LayoutDashboard size={14} />, label: 'Dashboard'        },
    { view: 'matches',           icon: <Briefcase size={14} />,       label: 'Job Matches'       },
    { view: 'skill-development', icon: <Target size={14} />,          label: 'Skill Development' },
    { view: 'documents',         icon: <FileText size={14} />,        label: 'Documents'         },
    { view: 'analysis',          icon: <BarChart2 size={14} />,       label: 'My Analysis'       },
  ];

  return (
    <div className="flex gap-6 items-start w-full">

      {/* AI Analyzing overlay — displayed while BullMQ worker processes the resume */}
      {isAnalyzing && (
        <ResumeAnalyzing
          onComplete={() => {
            setIsAnalyzing(false);
            void fetchProfile();
            void fetchMatches();
          }}
          onDismiss={() => {
            setIsAnalyzing(false);
            void fetchProfile();
            void fetchMatches();
          }}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          LEFT SIDEBAR — sticky profile + navigation
      ══════════════════════════════════════════════════════════════════════ */}
      <aside className="w-52 shrink-0 hidden lg:flex flex-col gap-3 sticky top-20 self-start animate-slide-in-left">

        {/* Profile card */}
        <div className="cn-card p-4 flex flex-col items-center text-center gap-3">
          {/* Avatar circle */}
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-sm"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}
          >
            <span className="text-white font-black text-lg">
              {profile?.firstName?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>

          {loadingProfile ? (
            <div className="space-y-2 w-full">
              <div className="skeleton h-3 w-20 mx-auto" />
              <div className="skeleton h-2.5 w-28 mx-auto" />
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}>
                  {displayName}
                </p>
                <p className="text-xs mt-0.5 truncate max-w-[180px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  {profile?.college ?? 'College not set'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <span
                  className="px-2 py-0.5 text-xs font-bold rounded-full"
                  style={{ background: 'var(--color-brand-light)', color: 'var(--color-brand)', border: '1px solid var(--color-brand-border)' }}
                >
                  CGPA {profile?.cgpa.toFixed(1) ?? '—'}
                </span>
                <span
                  className="px-2 py-0.5 text-xs font-semibold rounded-full"
                  style={{ background: 'var(--color-border-subtle)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                >
                  {profile?.experienceYears ?? 0} yrs
                </span>
              </div>
              {/* Resume status indicator */}
              <div
                className={cn('w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold')}
                style={profile?.resumeUrl
                  ? { background: 'var(--color-success-light)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)' }
                  : { background: 'var(--color-danger-light)', color: 'var(--color-danger)', border: '1px solid var(--color-danger-border)' }
                }
              >
                {profile?.resumeUrl
                  ? <><CheckCircle size={10} /> Resume Active</>
                  : <><UploadCloud size={10} /> No Resume</>
                }
              </div>
            </>
          )}
        </div>

        {/* Navigation links */}
        <div className="cn-card p-2 flex flex-col gap-0.5">
          <p className="type-label px-3 py-1.5">Navigation</p>
          {navItems.map(({ view, icon, label }) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={cn('nav-item', activeView === view && 'active')}
            >
              <span className="nav-icon" style={{ color: activeView === view ? 'var(--color-brand)' : 'var(--color-text-tertiary)' }}>
                {icon}
              </span>
              <span>{label}</span>
              {/* Job match count badge */}
              {view === 'matches' && matches.length > 0 && (
                <span
                  className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
                >
                  {matches.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Resume upload CTA */}
        <button
          onClick={() => { setActiveView('documents'); fileRef.current?.click(); }}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--color-brand)', fontFamily: 'var(--font-heading)' }}
          onMouseEnter={e => { if (!uploading) e.currentTarget.style.background = 'var(--color-brand-hover)'; }}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-brand)')}
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
          {uploading ? 'Parsing…' : profile?.resumeUrl ? 'Update Resume' : 'Upload Resume'}
        </button>

        {/* Hidden file input */}
        <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void handleUpload(f); e.target.value = ''; }} />
      </aside>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 min-w-0">

        {/* ─── VIEW: DASHBOARD ─────────────────────────────────────────────── */}
        {activeView === 'dashboard' && (
          <div className="space-y-5 animate-view-enter">

            {/* Page header */}
            <div className="section-header">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1
                    className="text-2xl font-black"
                    style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em' }}
                  >
                    Student Hub
                  </h1>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    Welcome back, <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{displayName}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openChat(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all"
                    style={{ background: '#FFFFFF', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', boxShadow: 'var(--shadow-xs)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-brand)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                  >
                    <MessageSquare size={13} style={{ color: 'var(--color-brand)' }} />
                    Live Chat
                  </button>
                  <NotificationBell onOpenChat={(convId) => openChat(convId ?? null)} />
                  {profile && (
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                      style={{ background: 'var(--color-success-light)', border: '1px solid var(--color-success-border)', color: 'var(--color-success)' }}
                    >
                      <CheckCircle size={12} />
                      Profile Active
                    </div>
                  )}
                  <button
                    onClick={() => void fetchMatches()}
                    disabled={loadingMatches}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-brand)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
                  >
                    <RefreshCw size={14} className={loadingMatches ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
            </div>

            {/* Metric stat cards */}
            <div className="grid grid-cols-3 gap-4">
              {loadingProfile ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="stat-card">
                  <div className="skeleton h-3 w-20 mb-4" /><div className="skeleton h-7 w-14 mb-1" /><div className="skeleton h-2.5 w-24" />
                </div>
              )) : [
                { label: 'Skills Parsed', value: profile?.parsedSkills.length ?? 0, sub: 'from your resume', icon: <Zap size={16} style={{ color: 'var(--color-brand)' }} />, iconBg: 'var(--color-brand-light)' },
                { label: 'Job Matches',   value: matches.length,  sub: `${eligibleCount} eligible`, icon: <Trophy size={16} className="text-emerald-600" />, iconBg: '#F0FDF4' },
                { label: 'Top Score',     value: matches[0] ? `${matches[0].matchScore}%` : '—', sub: 'best AI match', icon: <TrendingUp size={16} className="text-violet-600" />, iconBg: '#F5F3FF' },
              ].map(({ label, value, sub, icon, iconBg }, i) => (
                <div key={label} className={cn('stat-card animate-view-enter', i === 0 && 'stagger-1', i === 1 && 'stagger-2', i === 2 && 'stagger-3')}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="type-label">{label}</span>
                    <div className="p-2 rounded-lg" style={{ background: iconBg }}>{icon}</div>
                  </div>
                  <p className="text-2xl font-black mb-0.5 animate-count" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', letterSpacing: '-0.04em' }}>
                    {value}
                  </p>
                  <p className="type-caption">{sub}</p>
                </div>
              ))}
            </div>

            {/* Profile overview + Skill mastery */}
            {profile && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Profile overview */}
                <div className="cn-card p-5 animate-view-enter stagger-2">
                  <h2 className="type-label flex items-center gap-1.5 mb-4">
                    <GraduationCap size={12} style={{ color: 'var(--color-brand)' }} />
                    Profile Overview
                  </h2>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: 'CGPA',    value: profile.cgpa.toFixed(1),          accent: 'var(--color-brand)' },
                      { label: 'Exp.',    value: `${profile.experienceYears} yrs`,  accent: 'var(--color-text-primary)' },
                      { label: 'Resume',  value: profile.resumeUrl ? 'Active ✓' : 'Missing ✗', accent: profile.resumeUrl ? 'var(--color-success)' : 'var(--color-danger)' },
                    ].map(({ label, value, accent }) => (
                      <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                        <p className="type-label mb-1">{label}</p>
                        <p className="text-sm font-black truncate" style={{ color: accent, fontFamily: 'var(--font-heading)' }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                    <p className="type-label mb-0.5">College</p>
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>{profile.college}</p>
                  </div>
                  {profile.parsedSkills.length > 0 && (
                    <div>
                      <p className="type-label flex items-center gap-1 mb-2"><Zap size={10} style={{ color: 'var(--color-brand)' }} />Parsed Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {profile.parsedSkills.slice(0, 12).map(skill => (
                          <span key={skill} className="text-[11px] font-medium px-2 py-0.5 rounded-md"
                            style={{ background: 'var(--color-brand-light)', color: 'var(--color-brand)', border: '1px solid var(--color-brand-border)' }}>
                            {skill}
                          </span>
                        ))}
                        {profile.parsedSkills.length > 12 && (
                          <span className="text-xs self-center" style={{ color: 'var(--color-text-tertiary)' }}>+{profile.parsedSkills.length - 12} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Skill mastery bars */}
                <div className="cn-card p-5 animate-view-enter stagger-3">
                  <h2 className="type-label flex items-center gap-1.5 mb-1">
                    <BarChart2 size={12} style={{ color: 'var(--color-brand)' }} />
                    Skill Mastery
                  </h2>
                  <p className="type-caption mb-4">% of available jobs requiring each skill</p>
                  {skillMastery.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-28 text-center">
                      <UploadCloud size={24} className="mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Upload resume to see skill demand</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {skillMastery.map(({ skill, pct }, i) => (
                        <div key={skill} className={cn('animate-view-enter', `stagger-${Math.min(i + 1, 6)}`)}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-semibold capitalize truncate max-w-[70%]" style={{ color: 'var(--color-text-primary)' }}>{skill}</span>
                            <span className="text-xs font-bold ml-2" style={{ color: 'var(--color-brand)' }}>{pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                            <div
                              className="h-full rounded-full skill-bar-fill"
                              style={{
                                width: `${pct}%`,
                                background: pct >= 70
                                  ? 'linear-gradient(90deg, #4F46E5, #7C3AED)'
                                  : pct >= 40
                                  ? 'linear-gradient(90deg, #16A34A, #0D9488)'
                                  : 'linear-gradient(90deg, #D97706, #EA580C)',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick match preview */}
            <div className="cn-card p-5 animate-view-enter stagger-4">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                  <Briefcase size={14} style={{ color: 'var(--color-brand)' }} />
                  Job Match Feed
                  {matches.length > 0 && (
                    <span className="ml-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
                      {matches.length}
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="type-label px-2 py-1 rounded-lg" style={{ background: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>AI Match</span>
                  {matches.length > 3 && (
                    <button onClick={() => setActiveView('matches')} className="text-xs font-semibold hover:underline" style={{ color: 'var(--color-brand)' }}>
                      View All →
                    </button>
                  )}
                </div>
              </div>
              <JobMatchList
                matches={matches.slice(0, 3)}
                profile={profile}
                loadingMatches={loadingMatches}
                appliedJobs={appliedJobs}
                applying={applying}
                onApply={handleApply}
                onViewDetails={setSelectedJob}
                onOpenChat={(convId) => openChat(convId ?? null)}
              />
            </div>
          </div>
        )}

        {/* ─── VIEW: JOB MATCHES ───────────────────────────────────────────── */}
        {activeView === 'matches' && (
          <div className="space-y-5 animate-view-enter">
            <div className="section-header">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl font-black" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em' }}>Job Matches</h1>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>AI-ranked roles based on your skills, CGPA, and experience</p>
                </div>
                <button onClick={() => void fetchMatches()} disabled={loadingMatches}
                  className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--color-text-tertiary)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-brand)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}>
                  <RefreshCw size={14} className={loadingMatches ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--color-border-subtle)', border: '1px solid var(--color-border)' }}>
              {([['all', 'All'], ['eligible', `Eligible (${eligibleCount})`], ['applied', `Applied (${appliedJobs.size})`]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setMatchFilter(key)}
                  className={cn('px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200')}
                  style={matchFilter === key
                    ? { background: '#FFFFFF', color: 'var(--color-brand)', border: '1px solid var(--color-brand-border)', boxShadow: 'var(--shadow-xs)' }
                    : { color: 'var(--color-text-secondary)' }
                  }>
                  {label}
                </button>
              ))}
            </div>

            <JobMatchList
              matches={filteredMatches}
              profile={profile}
              loadingMatches={loadingMatches}
              appliedJobs={appliedJobs}
              applying={applying}
              onApply={handleApply}
              onViewDetails={setSelectedJob}
              onOpenChat={(convId) => openChat(convId ?? null)}
              showAll
            />
          </div>
        )}

        {/* ─── VIEW: SKILL DEVELOPMENT ─────────────────────────────────────── */}
        {activeView === 'skill-development' && (
          <div className="space-y-5 animate-view-enter">
            <div className="section-header">
              <h1 className="text-2xl font-black" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em' }}>Skill Development</h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Prioritised learning roadmap based on {matches.length} available job{matches.length !== 1 ? 's' : ''}
              </p>
            </div>

            {!profile ? (
              <div className="cn-card p-12 text-center">
                <UploadCloud size={32} className="mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
                <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Upload your resume first</p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>We need your parsed skills to generate a roadmap</p>
                <button onClick={() => fileRef.current?.click()} className="btn-primary mt-4">Upload Resume</button>
              </div>
            ) : skillDevData.missing.length === 0 && matches.length === 0 ? (
              <div className="cn-card p-12 text-center">
                <Briefcase size={32} className="mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
                <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>No job matches to analyse yet</p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Job matches drive the skill gap analysis</p>
              </div>
            ) : skillDevData.missing.length === 0 ? (
              <div className="cn-card p-8 text-center" style={{ borderColor: 'var(--color-success-border)', background: 'var(--color-success-light)' }}>
                <CheckCircle size={32} className="mx-auto mb-3" style={{ color: 'var(--color-success)' }} />
                <p className="font-bold text-lg" style={{ color: 'var(--color-success)' }}>You cover all required skills! 🎉</p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-success)' }}>Your resume matches every required skill across all available jobs.</p>
              </div>
            ) : (
              <>
                {/* Summary stat cards */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Skills to Build', value: skillDevData.missing.length, icon: <Target size={16} style={{ color: 'var(--color-danger)' }} />, bg: 'var(--color-danger-light)' },
                    { label: 'Skills You Have', value: profile.parsedSkills.length, icon: <CheckCircle size={16} className="text-emerald-600" />, bg: '#F0FDF4' },
                    { label: 'Top Priority',    value: skillDevData.missing[0]?.skill ?? '—', icon: <Star size={16} className="text-amber-500" />, bg: '#FFFBEB', small: true },
                  ].map(({ label, value, icon, bg, small }) => (
                    <div key={label} className="stat-card animate-view-enter">
                      <div className="flex items-center justify-between mb-3">
                        <span className="type-label">{label}</span>
                        <div className="p-2 rounded-lg" style={{ background: bg }}>{icon}</div>
                      </div>
                      <p className={cn('font-black mb-0.5', small ? 'text-base capitalize truncate' : 'text-2xl')}
                        style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', letterSpacing: small ? '0' : '-0.04em' }}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Missing skills roadmap */}
                <div className="cn-card p-5">
                  <h2 className="text-sm font-bold flex items-center gap-2 mb-5" style={{ color: 'var(--color-text-primary)' }}>
                    <Lightbulb size={14} className="text-amber-500" />
                    Skills to Build — Prioritised by Market Demand
                  </h2>
                  <div className="space-y-3">
                    {skillDevData.missing.map(({ skill, jobsPct, advice }, i) => (
                      <div key={skill}
                        className={cn('rounded-xl p-4 transition-all duration-200 animate-view-enter', `stagger-${Math.min(i + 1, 6)}`)}
                        style={{ border: '1px solid var(--color-border)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-brand-border)'; e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-3">
                            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0',
                              i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : i <= 4 ? 'bg-amber-500' : 'bg-slate-400')}>
                              #{i + 1}
                            </div>
                            <div>
                              <p className="font-bold capitalize" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}>{skill}</p>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                                {Math.round((jobsPct / 100) * matches.length)} of {matches.length} jobs require this
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-base font-black" style={{ color: 'var(--color-brand)', fontFamily: 'var(--font-heading)' }}>{jobsPct}%</p>
                            <p className="type-caption">demand</p>
                          </div>
                        </div>
                        {/* Demand bar */}
                        <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'var(--color-border)' }}>
                          <div className="h-full rounded-full skill-bar-fill"
                            style={{
                              width: `${jobsPct}%`,
                              background: jobsPct >= 70 ? 'linear-gradient(90deg, #DC2626, #EF4444)'
                                : jobsPct >= 40 ? 'linear-gradient(90deg, #D97706, #F59E0B)'
                                : 'linear-gradient(90deg, #9CA3AF, #D1D5DB)',
                            }}
                          />
                        </div>
                        {/* Advice tip */}
                        <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                          <Lightbulb size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{advice}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Existing skills */}
                {profile.parsedSkills.length > 0 && (
                  <div className="cn-card p-5">
                    <h2 className="type-label flex items-center gap-1.5 mb-4">
                      <CheckCircle size={12} style={{ color: 'var(--color-success)' }} />
                      Your Existing Skills
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
              <h1 className="text-2xl font-black" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em' }}>Documents</h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Manage your resume — AI parses it on every upload</p>
            </div>

            {/* Resume active status */}
            {profile?.resumeUrl && (
              <div className="cn-card p-5 animate-view-enter" style={{ borderColor: 'var(--color-success-border)', background: 'var(--color-success-light)' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#DCFCE7' }}>
                      <FileText size={18} style={{ color: 'var(--color-success)' }} />
                    </div>
                    <div>
                      <p className="font-bold" style={{ color: '#14532D' }}>Resume Uploaded</p>
                      <p className="text-sm mt-0.5" style={{ color: '#166534' }}>{profile.parsedSkills.length} skills parsed successfully</p>
                    </div>
                  </div>
                  <a href={getViewableResumeUrl(profile.resumeUrl)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-colors flex-shrink-0"
                    style={{ background: '#FFFFFF', border: '1px solid var(--color-success-border)', color: 'var(--color-success)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F0FDF4')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}>
                    <ExternalLink size={12} />View Resume
                  </a>
                </div>
              </div>
            )}

            {/* Upload dropzone */}
            <div className="cn-card p-5 animate-view-enter stagger-2">
              <h2 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--color-text-primary)' }}>
                <UploadCloud size={14} style={{ color: 'var(--color-brand)' }} />
                {profile?.resumeUrl ? 'Replace Resume' : 'Upload Resume'}
              </h2>
              <div
                onClick={() => !uploading && fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) void handleUpload(f); }}
                className={cn(
                  'border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all duration-300',
                  uploading ? 'cursor-not-allowed' : '',
                )}
                style={{
                  borderColor: uploading ? 'var(--color-brand-border)' : dragOver ? 'var(--color-brand)' : 'var(--color-border)',
                  background: uploading ? 'var(--color-brand-light)' : dragOver ? '#F5F3FF' : 'var(--color-bg)',
                  transform: dragOver ? 'scale(1.008)' : 'scale(1)',
                }}
              >
                {uploading ? (
                  <>
                    <Loader2 size={36} className="animate-spin" style={{ color: 'var(--color-brand)' }} />
                    <div className="text-center">
                      <p className="font-bold" style={{ color: 'var(--color-brand)' }}>Uploading &amp; Parsing…</p>
                      <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>AI is extracting your skills</p>
                    </div>
                  </>
                ) : dragOver ? (
                  <>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center animate-scale-in" style={{ background: 'var(--color-brand-light)' }}>
                      <UploadCloud size={28} style={{ color: 'var(--color-brand)' }} />
                    </div>
                    <p className="font-bold" style={{ color: 'var(--color-brand)' }}>Drop to upload!</p>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'var(--color-border-subtle)' }}>
                      <UploadCloud size={28} style={{ color: 'var(--color-text-tertiary)' }} />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Drop your PDF here</p>
                      <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        or <span style={{ color: 'var(--color-brand)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '2px' }}>click to browse</span>
                      </p>
                      <p className="text-xs mt-2" style={{ color: 'var(--color-text-tertiary)' }}>PDF only · Max 5 MB · AI skill extraction</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Parsed skills summary */}
            {profile?.parsedSkills && profile.parsedSkills.length > 0 && (
              <div className="cn-card p-5 animate-view-enter stagger-3">
                <h2 className="type-label flex items-center gap-1.5 mb-4">
                  <Zap size={11} style={{ color: 'var(--color-brand)' }} />
                  AI-Parsed Skills ({profile.parsedSkills.length} found)
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {profile.parsedSkills.map(skill => (
                    <span key={skill} className="skill-matched">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Best practices tip */}
            <div className="cn-card p-4 animate-view-enter stagger-4" style={{ borderColor: 'var(--color-warning-border)', background: 'var(--color-warning-light)' }}>
              <div className="flex items-start gap-3">
                <AlertCircle size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-900">For best results</p>
                  <p className="text-xs mt-0.5 leading-relaxed text-amber-700">
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
              <h1 className="text-2xl font-black" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em' }}>Detailed Analysis</h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>In-depth profile breakdown — your competitive positioning</p>
            </div>

            {!profile || !analysisData ? (
              <div className="cn-card p-12 text-center">
                <BarChart2 size={32} className="mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
                <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Upload resume to unlock analysis</p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>We need your profile data to generate this report</p>
                <button onClick={() => { setActiveView('documents'); fileRef.current?.click(); }} className="btn-primary mt-4">Upload Resume</button>
              </div>
            ) : (
              <>
                {/* Analysis hero grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                  {/* Overall score */}
                  <div className="cn-card p-5 flex flex-col items-center text-center gap-4 animate-view-enter stagger-1">
                    <CircularProgress score={analysisData.overallScore} size={100} stroke={8} />
                    <div>
                      <p className="type-label">Overall AI Score</p>
                      <p className={cn('text-base font-black mt-1', { 'text-emerald-700': analysisData.overallScore >= 75, 'text-amber-700': analysisData.overallScore >= 55 && analysisData.overallScore < 75, 'text-red-600': analysisData.overallScore < 55 })}>
                        {analysisData.overallScore >= 75 ? 'Excellent' : analysisData.overallScore >= 55 ? 'Good' : analysisData.overallScore >= 35 ? 'Developing' : 'Early Stage'}
                      </p>
                    </div>
                    {/* Score breakdown */}
                    <div className="w-full text-left space-y-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                      {[
                        { label: 'Skills Match', value: analysisData.skillMatchPct },
                        { label: 'CGPA Score',   value: analysisData.cgpaPct },
                        { label: 'Experience',   value: analysisData.expPct },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                            <span className="font-bold" style={{ color: 'var(--color-brand)' }}>{value}%</span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                            <div className="h-full rounded-full skill-bar-fill" style={{ width: `${value}%`, background: 'linear-gradient(90deg, #4F46E5, #7C3AED)' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Radar chart */}
                  <div className="cn-card p-5 flex flex-col items-center gap-4 animate-view-enter stagger-2">
                    <p className="type-label self-start">Skill Radar</p>
                    <RadarChart size={180} values={[
                      { label: 'Skills',       value: analysisData.skillMatchPct },
                      { label: 'CGPA',         value: analysisData.cgpaPct },
                      { label: 'Experience',   value: analysisData.expPct },
                      { label: 'Applications', value: Math.min(100, analysisData.appliedCount * 20) },
                    ]} />
                    <p className="type-caption text-center leading-relaxed">
                      4-dimension profile radar relative to job requirements
                    </p>
                  </div>

                  {/* Quick stat mini-cards */}
                  <div className="flex flex-col gap-3 animate-view-enter stagger-3">
                    {[
                      { label: 'Top Match Score', value: `${analysisData.topScore}%`,       icon: <Trophy size={15} style={{ color: 'var(--color-brand)' }} />,    bg: 'var(--color-brand-light)' },
                      { label: 'Jobs Applied',    value: analysisData.appliedCount,          icon: <CheckCircle size={15} className="text-emerald-600" />,          bg: '#F0FDF4' },
                      { label: 'Skills Parsed',   value: profile.parsedSkills.length,         icon: <Zap size={15} className="text-violet-600" />,                  bg: '#F5F3FF' },
                      { label: 'Skills to Build', value: skillDevData.missing.length,         icon: <Target size={15} className="text-amber-600" />,                bg: '#FFFBEB' },
                    ].map(({ label, value, icon, bg }) => (
                      <div key={label} className="cn-card p-3.5 flex items-center gap-3.5">
                        <div className="p-2 rounded-xl flex-shrink-0" style={{ background: bg }}>{icon}</div>
                        <div>
                          <p className="text-lg font-black" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', letterSpacing: '-0.04em' }}>{value}</p>
                          <p className="type-caption">{label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendation banner */}
                <div
                  className="cn-card p-5 flex items-start gap-4 animate-view-enter stagger-4"
                  style={{
                    borderColor: analysisData.overallScore >= 75 ? 'var(--color-success-border)' : analysisData.overallScore >= 55 ? 'var(--color-warning-border)' : 'var(--color-danger-border)',
                    background: analysisData.overallScore >= 75 ? 'var(--color-success-light)' : analysisData.overallScore >= 55 ? 'var(--color-warning-light)' : 'var(--color-danger-light)',
                  }}
                >
                  <div className="p-2.5 rounded-xl flex-shrink-0"
                    style={{ background: analysisData.overallScore >= 75 ? '#DCFCE7' : analysisData.overallScore >= 55 ? '#FEF3C7' : '#FEE2E2' }}>
                    <Star size={16} className={analysisData.overallScore >= 75 ? 'text-emerald-600' : analysisData.overallScore >= 55 ? 'text-amber-600' : 'text-red-500'} />
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>Overall Recommendation</p>
                    <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{analysisData.recommendation}</p>
                  </div>
                </div>

                {/* Application timeline */}
                {analysisData.appliedJobs.length > 0 && (
                  <div className="cn-card p-5 animate-view-enter stagger-5">
                    <h2 className="type-label flex items-center gap-1.5 mb-5">
                      <Clock size={12} style={{ color: 'var(--color-brand)' }} />
                      Application Timeline
                    </h2>
                    <div className="relative pl-5">
                      <div className="absolute left-1.5 top-0 bottom-0 w-0.5 rounded-full"
                        style={{ background: 'linear-gradient(to bottom, var(--color-brand-border), var(--color-border))' }} />
                      <div className="space-y-4">
                        {analysisData.appliedJobs.map(({ job, matchScore }, i) => (
                          <div key={job.id} className={cn('relative flex items-start gap-4 animate-view-enter', `stagger-${Math.min(i + 1, 6)}`)}>
                            <div className="absolute -left-[18px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm timeline-dot"
                              style={{ background: 'var(--color-brand)' }} />
                            <div className="flex-1 rounded-xl p-4 transition-all duration-200"
                              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-brand-border)')}
                              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-bold text-sm" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}>{job.title}</p>
                                  {job.recruiter?.recruiterProfile && (
                                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                                      <Building2 size={10} />{job.recruiter.recruiterProfile.companyName}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: 'var(--color-brand-light)', color: 'var(--color-brand)', border: '1px solid var(--color-brand-border)' }}>
                                    {matchScore}% match
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: 'var(--color-success-light)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)' }}>
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
                <div className="cn-card p-5 animate-view-enter stagger-6">
                  <h2 className="type-label flex items-center gap-1.5 mb-5">
                    <BarChart2 size={11} style={{ color: 'var(--color-brand)' }} />
                    Skills Comparison — Your Profile vs. Job Requirements
                  </h2>
                  {matches.slice(0, 3).map(({ job, matchScore }) => {
                    const { matched, missing } = analyzeSkillGap(job.requiredSkills, profile.parsedSkills);
                    return (
                      <div key={job.id} className="mb-5 last:mb-0 pb-5 last:pb-0 border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-bold text-sm" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}>{job.title}</p>
                          <span className="text-xs font-bold" style={{ color: 'var(--color-brand)' }}>{matchScore}% match</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden mb-1.5" style={{ background: 'var(--color-border)' }}>
                          <div className="h-full rounded-full skill-bar-fill"
                            style={{ width: `${Math.round((matched.length / Math.max(job.requiredSkills.length, 1)) * 100)}%`, background: 'linear-gradient(90deg, #4F46E5, #7C3AED)' }}
                          />
                        </div>
                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {matched.length}/{job.requiredSkills.length} skills matched · {missing.length} to build
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* ── Job Details Modal ─────────────────────────────────────────────────── */}
      {selectedJob && (
        <JobDetailsModal
          match={selectedJob} profile={profile} applying={applying}
          appliedJobs={appliedJobs} onApply={handleApply}
          onClose={() => setSelectedJob(null)}
          onOpenChat={(convId) => {
            setSelectedJob(null);
            openChat(convId ?? null);
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// JobMatchList — Wellfound-style job card list
// =============================================================================
function JobMatchList({
  matches,
  profile,
  loadingMatches,
  appliedJobs,
  applying,
  onApply,
  onViewDetails,
  onOpenChat,
  showAll = false,
}: {
  matches:       MatchedJob[];
  profile:       StudentProfile | null;
  loadingMatches:boolean;
  appliedJobs:   Set<string>;
  applying:      string | null;
  onApply:       (id: string, title: string) => Promise<void>;
  onViewDetails: (m: MatchedJob) => void;
  onOpenChat?:   (conversationId?: string) => void;
  showAll?:      boolean;
}) {
  // Loading skeleton
  if (loadingMatches) return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl p-4" style={{ border: '1px solid var(--color-border)' }}>
          <div className="skeleton h-3.5 w-1/2 mb-2" /><div className="skeleton h-3 w-1/3" />
        </div>
      ))}
    </div>
  );

  // Empty state
  if (matches.length === 0) return (
    <div className="text-center py-14">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--color-border-subtle)' }}>
        <Briefcase size={24} style={{ color: 'var(--color-text-tertiary)' }} />
      </div>
      <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>No matches found</p>
      <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
        {!profile ? 'Upload your resume to start matching' : 'Try a different filter'}
      </p>
    </div>
  );

  return (
    <div className="space-y-3">
      {(showAll ? matches : matches).map((jobMatch, idx) => {
        const { matchScore, job, applicationStatus, conversationId } = jobMatch;
        const { matched, missing } = analyzeSkillGap(job.requiredSkills, profile?.parsedSkills ?? []);
        const isApplied = appliedJobs.has(job.id);
        const canApply  = matchScore >= 50 && !isApplied;

        return (
          <div key={job.id}
            className={cn('job-card flex flex-col gap-3 animate-view-enter', idx < 6 && `stagger-${Math.min(idx + 1, 6)}`)}
          >
            {/* Card top row */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">

              {/* Match score */}
              <div className="flex-shrink-0 flex flex-col items-center gap-1">
                <CircularProgress score={matchScore} size={68} stroke={6} />
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                  matchScore >= 80 ? 'badge-match-high' : matchScore >= 50 ? 'badge-match-mid' : 'badge-match-low')}>
                  {matchScore >= 80 ? 'Excellent' : matchScore >= 50 ? 'Good Fit' : 'Low Match'}
                </span>
              </div>

              {/* Job info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-base leading-snug mb-0.5" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}>
                  {job.title}
                </h3>
                {job.recruiter?.recruiterProfile && (
                  <p className="text-sm mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                    <Building2 size={11} style={{ color: 'var(--color-text-tertiary)' }} />
                    <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {job.recruiter.recruiterProfile.companyName}
                    </span>
                    <span style={{ color: 'var(--color-border)' }}>·</span>
                    <span>{job.recruiter.recruiterProfile.designation}</span>
                  </p>
                )}
                {job.description && (
                  <p className="text-xs leading-relaxed mb-2 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
                    {job.description.slice(0, 120)}{job.description.length > 120 ? '…' : ''}
                  </p>
                )}
                {/* Meta tags */}
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-xs rounded-lg px-2.5 py-1 font-medium"
                    style={{ background: 'var(--color-border-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    Min CGPA: <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{job.minCgpa}</span>
                  </span>
                  <span className="text-xs rounded-lg px-2.5 py-1 font-medium"
                    style={{ background: 'var(--color-border-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    Exp: <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{job.minExperience} yrs</span>
                  </span>
                  <button onClick={() => onViewDetails(jobMatch)}
                    className="flex items-center gap-1 text-xs font-semibold transition-colors"
                    style={{ color: 'var(--color-brand)' }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                    <BookOpen size={10} />View Details
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2">
                {/* Shortlisted recruiter chat button */}
                {isApplied && applicationStatus === 'SHORTLISTED' && onOpenChat && (
                  <button
                    type="button"
                    onClick={() => onOpenChat(conversationId ?? undefined)}
                    className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all duration-150"
                    style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 4px 12px rgba(79,70,229,0.35)' }}
                    title="Live 1-on-1 Chat with Recruiter"
                  >
                    <MessageSquare size={12} />
                    Chat with Recruiter
                  </button>
                )}
                {/* Apply / status button */}
                <button
                  onClick={() => void onApply(job.id, job.title)}
                  disabled={applying === job.id || !canApply}
                  className={cn('flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-150 w-full sm:w-auto')}
                  style={isApplied
                    ? { background: 'var(--color-success-light)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)', cursor: 'not-allowed' }
                    : canApply
                    ? { background: 'var(--color-brand)', color: '#FFFFFF' }
                    : { background: 'var(--color-border-subtle)', color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border)', cursor: 'not-allowed' }
                  }
                  onMouseEnter={e => { if (canApply && !isApplied) e.currentTarget.style.background = 'var(--color-brand-hover)'; }}
                  onMouseLeave={e => { if (canApply && !isApplied) e.currentTarget.style.background = 'var(--color-brand)'; }}
                >
                  {applying === job.id ? <Loader2 size={13} className="animate-spin" /> : isApplied ? <CheckCircle size={13} /> : <ChevronRight size={13} />}
                  {isApplied
                    ? (applicationStatus === 'SHORTLISTED' ? 'Shortlisted 🎉' : applicationStatus === 'REJECTED' ? 'Reviewed' : 'Applied')
                    : matchScore >= 50 ? 'Apply Now' : 'Below Threshold'}
                </button>
              </div>
            </div>

            {/* Skill gap section */}
            <div className="pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {matched.map(s => <span key={s} className="skill-matched">✓ {s}</span>)}
                {missing.map(s  => <span key={s} className="skill-missing">✗ {s}</span>)}
              </div>
              {/* Skill gap contextual advice */}
              {missing.length === 0 && matched.length > 0 ? (
                <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'var(--color-success-light)', border: '1px solid var(--color-success-border)' }}>
                  <CheckCircle size={12} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                  <p className="text-xs font-bold" style={{ color: 'var(--color-success)' }}>
                    Perfect Match — all {matched.length} skills covered!
                  </p>
                </div>
              ) : missing.length > 0 ? (
                <div className={cn('rounded-xl p-3.5 space-y-2 border')}
                  style={{
                    background: missing.length <= 2 ? 'var(--color-warning-light)' : missing.length <= 5 ? '#FFF7ED' : 'var(--color-danger-light)',
                    borderColor: missing.length <= 2 ? 'var(--color-warning-border)' : missing.length <= 5 ? '#FED7AA' : 'var(--color-danger-border)',
                  }}>
                  <div className="flex items-center gap-2">
                    <Info size={12} style={{ color: missing.length <= 2 ? '#D97706' : missing.length <= 5 ? '#EA580C' : '#DC2626' }} />
                    <p className="text-xs font-bold uppercase tracking-wide"
                      style={{ color: missing.length <= 2 ? '#92400E' : missing.length <= 5 ? '#7C2D12' : '#7F1D1D' }}>
                      {matched.length}/{matched.length + missing.length} matched · {missing.length} to build
                    </p>
                  </div>
                  {missing.slice(0, 3).map(skill => (
                    <div key={skill} className="flex items-start gap-2 bg-white/70 rounded-lg p-2">
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ background: missing.length <= 2 ? '#F59E0B' : missing.length <= 5 ? '#F97316' : '#EF4444' }} />
                      <div className="min-w-0">
                        <span className="text-xs font-bold capitalize" style={{ color: 'var(--color-text-primary)' }}>{skill}</span>
                        <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                          {SKILL_ADVICE[skill.toLowerCase()] ?? `Build a project demonstrating ${skill}.`}
                        </p>
                      </div>
                    </div>
                  ))}
                  {missing.length > 3 && (
                    <p className="text-xs font-medium pl-3" style={{ color: missing.length <= 5 ? '#92400E' : '#7F1D1D' }}>
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
// JobDetailsModal — full-screen slide-up sheet
// =============================================================================
function JobDetailsModal({
  match,
  profile,
  applying,
  appliedJobs,
  onApply,
  onClose,
  onOpenChat,
}: {
  match:       MatchedJob;
  profile:     StudentProfile | null;
  applying:    string | null;
  appliedJobs: Set<string>;
  onApply:     (id: string, title: string) => Promise<void>;
  onClose:     () => void;
  onOpenChat?: (conversationId?: string) => void;
}) {
  const { matchScore, job, applicationStatus, conversationId } = match;
  const isApplied   = appliedJobs.has(job.id);
  const canApply    = matchScore >= 50 && !isApplied;
  const company     = job.recruiter?.recruiterProfile?.companyName;
  const designation = job.recruiter?.recruiterProfile?.designation;
  const { matched, missing } = analyzeSkillGap(job.requiredSkills, profile?.parsedSkills ?? []);

  // Keyboard + body scroll handlers
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
    >
      <div className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[86vh] rounded-t-2xl sm:rounded-2xl flex flex-col animate-slide-up overflow-hidden"
        style={{ background: '#FFFFFF', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.025em' }}>
              {job.title}
            </h2>
            {company && (
              <p className="text-sm mt-1 flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <Building2 size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{company}</span>
                {designation && <><span style={{ color: 'var(--color-border)' }}>·</span><span>{designation}</span></>}
              </p>
            )}
          </div>
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <CircularProgress score={matchScore} size={56} stroke={5} />
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', matchScore >= 80 ? 'badge-match-high' : matchScore >= 50 ? 'badge-match-mid' : 'badge-match-low')}>
              {matchScore >= 80 ? 'Excellent' : matchScore >= 50 ? 'Good Fit' : 'Low Match'}
            </span>
          </div>
          <button onClick={onClose} className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-subtle)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <X size={17} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Job meta tags */}
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: 'var(--color-border-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <Award size={11} style={{ color: 'var(--color-brand)' }} />Min CGPA: <span style={{ color: 'var(--color-brand)', fontWeight: 700 }}>{job.minCgpa}</span>
            </span>
            <span className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: 'var(--color-border-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <Briefcase size={11} style={{ color: 'var(--color-brand)' }} />Min Experience: <span style={{ color: 'var(--color-brand)', fontWeight: 700 }}>{job.minExperience} yrs</span>
            </span>
          </div>

          {/* Description */}
          <div>
            <h3 className="type-label flex items-center gap-1.5 mb-3">
              <FileText size={11} style={{ color: 'var(--color-brand)' }} />Job Description
            </h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>{job.description}</p>
          </div>

          {/* Required skills */}
          <div>
            <h3 className="type-label flex items-center gap-1.5 mb-3">
              <Zap size={11} style={{ color: 'var(--color-brand)' }} />Required Skills
              <span className="ml-auto normal-case font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
                {matched.length}/{job.requiredSkills.length} matched
              </span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {job.requiredSkills.map(skill => {
                const isMat = matched.map(s => s.toLowerCase()).includes(skill.toLowerCase());
                return (
                  <span key={skill} className="px-2.5 py-1 rounded-md text-xs font-semibold border"
                    style={isMat
                      ? { background: 'var(--color-success-light)', color: 'var(--color-success)', borderColor: 'var(--color-success-border)' }
                      : { background: 'var(--color-danger-light)', color: 'var(--color-danger)', borderColor: 'var(--color-danger-border)' }
                    }>
                    {isMat ? '✓' : '✗'} {skill}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Missing skills advice */}
          {missing.length > 0 && (
            <div className="rounded-xl p-4 space-y-3 border"
              style={{
                background: missing.length <= 2 ? 'var(--color-warning-light)' : 'var(--color-danger-light)',
                borderColor: missing.length <= 2 ? 'var(--color-warning-border)' : 'var(--color-danger-border)',
              }}>
              <div className="flex items-center gap-2">
                <Info size={13} style={{ color: missing.length <= 2 ? '#D97706' : '#DC2626' }} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: missing.length <= 2 ? '#92400E' : '#7F1D1D' }}>
                  {missing.length} skill{missing.length !== 1 ? 's' : ''} to build
                </p>
              </div>
              <div className="space-y-2">
                {missing.map(skill => (
                  <div key={skill} className="flex items-start gap-2.5 bg-white/70 rounded-lg p-2.5">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: missing.length <= 2 ? '#F59E0B' : '#EF4444' }} />
                    <div>
                      <span className="text-xs font-bold capitalize" style={{ color: 'var(--color-text-primary)' }}>{skill}</span>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                        {SKILL_ADVICE[skill.toLowerCase()] ?? `Build a hands-on project demonstrating ${skill}.`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Perfect match banner */}
          {matched.length === job.requiredSkills.length && job.requiredSkills.length > 0 && (
            <div className="rounded-xl p-3 flex items-start gap-2.5"
              style={{ background: 'var(--color-success-light)', border: '1px solid var(--color-success-border)' }}>
              <CheckCircle size={14} style={{ color: 'var(--color-success)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--color-success)' }}>Perfect Skill Match! 🎉</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-success)' }}>Your resume covers every required skill.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex-shrink-0 border-t p-4 flex items-center gap-3" style={{ borderColor: 'var(--color-border)', background: '#FFFFFF' }}>
          {isApplied && applicationStatus === 'SHORTLISTED' && onOpenChat && (
            <button type="button"
              onClick={() => onOpenChat(conversationId ?? undefined)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-150"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 4px 12px rgba(79,70,229,0.35)' }}>
              <MessageSquare size={14} />
              Chat with Recruiter
            </button>
          )}
          <button
            onClick={() => void onApply(job.id, job.title)}
            disabled={applying === job.id || !canApply}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-150"
            style={isApplied
              ? { background: 'var(--color-success-light)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)', cursor: 'not-allowed' }
              : canApply
              ? { background: 'var(--color-brand)', color: '#FFFFFF' }
              : { background: 'var(--color-border-subtle)', color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border)', cursor: 'not-allowed' }
            }
            onMouseEnter={e => { if (canApply && !isApplied) e.currentTarget.style.background = 'var(--color-brand-hover)'; }}
            onMouseLeave={e => { if (canApply && !isApplied) e.currentTarget.style.background = 'var(--color-brand)'; }}
          >
            {applying === job.id ? <Loader2 size={15} className="animate-spin" /> : isApplied ? <CheckCircle size={15} /> : <ChevronRight size={15} />}
            {isApplied ? 'Already Applied' : matchScore >= 50 ? 'Apply Now' : 'Score Below Threshold (50%)'}
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', background: '#FFFFFF' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
