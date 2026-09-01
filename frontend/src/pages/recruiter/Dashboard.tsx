import { useEffect, useState, useCallback, useMemo, type FormEvent } from 'react';
import {
  PlusCircle, Briefcase, Users, Loader2,
  Sparkles, ChevronDown, ChevronUp, RefreshCw,
  Search, Mail, Trash2, FileText, ExternalLink, Download, X, BookOpen,
  LayoutDashboard, BarChart2, Clock, TrendingUp, CheckCircle,
  AlertCircle, Target, Zap, Award,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';
import { cn } from '../../lib/cn';
import CircularProgress from '../../components/CircularProgress';

// =============================================================================
// Types
// =============================================================================
interface Job {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  minCgpa: number;
  minExperience: number;
  isActive: boolean;
  createdAt: string;
  _count?: { applications: number };
}

interface RealApplicant {
  id: string;
  matchScore: number | null;
  status: string;
  appliedAt: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    college: string;
    cgpa: number;
    experienceYears: number;
    resumeUrl: string | null;
    parsedSkills: string[];
    user: { email: string };
  };
}

type RecruiterView = 'dashboard' | 'postings' | 'applicants' | 'analytics' | 'post-job';

// =============================================================================
// RecruiterDashboard
// =============================================================================
export default function RecruiterDashboard() {

  // ── State ─────────────────────────────────────────────────────────────────
  const [jobs,                 setJobs]                 = useState<Job[]>([]);
  const [loadingJobs,          setLoadingJobs]          = useState(true);
  const [submitting,           setSubmitting]           = useState(false);
  const [activeView,           setActiveView]           = useState<RecruiterView>('dashboard');

  // Per-job applicants (loaded lazily)
  const [applicantsByJob,      setApplicantsByJob]      = useState<Record<string, RealApplicant[]>>({});
  const [loadingApplicantsFor, setLoadingApplicantsFor] = useState<string | null>(null);
  // All applicants tab — loads all at once
  const [allApplicants,        setAllApplicants]        = useState<RealApplicant[]>([]);
  const [loadingAll,           setLoadingAll]           = useState(false);
  const [allLoaded,            setAllLoaded]            = useState(false);
  const [applicantsSearch,     setApplicantsSearch]     = useState('');
  // Expanded applicant panel per job (postings view)
  const [expandedJob,          setExpandedJob]          = useState<string | null>(null);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewingId,     setViewingId]     = useState<string | null>(null);
  const [jdPreviewJob,  setJdPreviewJob]  = useState<Job | null>(null);

  // Post form state
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [minCgpa,     setMinCgpa]     = useState('');
  const [minExp,      setMinExp]      = useState('');

  // ── Fetchers ───────────────────────────────────────────────────────────────
  const fetchJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const { data } = await api.get<{ data: Job[] }>('/jobs/my-postings');
      setJobs(data.data ?? []);
    } catch {
      toast.error('Failed to load your job listings.');
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => { void fetchJobs(); }, [fetchJobs]);

  const fetchApplicantsForJob = useCallback(async (jobId: string) => {
    if (applicantsByJob[jobId]) return; // already loaded
    setLoadingApplicantsFor(jobId);
    try {
      const { data } = await api.get<{ data: RealApplicant[] }>(`/jobs/${jobId}/applicants`);
      setApplicantsByJob(prev => ({ ...prev, [jobId]: data.data ?? [] }));
    } catch {
      toast.error('Failed to load applicants.');
    } finally {
      setLoadingApplicantsFor(null);
    }
  }, [applicantsByJob]);

  const fetchAllApplicants = useCallback(async () => {
    if (allLoaded) return;
    setLoadingAll(true);
    try {
      // Fetch applicants for each job in parallel
      const results = await Promise.all(
        jobs.map(j => api.get<{ data: RealApplicant[] }>(`/jobs/${j.id}/applicants`).then(r => r.data.data ?? []).catch(() => []))
      );
      const flat = results.flat();
      setAllApplicants(flat);
      setAllLoaded(true);
    } catch {
      toast.error('Failed to load all applicants.');
    } finally {
      setLoadingAll(false);
    }
  }, [jobs, allLoaded]);

  // Load all applicants when navigating to that view
  useEffect(() => {
    if (activeView === 'applicants' && !allLoaded && jobs.length > 0) {
      void fetchAllApplicants();
    }
  }, [activeView, allLoaded, jobs.length, fetchAllApplicants]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handlePost = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) { toast.error('Title and description are required.'); return; }
    setSubmitting(true);
    try {
      await api.post('/jobs', {
        title: title.trim(), description: description.trim(),
        minCgpa:       minCgpa.trim() ? parseFloat(minCgpa) : undefined,
        minExperience: minExp.trim()  ? parseFloat(minExp)  : undefined,
      });
      toast.success('Job posted! AI has parsed the skills. 🤖');
      setTitle(''); setDescription(''); setMinCgpa(''); setMinExp('');
      setActiveView('postings');
      await fetchJobs();
    } catch { toast.error('Failed to post job.'); } finally { setSubmitting(false); }
  };

  const handleDeleteJob = async (id: string) => {
    if (!window.confirm('Delete this job posting? This cannot be undone.')) return;
    try {
      await api.delete(`/jobs/${id}`);
      toast.success('Job deleted.');
      setJobs(prev => prev.filter(j => j.id !== id));
      if (expandedJob === id) setExpandedJob(null);
    } catch { toast.error('Failed to delete job.'); }
  };

  const handleDownloadResume = async (resumeUrl: string, studentName: string, applicantId: string) => {
    setDownloadingId(applicantId);
    try {
      const res = await fetch(resumeUrl);
      if (!res.ok) throw new Error('Fetch failed');
      const blob = new Blob([await res.arrayBuffer()], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.setAttribute('download', `${studentName.replace(/\s+/g, '_')}_Resume.pdf`);
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${studentName}'s resume`);
    } catch { toast.error('Failed to download resume.'); } finally { setDownloadingId(null); }
  };

  const handleViewResume = async (resumeUrl: string, applicantId: string) => {
    setViewingId(applicantId);
    try {
      const res  = await fetch(resumeUrl);
      const blob = new Blob([await res.arrayBuffer()], { type: 'application/pdf' });
      window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer');
    } catch { toast.error('Failed to open resume.'); } finally { setViewingId(null); }
  };

  // ── Computed metrics ───────────────────────────────────────────────────────
  const totalApps   = jobs.reduce((s, j) => s + (j._count?.applications ?? 0), 0);
  const activeJobs  = jobs.filter(j => j.isActive).length;
  const avgDays     = useMemo(() => {
    if (!jobs.length) return 0;
    return Math.round(jobs.reduce((s, j) => s + Math.floor((Date.now() - new Date(j.createdAt).getTime()) / 86_400_000), 0) / jobs.length);
  }, [jobs]);

  // Analytics computed values
  const analytics = useMemo(() => {
    const skillFreq: Record<string, number> = {};
    jobs.forEach(j => j.requiredSkills.forEach(s => { skillFreq[s] = (skillFreq[s] ?? 0) + 1; }));
    const topSkills = Object.entries(skillFreq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s, c]) => ({ skill: s, count: c }));
    const avgScore  = allApplicants.length
      ? Math.round(allApplicants.reduce((s, a) => s + (a.matchScore ?? 0), 0) / allApplicants.length)
      : 0;
    const statusBreakdown = allApplicants.reduce<Record<string, number>>((acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1; return acc;
    }, {});
    return { topSkills, avgScore, statusBreakdown };
  }, [jobs, allApplicants]);

  // Filtered applicants for search
  const filteredApplicants = useMemo(() => {
    if (!applicantsSearch.trim()) return allApplicants;
    const q = applicantsSearch.toLowerCase();
    return allApplicants.filter(a =>
      `${a.student.firstName} ${a.student.lastName}`.toLowerCase().includes(q) ||
      a.student.college.toLowerCase().includes(q) ||
      a.student.user.email.toLowerCase().includes(q) ||
      a.student.parsedSkills.some(s => s.toLowerCase().includes(q))
    );
  }, [allApplicants, applicantsSearch]);

  // ── Sidebar nav ────────────────────────────────────────────────────────────
  const navItems: { view: RecruiterView; icon: React.ReactNode; label: string; badge?: number }[] = [
    { view: 'dashboard',  icon: <LayoutDashboard size={15} />, label: 'Overview' },
    { view: 'postings',   icon: <Briefcase size={15} />,       label: 'My Postings', badge: jobs.length },
    { view: 'applicants', icon: <Users size={15} />,           label: 'All Applicants', badge: totalApps },
    { view: 'analytics',  icon: <BarChart2 size={15} />,       label: 'Analytics' },
    { view: 'post-job',   icon: <PlusCircle size={15} />,      label: 'Post a Job' },
  ];

  return (
    <div className="flex gap-6 items-start w-full">

      {/* ══════════════════════════════════════════════════════════════════════
          LEFT SIDEBAR
      ══════════════════════════════════════════════════════════════════════ */}
      <aside className="w-56 shrink-0 hidden lg:flex flex-col gap-3 sticky top-24 self-start animate-slide-in-left">

        {/* Company avatar placeholder */}
        <div className="enterprise-card p-5 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600
                          flex items-center justify-center shadow-md ring-4 ring-indigo-100">
            <Briefcase size={24} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900" style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}>Recruiter Portal</p>
            <p className="text-xs text-slate-400 mt-0.5">CareerNest Dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
              {activeJobs} Active
            </span>
            <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full border border-slate-200">
              {totalApps} Apps
            </span>
          </div>
        </div>

        {/* Navigation */}
        <div className="enterprise-card p-2 flex flex-col gap-0.5">
          <p className="type-label px-3 py-1.5">Navigation</p>
          {navItems.map(({ view, icon, label, badge }) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={cn('nav-item w-full text-left', activeView === view && 'active',
                view === 'post-job' && activeView !== view && 'text-indigo-600 hover:bg-indigo-50')}
            >
              <span className={cn('nav-icon text-slate-400', view === 'post-job' && 'text-indigo-500')}>{icon}</span>
              <span className={view === 'post-job' ? 'font-semibold' : ''}>{label}</span>
              {badge !== undefined && badge > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Quick stats */}
        <div className="enterprise-card p-4 space-y-3">
          <p className="type-label">Quick Stats</p>
          {[
            { label: 'Active Jobs',  value: activeJobs,  color: 'text-emerald-700' },
            { label: 'Total Apps',   value: totalApps,   color: 'text-indigo-700'  },
            { label: 'Avg Days Up',  value: avgDays,     color: 'text-slate-700'   },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">{label}</span>
              <span className={cn('text-sm font-black', color)}>{value}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 min-w-0">

        {/* ─── VIEW: DASHBOARD ─────────────────────────────────────────────── */}
        {activeView === 'dashboard' && (
          <div className="space-y-5 animate-view-enter">
            <div className="section-header">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl font-black text-slate-900" style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif', letterSpacing: '-0.03em' }}>
                    Recruiter Dashboard
                  </h1>
                  <p className="text-slate-500 mt-0.5 text-sm">Manage job postings and review AI-scored applicants</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setActiveView('post-job')}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl
                               hover:bg-indigo-700 shadow-sm transition-all active:scale-[0.97]">
                    <PlusCircle size={14} />Post a Job
                  </button>
                  <button onClick={() => void fetchJobs()} disabled={loadingJobs}
                    className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <RefreshCw size={15} className={loadingJobs ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-3 gap-4">
              {loadingJobs ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="stat-card"><div className="skeleton h-3.5 w-20 mb-4" /><div className="skeleton h-10 w-16 mb-1" /><div className="skeleton h-3 w-28" /></div>
              )) : [
                { label: 'Active Postings',     value: activeJobs, sub: `${jobs.length - activeJobs} inactive`,       icon: <Briefcase size={18} className="text-indigo-600" />, bg: 'bg-indigo-50' },
                { label: 'Total Applications',  value: totalApps,  sub: 'across all postings',                         icon: <Users size={18} className="text-emerald-600" />,  bg: 'bg-emerald-50' },
                { label: 'Avg. Days Posted',    value: avgDays,    sub: 'avg time on market',                          icon: <Clock size={18} className="text-violet-600" />,   bg: 'bg-violet-50' },
              ].map(({ label, value, sub, icon, bg }, i) => (
                <div key={label} className={cn('stat-card animate-view-enter', `stagger-${i + 1}`)}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="type-label">{label}</span>
                    <div className={cn('p-2 rounded-lg', bg)}>{icon}</div>
                  </div>
                  <p className="text-4xl font-black text-slate-900 mb-0.5 animate-count" style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif', letterSpacing: '-0.05em' }}>{value}</p>
                  <p className="text-xs text-slate-400 font-medium">{sub}</p>
                </div>
              ))}
            </div>

            {/* Recent postings preview */}
            <div className="enterprise-card p-6 animate-view-enter stagger-3">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Briefcase size={15} className="text-indigo-500" />Recent Postings
                </h2>
                <button onClick={() => setActiveView('postings')} className="text-xs text-indigo-600 font-semibold hover:underline">View All →</button>
              </div>
              {loadingJobs ? <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
              : jobs.length === 0 ? (
                <div className="text-center py-10">
                  <Briefcase size={28} className="text-slate-300 mx-auto mb-3" />
                  <p className="font-semibold text-slate-600">No jobs posted yet</p>
                  <button onClick={() => setActiveView('post-job')} className="mt-3 text-sm text-indigo-600 font-semibold hover:underline">Post your first job →</button>
                </div>
              ) : jobs.slice(0, 3).map(job => (
                <div key={job.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{job.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(job.createdAt).toLocaleDateString()} · {job._count?.applications ?? 0} applicants</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', job.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200')}>
                      {job.isActive ? '● Active' : '● Closed'}
                    </span>
                    <button onClick={() => setActiveView('postings')} className="text-xs text-indigo-600 font-semibold hover:underline">Manage →</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Tips card */}
            <div className="enterprise-card p-5 border-indigo-100 bg-indigo-50/50 animate-view-enter stagger-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl flex-shrink-0"><Sparkles size={16} className="text-indigo-600" /></div>
                <div>
                  <p className="font-bold text-indigo-900 text-sm">Pro Tips</p>
                  <ul className="mt-2 space-y-1 text-xs text-indigo-800">
                    <li>• Write detailed JDs — the AI extracts more accurate skills</li>
                    <li>• Candidates are ranked by skill match + CGPA + experience</li>
                    <li>• Use <strong>Analytics</strong> to see which skills are most in-demand</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── VIEW: MY POSTINGS ───────────────────────────────────────────── */}
        {activeView === 'postings' && (
          <div className="space-y-5 animate-view-enter">
            <div className="section-header">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-slate-900" style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif', letterSpacing: '-0.03em' }}>My Postings</h1>
                  <p className="text-slate-500 mt-0.5 text-sm">{jobs.length} total · {activeJobs} active</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setActiveView('post-job')}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-sm transition-all">
                    <PlusCircle size={14} />New Job
                  </button>
                  <button onClick={() => void fetchJobs()} disabled={loadingJobs}
                    className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <RefreshCw size={15} className={loadingJobs ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
            </div>

            {loadingJobs ? (
              <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}</div>
            ) : jobs.length === 0 ? (
              <div className="enterprise-card p-14 text-center">
                <Briefcase size={36} className="text-slate-300 mx-auto mb-4" />
                <p className="font-bold text-slate-700 text-base">No postings yet</p>
                <p className="text-slate-400 text-sm mt-1">Post your first job to start receiving AI-ranked applicants</p>
                <button onClick={() => setActiveView('post-job')} className="btn-primary mt-5">Post a Job</button>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job, idx) => {
                  const isExpanded = expandedJob === job.id;
                  const jobApplicants = applicantsByJob[job.id] ?? [];
                  return (
                    <div key={job.id} className={cn('enterprise-card overflow-hidden animate-view-enter', `stagger-${Math.min(idx + 1, 6)}`)}>
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 text-base truncate" style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}>{job.title}</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Posted {new Date(job.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                          <span className={cn('flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold border',
                            job.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200')}>
                            {job.isActive ? '● Active' : '● Closed'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {job.requiredSkills.slice(0, 5).map(s => (
                            <span key={s} className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-semibold rounded-md">{s}</span>
                          ))}
                          {job.requiredSkills.length > 5 && <span className="text-slate-400 text-xs font-medium self-center">+{job.requiredSkills.length - 5} more</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-3 border-t border-slate-100">
                          <span>CGPA ≥ <span className="font-bold text-slate-800">{job.minCgpa}</span></span>
                          <span>Exp ≥ <span className="font-bold text-slate-800">{job.minExperience} yrs</span></span>
                          <span className="font-semibold text-emerald-700">{job._count?.applications ?? 0} Applicant{(job._count?.applications ?? 0) !== 1 ? 's' : ''}</span>
                          <div className="ml-auto flex items-center gap-3">
                            <button onClick={() => setJdPreviewJob(job)} className="flex items-center gap-1 text-slate-500 font-semibold hover:text-indigo-600 transition-colors">
                              <BookOpen size={13} />View JD
                            </button>
                            <button onClick={() => void handleDeleteJob(job.id)} className="flex items-center gap-1 text-red-400 font-semibold hover:text-red-700 transition-colors">
                              <Trash2 size={13} />Delete
                            </button>
                            <button
                              onClick={async () => {
                                if (isExpanded) { setExpandedJob(null); return; }
                                setExpandedJob(job.id);
                                await fetchApplicantsForJob(job.id);
                              }}
                              className="flex items-center gap-1 text-indigo-600 font-semibold hover:text-indigo-800 transition-colors">
                              <Users size={13} />
                              {isExpanded ? 'Hide' : 'Applicants'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Applicant panel */}
                      {isExpanded && (
                        <div className="bg-slate-50 border-t border-slate-200 p-5 animate-slide-up">
                          <h4 className="type-label mb-4 flex items-center gap-2">
                            <Search size={12} className="text-indigo-500" />AI Ranked Applicants
                            {!loadingApplicantsFor && <span className="ml-auto text-indigo-600 font-bold normal-case text-sm">{jobApplicants.length}</span>}
                          </h4>
                          {loadingApplicantsFor === job.id ? (
                            <div className="flex items-center justify-center py-8 gap-3 text-slate-400"><Loader2 size={18} className="animate-spin text-indigo-500" /><span className="text-sm">Loading…</span></div>
                          ) : jobApplicants.length === 0 ? (
                            <div className="text-center py-8"><Users size={22} className="text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-400">No applications yet</p></div>
                          ) : (
                            <div className="space-y-3">
                              {jobApplicants.map(a => <ApplicantRow key={a.id} applicant={a} onDownload={handleDownloadResume} onView={handleViewResume} downloadingId={downloadingId} viewingId={viewingId} />)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── VIEW: ALL APPLICANTS ────────────────────────────────────────── */}
        {activeView === 'applicants' && (
          <div className="space-y-5 animate-view-enter">
            <div className="section-header">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl font-black text-slate-900" style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif', letterSpacing: '-0.03em' }}>All Applicants</h1>
                  <p className="text-slate-500 mt-0.5 text-sm">Every candidate who has applied to your postings, AI-ranked</p>
                </div>
                <button onClick={() => { setAllLoaded(false); void fetchAllApplicants(); }} disabled={loadingAll}
                  className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                  <RefreshCw size={15} className={loadingAll ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Summary stats */}
            {!loadingAll && allLoaded && (
              <div className="grid grid-cols-3 gap-4 animate-view-enter">
                {[
                  { label: 'Total Applicants', value: allApplicants.length, icon: <Users size={16} className="text-indigo-600" />, bg: 'bg-indigo-50' },
                  { label: 'Avg Match Score',  value: `${analytics.avgScore}%`, icon: <Target size={16} className="text-emerald-600" />, bg: 'bg-emerald-50' },
                  { label: 'Pending Review',   value: analytics.statusBreakdown['PENDING'] ?? 0, icon: <AlertCircle size={16} className="text-amber-600" />, bg: 'bg-amber-50' },
                ].map(({ label, value, icon, bg }) => (
                  <div key={label} className="stat-card">
                    <div className="flex items-center justify-between mb-2"><span className="type-label">{label}</span><div className={cn('p-2 rounded-lg', bg)}>{icon}</div></div>
                    <p className="text-2xl font-black text-slate-900" style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Search bar */}
            {allLoaded && (
              <div className="relative animate-view-enter stagger-2">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search by name, college, skill, or email…" value={applicantsSearch} onChange={e => setApplicantsSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400
                             focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 transition-all" />
              </div>
            )}

            {/* Applicant list */}
            {loadingAll ? (
              <div className="enterprise-card p-12 flex flex-col items-center gap-4">
                <Loader2 size={28} className="animate-spin text-indigo-500" />
                <p className="text-sm font-medium text-slate-500">Fetching all applicants across {jobs.length} postings…</p>
              </div>
            ) : !allLoaded ? (
              <div className="enterprise-card p-12 text-center">
                <Users size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-slate-600">No data loaded yet</p>
              </div>
            ) : filteredApplicants.length === 0 ? (
              <div className="enterprise-card p-12 text-center">
                <Search size={28} className="text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-slate-600">No applicants found</p>
                <p className="text-slate-400 text-sm mt-1">{applicantsSearch ? 'Try a different search term' : 'No one has applied yet'}</p>
              </div>
            ) : (
              <div className="enterprise-card p-6 animate-view-enter stagger-3">
                <h2 className="type-label mb-4 flex items-center gap-2">
                  <Users size={12} className="text-indigo-400" />
                  {filteredApplicants.length} Candidate{filteredApplicants.length !== 1 ? 's' : ''}
                  {applicantsSearch && <span className="normal-case text-slate-400 font-normal">matching "{applicantsSearch}"</span>}
                </h2>
                <div className="space-y-3">
                  {filteredApplicants.map((a, i) => (
                    <div key={`${a.id}-${i}`} className={cn('animate-view-enter', `stagger-${Math.min(i + 1, 6)}`)}>
                      <ApplicantRow applicant={a} onDownload={handleDownloadResume} onView={handleViewResume} downloadingId={downloadingId} viewingId={viewingId} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── VIEW: ANALYTICS ─────────────────────────────────────────────── */}
        {activeView === 'analytics' && (
          <div className="space-y-5 animate-view-enter">
            <div className="section-header">
              <h1 className="text-2xl font-black text-slate-900" style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif', letterSpacing: '-0.03em' }}>Analytics</h1>
              <p className="text-slate-500 mt-0.5 text-sm">Aggregated insights from your postings</p>
            </div>

            {/* Overview stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-view-enter">
              {[
                { label: 'Total Jobs',    value: jobs.length,  icon: <Briefcase size={16} className="text-indigo-600" />,  bg: 'bg-indigo-50' },
                { label: 'Active Jobs',   value: activeJobs,   icon: <CheckCircle size={16} className="text-emerald-600" />, bg: 'bg-emerald-50' },
                { label: 'Total Apps',    value: totalApps,    icon: <Users size={16} className="text-violet-600" />,       bg: 'bg-violet-50' },
                { label: 'Avg Days Up',   value: avgDays,      icon: <Clock size={16} className="text-amber-600" />,        bg: 'bg-amber-50' },
              ].map(({ label, value, icon, bg }, i) => (
                <div key={label} className={cn('stat-card animate-view-enter', `stagger-${i + 1}`)}>
                  <div className="flex items-center justify-between mb-2"><span className="type-label">{label}</span><div className={cn('p-2 rounded-lg', bg)}>{icon}</div></div>
                  <p className="text-3xl font-black text-slate-900" style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif', letterSpacing: '-0.04em' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Top required skills */}
            <div className="enterprise-card p-6 animate-view-enter stagger-2">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-5">
                <Zap size={15} className="text-indigo-500" />Top Required Skills
                <span className="type-label ml-1">across all postings</span>
              </h2>
              {analytics.topSkills.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Post jobs to see skill trends</p>
              ) : (
                <div className="space-y-3">
                  {analytics.topSkills.map(({ skill, count }, i) => {
                    const pct = Math.round((count / jobs.length) * 100);
                    return (
                      <div key={skill} className={cn('animate-view-enter', `stagger-${Math.min(i + 1, 6)}`)}>
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-400 w-4">#{i + 1}</span>
                            <span className="text-sm font-semibold text-slate-700 capitalize">{skill}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">{count}/{jobs.length} jobs</span>
                            <span className="text-sm font-black text-indigo-600">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full skill-bar-fill bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Jobs performance table */}
            {jobs.length > 0 && (
              <div className="enterprise-card p-6 animate-view-enter stagger-3">
                <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                  <TrendingUp size={15} className="text-indigo-500" />Job Performance
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Job Title', 'Posted', 'Applicants', 'Skills', 'Status'].map(h => (
                          <th key={h} className="type-label pb-3 text-left pr-4 last:pr-0">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map(job => (
                        <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 pr-4 font-semibold text-slate-900 max-w-[160px] truncate">{job.title}</td>
                          <td className="py-3 pr-4 text-slate-500 text-xs">{new Date(job.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                          <td className="py-3 pr-4 font-bold text-indigo-600">{job._count?.applications ?? 0}</td>
                          <td className="py-3 pr-4 text-slate-500 text-xs">{job.requiredSkills.length} skills</td>
                          <td className="py-3">
                            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border',
                              job.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200')}>
                              {job.isActive ? 'Active' : 'Closed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Applicant status breakdown */}
            {Object.keys(analytics.statusBreakdown).length > 0 && (
              <div className="enterprise-card p-6 animate-view-enter stagger-4">
                <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                  <Award size={15} className="text-indigo-500" />Applicant Status Breakdown
                </h2>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(analytics.statusBreakdown).map(([status, count]) => (
                    <div key={status} className={cn('px-4 py-3 rounded-xl border text-center min-w-[100px]',
                      status === 'PENDING'     ? 'bg-amber-50 border-amber-200'  :
                      status === 'SHORTLISTED' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-100 border-slate-200')}>
                      <p className={cn('text-2xl font-black', status === 'PENDING' ? 'text-amber-700' : status === 'SHORTLISTED' ? 'text-emerald-700' : 'text-slate-700')} style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}>{count}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">{status}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── VIEW: POST A JOB ────────────────────────────────────────────── */}
        {activeView === 'post-job' && (
          <div className="space-y-5 animate-view-enter">
            <div className="section-header">
              <h1 className="text-2xl font-black text-slate-900" style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif', letterSpacing: '-0.03em' }}>Post a New Job</h1>
              <p className="text-slate-500 mt-0.5 text-sm flex items-center gap-1.5">
                <Sparkles size={13} className="text-indigo-500" />AI will automatically extract required skills from your description
              </p>
            </div>

            <div className="enterprise-card p-8 animate-view-enter stagger-1">
              <form onSubmit={e => { void handlePost(e); }} className="space-y-6 max-w-2xl">
                {/* Job Title */}
                <div>
                  <label className="type-label block mb-2">Job Title *</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
                    placeholder="e.g. Full Stack Developer Intern"
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400
                               focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                </div>

                {/* Job Description */}
                <div>
                  <label className="type-label block mb-2">Job Description *</label>
                  <div className="relative">
                    <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={8}
                      placeholder={`Describe the role and requirements.\n\nExample:\nWe are looking for a React/Node.js developer...\n\nRequired Skills: React, TypeScript, MongoDB, REST APIs\nMin CGPA: 7.5\nExperience: 1+ year`}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 resize-y
                                 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                    {description.length > 0 && (
                      <span className="absolute bottom-3 right-3 text-[10px] text-slate-400 font-medium">{description.length} chars</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                    <Sparkles size={10} className="text-indigo-400" />The more detail you provide, the more accurately AI can extract required skills
                  </p>
                </div>

                {/* CGPA + Experience */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="type-label block mb-2">Min CGPA <span className="normal-case font-normal text-slate-400">(optional)</span></label>
                    <input type="number" value={minCgpa} onChange={e => setMinCgpa(e.target.value)} step="0.1" min="0" max="10"
                      placeholder="e.g. 7.0 — or leave blank for AI"
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400
                                 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                  </div>
                  <div>
                    <label className="type-label block mb-2">Min Experience <span className="normal-case font-normal text-slate-400">(years, optional)</span></label>
                    <input type="number" value={minExp} onChange={e => setMinExp(e.target.value)} step="0.5" min="0"
                      placeholder="e.g. 1 — or leave blank"
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400
                                 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                  </div>
                </div>

                {/* Info box */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
                  <Sparkles size={14} className="text-indigo-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-indigo-700 leading-relaxed">
                    <strong>AI Skill Extraction:</strong> Our Gemini-powered engine reads your description and pulls out exact technical skills, frameworks, and tools. Students will be ranked by how well their parsed resume matches these skills.
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button type="submit" disabled={submitting}
                    className="flex items-center gap-2 px-7 py-3 bg-indigo-600 text-white font-bold rounded-xl
                               hover:bg-indigo-700 active:scale-[0.97] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}>
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {submitting ? 'Posting & Parsing…' : 'Post Job with AI'}
                  </button>
                  <button type="button" onClick={() => setActiveView('dashboard')}
                    className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 text-sm font-semibold transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* JD Preview Modal */}
      {jdPreviewJob && <RecruiterJDModal job={jdPreviewJob} onClose={() => setJdPreviewJob(null)} />}
    </div>
  );
}

// =============================================================================
// Shared: ApplicantRow
// =============================================================================
function ApplicantRow({ applicant, onDownload, onView, downloadingId, viewingId }: {
  applicant: RealApplicant;
  onDownload: (url: string, name: string, id: string) => Promise<void>;
  onView: (url: string, id: string) => Promise<void>;
  downloadingId: string | null;
  viewingId: string | null;
}) {
  const name  = `${applicant.student.firstName} ${applicant.student.lastName}`.trim() || applicant.student.user.email;
  const score = applicant.matchScore ?? 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between
                    hover:border-indigo-200 hover:shadow-card transition-all duration-200">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0"><CircularProgress score={score} size={52} stroke={5} /></div>
        <div>
          <p className="font-bold text-slate-900 text-sm" style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}>{name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{applicant.student.college} · <span className="font-semibold">{applicant.student.cgpa}</span> CGPA</p>
          <span className={cn('inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide',
            applicant.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : applicant.status === 'SHORTLISTED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200')}>
            {applicant.status}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {applicant.student.resumeUrl ? (
          <>
            <button disabled={viewingId === applicant.id}
              onClick={() => void onView(applicant.student.resumeUrl!, applicant.id)}
              className="px-2.5 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 border border-indigo-100 disabled:opacity-50">
              {viewingId === applicant.id ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
              {viewingId === applicant.id ? '…' : 'View'}
              {viewingId !== applicant.id && <ExternalLink size={9} />}
            </button>
            <button disabled={downloadingId === applicant.id}
              onClick={() => void onDownload(applicant.student.resumeUrl!, name, applicant.id)}
              className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 border border-emerald-100 disabled:opacity-50">
              {downloadingId === applicant.id ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
              {downloadingId === applicant.id ? '…' : 'PDF'}
            </button>
          </>
        ) : (
          <span className="px-2.5 py-1.5 bg-slate-100 text-slate-400 text-xs rounded-lg border border-slate-200">No Resume</span>
        )}
        <a href={`mailto:${applicant.student.user.email}`}
          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          title={applicant.student.user.email}>
          <Mail size={15} />
        </a>
      </div>
    </div>
  );
}

// =============================================================================
// RecruiterJDModal
// =============================================================================
function RecruiterJDModal({ job, onClose }: { job: Job; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-white w-full sm:max-w-2xl max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-slide-up overflow-hidden">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-900" style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}>{job.title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Posted {new Date(job.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="flex flex-wrap gap-2">
            <span className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700">Min CGPA: <span className="text-indigo-700 font-black ml-0.5">{job.minCgpa}</span></span>
            <span className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700">Min Experience: <span className="text-indigo-700 font-black ml-0.5">{job.minExperience} yrs</span></span>
            <span className={cn('px-3 py-1.5 rounded-lg text-xs font-bold border', job.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200')}>{job.isActive ? '● Active' : '● Closed'}</span>
          </div>
          <div>
            <p className="type-label mb-2">AI-Extracted Required Skills</p>
            <div className="flex flex-wrap gap-1.5">{job.requiredSkills.map(s => <span key={s} className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold rounded-md">{s}</span>)}</div>
          </div>
          <div>
            <p className="type-label mb-3 flex items-center gap-1.5"><FileText size={11} className="text-indigo-400" />Full Job Description</p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{job.description}</p>
          </div>
        </div>
        <div className="flex-shrink-0 border-t border-slate-200 p-5 bg-white">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// CollapsibleSection (used internally)
// =============================================================================
function _CollapsibleTrigger({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
    </button>
  );
}

// Suppressing unused warning — keeping for future feature use
void _CollapsibleTrigger;
