import { useEffect, useState, useCallback, useMemo, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  PlusCircle, Briefcase, Users, Loader2,
  Sparkles, ChevronDown, ChevronUp, RefreshCw,
  Search, Mail, Trash2, FileText, ExternalLink, Download, X, BookOpen,
  LayoutDashboard, BarChart2, Clock, TrendingUp, CheckCircle,
  AlertCircle, Target, Zap, Award, MessageSquare, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';
import { getSocket } from '../../lib/socket';
import { cn } from '../../lib/cn';
import CircularProgress from '../../components/CircularProgress';
import NotificationBell from '../../components/NotificationBell';
import { useChatStore } from '../../store/chatStore';

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
  conversationId?: string | null;
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

  // Per-job applicants — loaded lazily on expand
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

  // Real-time Chat integration
  const openChat = useChatStore((s) => s.openChat);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SHORTLISTED' | 'REJECTED'>('ALL');
  const [searchParams] = useSearchParams();

  // Open chat from URL query param (notification deep-link)
  useEffect(() => {
    const qConvId = searchParams.get('conversationId');
    if (qConvId) {
      openChat(qConvId);
    }
  }, [searchParams, openChat]);

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

  // Real-time Socket — incoming application notifications
  useEffect(() => {
    const socket = getSocket();
    const handleNewApplicant = (data: { jobId: string; jobTitle: string; studentName: string; matchScore: number }) => {
      toast(`📥 ${data.studentName} applied to "${data.jobTitle}" (${data.matchScore}% Match)!`, {
        icon: '🎯', duration: 6000,
      });
      void fetchJobs();
      // Invalidate cached applicant list so it refreshes next time
      setApplicantsByJob(prev => {
        if (!prev[data.jobId]) return prev;
        const next = { ...prev };
        delete next[data.jobId];
        return next;
      });
      setAllLoaded(false);
    };
    socket.on('recruiter:new_applicant', handleNewApplicant);
    return () => { socket.off('recruiter:new_applicant', handleNewApplicant); };
  }, [fetchJobs]);

  const fetchApplicantsForJob = useCallback(async (jobId: string) => {
    if (applicantsByJob[jobId]) return; // already cached
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
      // Parallel fetch across all jobs
      const results = await Promise.all(
        jobs.map(j => api.get<{ data: RealApplicant[] }>(`/jobs/${j.id}/applicants`).then(r => r.data.data ?? []).catch(() => []))
      );
      setAllApplicants(results.flat());
      setAllLoaded(true);
    } catch {
      toast.error('Failed to load all applicants.');
    } finally {
      setLoadingAll(false);
    }
  }, [jobs, allLoaded]);

  // ── Application Status Transition ──────────────────────────────────────────
  const handleStatusChange = async (applicantId: string, status: 'SHORTLISTED' | 'REJECTED') => {
    setStatusUpdatingId(applicantId);
    try {
      const res = await api.patch<{ success: boolean; data: { conversationId?: string } }>(
        `/jobs/applications/${applicantId}/status`,
        { status },
      );
      if (res.data.success) {
        toast.success(
          status === 'SHORTLISTED'
            ? '🎉 Candidate Shortlisted! Direct 1-on-1 chat unlocked.'
            : 'Application marked as Rejected.',
        );
        // Update in per-job cache
        setApplicantsByJob(prev => {
          const next = { ...prev };
          for (const k of Object.keys(next)) {
            next[k] = next[k].map(a =>
              a.id === applicantId ? { ...a, status, conversationId: res.data.data.conversationId } : a,
            );
          }
          return next;
        });
        // Update in all-applicants list
        setAllApplicants(prev =>
          prev.map(a =>
            a.id === applicantId ? { ...a, status, conversationId: res.data.data.conversationId } : a,
          ),
        );
        // Open chat immediately on shortlist
        if (status === 'SHORTLISTED' && res.data.data.conversationId) {
          openChat(res.data.data.conversationId);
        }
      }
    } catch {
      toast.error('Failed to update application status.');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Load all applicants when switching to that view
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
      const res  = await fetch(resumeUrl);
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
  const totalApps  = jobs.reduce((s, j) => s + (j._count?.applications ?? 0), 0);
  const activeJobs = jobs.filter(j => j.isActive).length;
  const avgDays    = useMemo(() => {
    if (!jobs.length) return 0;
    return Math.round(jobs.reduce((s, j) => s + Math.floor((Date.now() - new Date(j.createdAt).getTime()) / 86_400_000), 0) / jobs.length);
  }, [jobs]);

  // Analytics derived values
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

  // Filtered applicants with search + status filter
  const filteredApplicants = useMemo(() => {
    let list = allApplicants;
    if (statusFilter !== 'ALL') {
      list = list.filter(a => a.status === statusFilter);
    }
    if (!applicantsSearch.trim()) return list;
    const q = applicantsSearch.toLowerCase();
    return list.filter(a =>
      `${a.student.firstName} ${a.student.lastName}`.toLowerCase().includes(q) ||
      a.student.college.toLowerCase().includes(q) ||
      a.student.user.email.toLowerCase().includes(q) ||
      a.student.parsedSkills.some(s => s.toLowerCase().includes(q))
    );
  }, [allApplicants, applicantsSearch, statusFilter]);

  // ── Sidebar nav ────────────────────────────────────────────────────────────
  const navItems: { view: RecruiterView; icon: React.ReactNode; label: string; badge?: number }[] = [
    { view: 'dashboard',  icon: <LayoutDashboard size={14} />, label: 'Overview' },
    { view: 'postings',   icon: <Briefcase size={14} />,       label: 'My Postings', badge: jobs.length },
    { view: 'applicants', icon: <Users size={14} />,           label: 'All Applicants', badge: totalApps },
    { view: 'analytics',  icon: <BarChart2 size={14} />,       label: 'Analytics' },
    { view: 'post-job',   icon: <PlusCircle size={14} />,      label: 'Post a Job' },
  ];

  return (
    <div className="flex gap-6 items-start w-full">

      {/* ══════════════════════════════════════════════════════════════════════
          LEFT SIDEBAR
      ══════════════════════════════════════════════════════════════════════ */}
      <aside className="w-52 shrink-0 hidden lg:flex flex-col gap-3 sticky top-20 self-start animate-slide-in-left">

        {/* Company avatar placeholder */}
        <div className="cn-card p-4 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-sm"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
            <Briefcase size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}>Recruiter Portal</p>
            <p className="type-caption mt-0.5">CareerNest Dashboard</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 text-xs font-bold rounded-full"
              style={{ background: 'var(--color-success-light)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)' }}>
              {activeJobs} Active
            </span>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full"
              style={{ background: 'var(--color-border-subtle)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
              {totalApps} Apps
            </span>
          </div>
        </div>

        {/* Navigation */}
        <div className="cn-card p-2 flex flex-col gap-0.5">
          <p className="type-label px-3 py-1.5">Navigation</p>
          {navItems.map(({ view, icon, label, badge }) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={cn('nav-item', activeView === view && 'active',
                view === 'post-job' && activeView !== view && 'text-indigo-600')}
            >
              <span className="nav-icon" style={{ color: activeView === view ? 'var(--color-brand)' : view === 'post-job' ? 'var(--color-brand)' : 'var(--color-text-tertiary)' }}>
                {icon}
              </span>
              <span className={view === 'post-job' ? 'font-semibold' : ''}>{label}</span>
              {badge !== undefined && badge > 0 && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Quick stats */}
        <div className="cn-card p-4 space-y-2.5">
          <p className="type-label">Quick Stats</p>
          {[
            { label: 'Active Jobs', value: activeJobs, color: 'var(--color-success)' },
            { label: 'Total Apps',  value: totalApps,  color: 'var(--color-brand)'   },
            { label: 'Avg Days Up', value: avgDays,    color: 'var(--color-text-primary)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="type-caption">{label}</span>
              <span className="text-sm font-black" style={{ color, fontFamily: 'var(--font-heading)' }}>{value}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 min-w-0">

        {/* ─── VIEW: OVERVIEW DASHBOARD ────────────────────────────────────── */}
        {activeView === 'dashboard' && (
          <div className="space-y-5 animate-view-enter">
            <div className="section-header">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl font-black" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em' }}>
                    Recruiter Dashboard
                  </h1>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    Manage job postings and review AI-scored applicants
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => openChat(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all"
                    style={{ background: '#FFFFFF', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', boxShadow: 'var(--shadow-xs)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-brand)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-secondary)')}>
                    <MessageSquare size={13} style={{ color: 'var(--color-brand)' }} />
                    Live Chat
                  </button>
                  <NotificationBell onOpenChat={(convId) => openChat(convId ?? null)} />
                  <button onClick={() => setActiveView('post-job')}
                    className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-bold text-white rounded-xl shadow-sm transition-all active:scale-[0.97]"
                    style={{ background: 'var(--color-brand)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-brand-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-brand)')}>
                    <PlusCircle size={14} />Post a Job
                  </button>
                  <button onClick={() => void fetchJobs()} disabled={loadingJobs}
                    className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--color-text-tertiary)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-brand)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}>
                    <RefreshCw size={14} className={loadingJobs ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-3 gap-4">
              {loadingJobs ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="stat-card"><div className="skeleton h-3 w-20 mb-4" /><div className="skeleton h-9 w-16 mb-1" /><div className="skeleton h-2.5 w-28" /></div>
              )) : [
                { label: 'Active Postings',    value: activeJobs, sub: `${jobs.length - activeJobs} inactive`, icon: <Briefcase size={16} style={{ color: 'var(--color-brand)' }} />, bg: 'var(--color-brand-light)' },
                { label: 'Total Applications', value: totalApps,  sub: 'across all postings',                   icon: <Users size={16} className="text-emerald-600" />,               bg: '#F0FDF4' },
                { label: 'Avg. Days Posted',   value: avgDays,    sub: 'avg time on market',                    icon: <Clock size={16} className="text-violet-600" />,                bg: '#F5F3FF' },
              ].map(({ label, value, sub, icon, bg }, i) => (
                <div key={label} className={cn('stat-card animate-view-enter', `stagger-${i + 1}`)}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="type-label">{label}</span>
                    <div className="p-2 rounded-lg" style={{ background: bg }}>{icon}</div>
                  </div>
                  <p className="text-3xl font-black mb-0.5 animate-count" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', letterSpacing: '-0.05em' }}>
                    {value}
                  </p>
                  <p className="type-caption">{sub}</p>
                </div>
              ))}
            </div>

            {/* Recent postings preview */}
            <div className="cn-card p-5 animate-view-enter stagger-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                  <Briefcase size={14} style={{ color: 'var(--color-brand)' }} />Recent Postings
                </h2>
                <button onClick={() => setActiveView('postings')} className="text-xs font-semibold hover:underline" style={{ color: 'var(--color-brand)' }}>
                  View All →
                </button>
              </div>
              {loadingJobs ? (
                <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-8">
                  <Briefcase size={24} className="mx-auto mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
                  <p className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>No jobs posted yet</p>
                  <button onClick={() => setActiveView('post-job')} className="mt-2 text-sm font-semibold hover:underline" style={{ color: 'var(--color-brand)' }}>
                    Post your first job →
                  </button>
                </div>
              ) : jobs.slice(0, 3).map(job => (
                <div key={job.id} className="flex items-center justify-between py-3 border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                  <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}>{job.title}</p>
                    <p className="type-caption mt-0.5">{new Date(job.createdAt).toLocaleDateString()} · {job._count?.applications ?? 0} applicants</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border')}
                      style={job.isActive
                        ? { background: 'var(--color-success-light)', color: 'var(--color-success)', borderColor: 'var(--color-success-border)' }
                        : { background: 'var(--color-border-subtle)', color: 'var(--color-text-tertiary)', borderColor: 'var(--color-border)' }
                      }>
                      {job.isActive ? '● Active' : '● Closed'}
                    </span>
                    <button onClick={() => setActiveView('postings')} className="text-xs font-semibold hover:underline" style={{ color: 'var(--color-brand)' }}>
                      Manage →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pro tips card */}
            <div className="cn-card p-4 animate-view-enter stagger-4" style={{ borderColor: 'var(--color-brand-border)', background: 'var(--color-brand-light)' }}>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl flex-shrink-0" style={{ background: '#E0E7FF' }}>
                  <Sparkles size={14} style={{ color: 'var(--color-brand)' }} />
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: '#1E1B4B' }}>Pro Tips</p>
                  <ul className="mt-2 space-y-1 text-xs" style={{ color: '#3730A3' }}>
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
                  <h1 className="text-2xl font-black" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em' }}>My Postings</h1>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{jobs.length} total · {activeJobs} active</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setActiveView('post-job')}
                    className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-bold text-white rounded-xl shadow-sm transition-all"
                    style={{ background: 'var(--color-brand)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-brand-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-brand)')}>
                    <PlusCircle size={14} />New Job
                  </button>
                  <button onClick={() => void fetchJobs()} disabled={loadingJobs}
                    className="p-2 rounded-xl border transition-colors"
                    style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-tertiary)', background: '#FFFFFF' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-brand)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}>
                    <RefreshCw size={14} className={loadingJobs ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
            </div>

            {loadingJobs ? (
              <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}</div>
            ) : jobs.length === 0 ? (
              <div className="cn-card p-12 text-center">
                <Briefcase size={32} className="mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
                <p className="font-bold" style={{ color: 'var(--color-text-primary)' }}>No postings yet</p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Post your first job to start receiving AI-ranked applicants</p>
                <button onClick={() => setActiveView('post-job')} className="btn-primary mt-5">Post a Job</button>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job, idx) => {
                  const isExpanded = expandedJob === job.id;
                  const jobApplicants = applicantsByJob[job.id] ?? [];
                  return (
                    <div key={job.id} className={cn('cn-card overflow-hidden animate-view-enter', `stagger-${Math.min(idx + 1, 6)}`)}>
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base truncate" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}>{job.title}</h3>
                            <p className="type-caption mt-0.5">Posted {new Date(job.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                          <span className={cn('flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold border')}
                            style={job.isActive
                              ? { background: 'var(--color-success-light)', color: 'var(--color-success)', borderColor: 'var(--color-success-border)' }
                              : { background: 'var(--color-border-subtle)', color: 'var(--color-text-tertiary)', borderColor: 'var(--color-border)' }
                            }>
                            {job.isActive ? '● Active' : '● Closed'}
                          </span>
                        </div>
                        {/* Skill tags */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {job.requiredSkills.slice(0, 5).map(s => (
                            <span key={s} className="px-2 py-0.5 text-[11px] font-medium rounded-md"
                              style={{ background: 'var(--color-brand-light)', color: 'var(--color-brand)', border: '1px solid var(--color-brand-border)' }}>
                              {s}
                            </span>
                          ))}
                          {job.requiredSkills.length > 5 && (
                            <span className="type-caption self-center">+{job.requiredSkills.length - 5} more</span>
                          )}
                        </div>
                        {/* Job meta + actions */}
                        <div className="flex flex-wrap items-center gap-4 text-xs pt-3 border-t" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                          <span>CGPA ≥ <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{job.minCgpa}</span></span>
                          <span>Exp ≥ <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{job.minExperience} yrs</span></span>
                          <span className="font-semibold" style={{ color: 'var(--color-success)' }}>
                            {job._count?.applications ?? 0} Applicant{(job._count?.applications ?? 0) !== 1 ? 's' : ''}
                          </span>
                          <div className="ml-auto flex items-center gap-3">
                            <button onClick={() => setJdPreviewJob(job)}
                              className="flex items-center gap-1 font-semibold transition-colors"
                              style={{ color: 'var(--color-text-secondary)' }}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-brand)')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-secondary)')}>
                              <BookOpen size={12} />View JD
                            </button>
                            <button onClick={() => void handleDeleteJob(job.id)}
                              className="flex items-center gap-1 font-semibold text-red-400 hover:text-red-600 transition-colors">
                              <Trash2 size={12} />Delete
                            </button>
                            <button
                              onClick={async () => {
                                if (isExpanded) { setExpandedJob(null); return; }
                                setExpandedJob(job.id);
                                await fetchApplicantsForJob(job.id);
                              }}
                              className="flex items-center gap-1 font-semibold transition-colors"
                              style={{ color: 'var(--color-brand)' }}>
                              <Users size={12} />
                              {isExpanded ? 'Hide' : 'Applicants'}
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Inline applicant panel */}
                      {isExpanded && (
                        <div className="border-t p-5 animate-slide-up" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
                          <h4 className="type-label flex items-center gap-2 mb-4">
                            <Search size={11} style={{ color: 'var(--color-brand)' }} />AI Ranked Applicants
                            {!loadingApplicantsFor && (
                              <span className="ml-auto normal-case font-bold text-sm" style={{ color: 'var(--color-brand)' }}>{jobApplicants.length}</span>
                            )}
                          </h4>
                          {loadingApplicantsFor === job.id ? (
                            <div className="flex items-center justify-center py-8 gap-3" style={{ color: 'var(--color-text-tertiary)' }}>
                              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-brand)' }} />
                              <span className="text-sm">Loading…</span>
                            </div>
                          ) : jobApplicants.length === 0 ? (
                            <div className="text-center py-7">
                              <Users size={20} className="mx-auto mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
                              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No applications yet</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {jobApplicants.map(a => (
                                <ApplicantRow
                                  key={a.id}
                                  applicant={a}
                                  onDownload={handleDownloadResume}
                                  onView={handleViewResume}
                                  downloadingId={downloadingId}
                                  viewingId={viewingId}
                                  onStatusChange={handleStatusChange}
                                  onOpenChat={(convId) => openChat(convId ?? null)}
                                  statusLoadingId={statusUpdatingId}
                                />
                              ))}
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

        {/* ─── VIEW: ALL APPLICANTS ─────────────────────────────────────────── */}
        {activeView === 'applicants' && (
          <div className="space-y-5 animate-view-enter">
            <div className="section-header">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl font-black" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em' }}>All Applicants</h1>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Every candidate who has applied to your postings, AI-ranked</p>
                </div>
                <button onClick={() => { setAllLoaded(false); void fetchAllApplicants(); }} disabled={loadingAll}
                  className="p-2 rounded-xl border transition-colors"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-tertiary)', background: '#FFFFFF' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-brand)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}>
                  <RefreshCw size={14} className={loadingAll ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Summary stats */}
            {!loadingAll && allLoaded && (
              <div className="grid grid-cols-3 gap-4 animate-view-enter">
                {[
                  { label: 'Total Applicants', value: allApplicants.length, icon: <Users size={15} style={{ color: 'var(--color-brand)' }} />, bg: 'var(--color-brand-light)' },
                  { label: 'Avg Match Score',  value: `${analytics.avgScore}%`, icon: <Target size={15} className="text-emerald-600" />, bg: '#F0FDF4' },
                  { label: 'Pending Review',   value: analytics.statusBreakdown['PENDING'] ?? 0, icon: <AlertCircle size={15} className="text-amber-600" />, bg: '#FFFBEB' },
                ].map(({ label, value, icon, bg }) => (
                  <div key={label} className="stat-card">
                    <div className="flex items-center justify-between mb-2">
                      <span className="type-label">{label}</span>
                      <div className="p-2 rounded-lg" style={{ background: bg }}>{icon}</div>
                    </div>
                    <p className="text-2xl font-black" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', letterSpacing: '-0.04em' }}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Search + status filter */}
            {allLoaded && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-view-enter stagger-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-tertiary)' }} />
                  <input type="text" placeholder="Search by name, college, skill, or email…"
                    value={applicantsSearch} onChange={e => setApplicantsSearch(e.target.value)}
                    className="cn-input pl-9" />
                </div>
                {/* Status filter pills */}
                <div className="flex items-center gap-1 p-1 rounded-xl border overflow-x-auto"
                  style={{ background: 'var(--color-border-subtle)', border: '1px solid var(--color-border)' }}>
                  {[
                    { key: 'ALL',        label: `All (${allApplicants.length})` },
                    { key: 'PENDING',    label: `Pending (${analytics.statusBreakdown['PENDING'] ?? 0})` },
                    { key: 'SHORTLISTED',label: `Shortlisted (${analytics.statusBreakdown['SHORTLISTED'] ?? 0})` },
                    { key: 'REJECTED',   label: `Rejected (${analytics.statusBreakdown['REJECTED'] ?? 0})` },
                  ].map(({ key, label }) => (
                    <button key={key} type="button" onClick={() => setStatusFilter(key as typeof statusFilter)}
                      className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 whitespace-nowrap')}
                      style={statusFilter === key
                        ? { background: '#FFFFFF', color: 'var(--color-brand)', boxShadow: 'var(--shadow-xs)', border: '1px solid var(--color-brand-border)' }
                        : { color: 'var(--color-text-secondary)' }
                      }>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Applicant list */}
            {loadingAll ? (
              <div className="cn-card p-12 flex flex-col items-center gap-4">
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-brand)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Fetching all applicants across {jobs.length} postings…
                </p>
              </div>
            ) : !allLoaded ? (
              <div className="cn-card p-12 text-center">
                <Users size={28} className="mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
                <p className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>No data loaded yet</p>
              </div>
            ) : filteredApplicants.length === 0 ? (
              <div className="cn-card p-12 text-center">
                <Search size={24} className="mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
                <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>No applicants found</p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {applicantsSearch ? 'Try a different search term' : 'No one has applied yet'}
                </p>
              </div>
            ) : (
              <div className="cn-card p-5 animate-view-enter stagger-3">
                <h2 className="type-label flex items-center gap-2 mb-4">
                  <Users size={11} style={{ color: 'var(--color-brand)' }} />
                  {filteredApplicants.length} Candidate{filteredApplicants.length !== 1 ? 's' : ''}
                  {applicantsSearch && <span className="normal-case font-normal" style={{ color: 'var(--color-text-tertiary)' }}>matching &quot;{applicantsSearch}&quot;</span>}
                </h2>
                <div className="space-y-3">
                  {filteredApplicants.map((a, i) => (
                    <div key={`${a.id}-${i}`} className={cn('animate-view-enter', `stagger-${Math.min(i + 1, 6)}`)}>
                      <ApplicantRow
                        applicant={a}
                        onDownload={handleDownloadResume}
                        onView={handleViewResume}
                        downloadingId={downloadingId}
                        viewingId={viewingId}
                        onStatusChange={handleStatusChange}
                        onOpenChat={(convId) => openChat(convId ?? null)}
                        statusLoadingId={statusUpdatingId}
                      />
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
              <h1 className="text-2xl font-black" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em' }}>Analytics</h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Aggregated insights from your postings</p>
            </div>

            {/* Overview stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-view-enter">
              {[
                { label: 'Total Jobs',  value: jobs.length, icon: <Briefcase size={15} style={{ color: 'var(--color-brand)' }} />, bg: 'var(--color-brand-light)' },
                { label: 'Active Jobs', value: activeJobs,  icon: <CheckCircle size={15} className="text-emerald-600" />,          bg: '#F0FDF4' },
                { label: 'Total Apps',  value: totalApps,   icon: <Users size={15} className="text-violet-600" />,                  bg: '#F5F3FF' },
                { label: 'Avg Days Up', value: avgDays,     icon: <Clock size={15} className="text-amber-600" />,                   bg: '#FFFBEB' },
              ].map(({ label, value, icon, bg }, i) => (
                <div key={label} className={cn('stat-card animate-view-enter', `stagger-${i + 1}`)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="type-label">{label}</span>
                    <div className="p-2 rounded-lg" style={{ background: bg }}>{icon}</div>
                  </div>
                  <p className="text-2xl font-black" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)', letterSpacing: '-0.04em' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Top required skills bars */}
            <div className="cn-card p-5 animate-view-enter stagger-2">
              <h2 className="text-sm font-bold flex items-center gap-2 mb-5" style={{ color: 'var(--color-text-primary)' }}>
                <Zap size={14} style={{ color: 'var(--color-brand)' }} />Top Required Skills
                <span className="type-label ml-1">across all postings</span>
              </h2>
              {analytics.topSkills.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-tertiary)' }}>Post jobs to see skill trends</p>
              ) : (
                <div className="space-y-3">
                  {analytics.topSkills.map(({ skill, count }, i) => {
                    const pct = Math.round((count / jobs.length) * 100);
                    return (
                      <div key={skill} className={cn('animate-view-enter', `stagger-${Math.min(i + 1, 6)}`)}>
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black w-4" style={{ color: 'var(--color-text-tertiary)' }}>#{i + 1}</span>
                            <span className="text-sm font-semibold capitalize" style={{ color: 'var(--color-text-primary)' }}>{skill}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{count}/{jobs.length} jobs</span>
                            <span className="text-sm font-black" style={{ color: 'var(--color-brand)', fontFamily: 'var(--font-heading)' }}>{pct}%</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                          <div className="h-full rounded-full skill-bar-fill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #4F46E5, #7C3AED)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Job performance table */}
            {jobs.length > 0 && (
              <div className="cn-card p-5 animate-view-enter stagger-3">
                <h2 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--color-text-primary)' }}>
                  <TrendingUp size={14} style={{ color: 'var(--color-brand)' }} />Job Performance
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                        {['Job Title', 'Posted', 'Applicants', 'Skills', 'Status'].map(h => (
                          <th key={h} className="type-label pb-3 text-left pr-4 last:pr-0">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map(job => (
                        <tr key={job.id} className="border-b last:border-0 transition-colors"
                          style={{ borderColor: 'var(--color-border-subtle)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td className="py-3 pr-4 font-semibold max-w-[160px] truncate" style={{ color: 'var(--color-text-primary)' }}>{job.title}</td>
                          <td className="py-3 pr-4 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                            {new Date(job.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="py-3 pr-4 font-bold" style={{ color: 'var(--color-brand)' }}>{job._count?.applications ?? 0}</td>
                          <td className="py-3 pr-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{job.requiredSkills.length} skills</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                              style={job.isActive
                                ? { background: 'var(--color-success-light)', color: 'var(--color-success)', borderColor: 'var(--color-success-border)' }
                                : { background: 'var(--color-border-subtle)', color: 'var(--color-text-tertiary)', borderColor: 'var(--color-border)' }
                              }>
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
              <div className="cn-card p-5 animate-view-enter stagger-4">
                <h2 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--color-text-primary)' }}>
                  <Award size={14} style={{ color: 'var(--color-brand)' }} />Applicant Status Breakdown
                </h2>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(analytics.statusBreakdown).map(([status, count]) => (
                    <div key={status} className="px-4 py-3 rounded-xl border text-center min-w-[100px]"
                      style={status === 'PENDING'
                        ? { background: 'var(--color-warning-light)', borderColor: 'var(--color-warning-border)' }
                        : status === 'SHORTLISTED'
                        ? { background: 'var(--color-success-light)', borderColor: 'var(--color-success-border)' }
                        : { background: 'var(--color-border-subtle)', borderColor: 'var(--color-border)' }
                      }>
                      <p className="text-2xl font-black"
                        style={{
                          fontFamily: 'var(--font-heading)',
                          color: status === 'PENDING' ? 'var(--color-warning)' : status === 'SHORTLISTED' ? 'var(--color-success)' : 'var(--color-text-secondary)',
                          letterSpacing: '-0.04em',
                        }}>
                        {count}
                      </p>
                      <p className="type-label mt-1">{status}</p>
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
              <h1 className="text-2xl font-black" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em' }}>Post a New Job</h1>
              <p className="text-sm mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <Sparkles size={12} style={{ color: 'var(--color-brand)' }} />
                AI will automatically extract required skills from your description
              </p>
            </div>

            <div className="cn-card p-7 animate-view-enter stagger-1">
              <form onSubmit={e => { void handlePost(e); }} className="space-y-5 max-w-2xl">

                {/* Job Title */}
                <div>
                  <label className="type-label block mb-2">Job Title *</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
                    placeholder="e.g. Full Stack Developer Intern"
                    className="cn-input" />
                </div>

                {/* Job Description */}
                <div>
                  <label className="type-label block mb-2">Job Description *</label>
                  <div className="relative">
                    <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={8}
                      placeholder={`Describe the role and requirements.\n\nExample:\nWe are looking for a React/Node.js developer...\n\nRequired Skills: React, TypeScript, MongoDB, REST APIs\nMin CGPA: 7.5\nExperience: 1+ year`}
                      className="cn-input resize-y" style={{ fontFamily: 'var(--font-body)' }} />
                    {description.length > 0 && (
                      <span className="absolute bottom-3 right-3 type-caption">{description.length} chars</span>
                    )}
                  </div>
                  <p className="type-caption mt-1.5 flex items-center gap-1">
                    <Sparkles size={9} style={{ color: 'var(--color-brand)' }} />
                    The more detail you provide, the more accurately AI can extract required skills
                  </p>
                </div>

                {/* CGPA + Experience */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="type-label block mb-2">Min CGPA <span className="normal-case font-normal" style={{ color: 'var(--color-text-tertiary)' }}>(optional)</span></label>
                    <input type="number" value={minCgpa} onChange={e => setMinCgpa(e.target.value)} step="0.1" min="0" max="10"
                      placeholder="e.g. 7.0 — or leave blank for AI"
                      className="cn-input" />
                  </div>
                  <div>
                    <label className="type-label block mb-2">Min Experience <span className="normal-case font-normal" style={{ color: 'var(--color-text-tertiary)' }}>(years, optional)</span></label>
                    <input type="number" value={minExp} onChange={e => setMinExp(e.target.value)} step="0.5" min="0"
                      placeholder="e.g. 1 — or leave blank"
                      className="cn-input" />
                  </div>
                </div>

                {/* AI info box */}
                <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'var(--color-brand-light)', border: '1px solid var(--color-brand-border)' }}>
                  <Sparkles size={13} style={{ color: 'var(--color-brand)', marginTop: '2px', flexShrink: 0 }} />
                  <p className="text-xs leading-relaxed" style={{ color: '#3730A3' }}>
                    <strong>AI Skill Extraction:</strong> Our Gemini-powered engine reads your description and pulls out exact technical skills, frameworks, and tools. Students will be ranked by how well their parsed resume matches these skills.
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 pt-1">
                  <button type="submit" disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 text-white font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'var(--color-brand)', fontFamily: 'var(--font-heading)' }}
                    onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = 'var(--color-brand-hover)'; }}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-brand)')}>
                    {submitting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {submitting ? 'Posting & Parsing…' : 'Post Job with AI'}
                  </button>
                  <button type="button" onClick={() => setActiveView('dashboard')}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', background: '#FFFFFF' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}>
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
// ApplicantRow — single candidate card used in both postings + all-applicants views
// =============================================================================
function ApplicantRow({
  applicant,
  onDownload,
  onView,
  downloadingId,
  viewingId,
  onStatusChange,
  onOpenChat,
  statusLoadingId,
}: {
  applicant:       RealApplicant;
  onDownload:      (url: string, name: string, id: string) => Promise<void>;
  onView:          (url: string, id: string) => Promise<void>;
  downloadingId:   string | null;
  viewingId:       string | null;
  onStatusChange?: (applicantId: string, status: 'SHORTLISTED' | 'REJECTED') => Promise<void>;
  onOpenChat?:     (conversationId?: string) => void;
  statusLoadingId?:string | null;
}) {
  const name             = `${applicant.student.firstName} ${applicant.student.lastName}`.trim() || applicant.student.user.email;
  const score            = applicant.matchScore ?? 0;
  const isUpdatingStatus = statusLoadingId === applicant.id;

  return (
    <div
      className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200"
      style={{ background: '#FFFFFF', border: '1px solid var(--color-border)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-brand-border)'; e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Left: score + identity */}
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0"><CircularProgress score={score} size={48} stroke={4} /></div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}>{name}</p>
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
              style={applicant.status === 'PENDING'
                ? { background: 'var(--color-warning-light)', color: 'var(--color-warning)', border: '1px solid var(--color-warning-border)' }
                : applicant.status === 'SHORTLISTED'
                ? { background: 'var(--color-success-light)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)' }
                : { background: 'var(--color-danger-light)', color: 'var(--color-danger)', border: '1px solid var(--color-danger-border)' }
              }>
              {applicant.status}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {applicant.student.college} · <span className="font-semibold">{applicant.student.cgpa}</span> CGPA
          </p>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">

        {/* Shortlist / Reject / Chat actions */}
        {onStatusChange && (
          <div className="flex items-center gap-1.5 mr-1 border-r pr-2" style={{ borderColor: 'var(--color-border)' }}>
            {applicant.status !== 'SHORTLISTED' && (
              <button
                disabled={isUpdatingStatus}
                onClick={() => void onStatusChange(applicant.id, 'SHORTLISTED')}
                className="px-2.5 py-1.5 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 disabled:opacity-50"
                style={{ background: 'var(--color-success)', boxShadow: '0 2px 6px rgba(22,163,74,0.25)' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#15803D')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-success)')}
                title="Shortlist applicant & unlock live chat"
              >
                {isUpdatingStatus ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={11} />}
                Shortlist
              </button>
            )}

            {applicant.status === 'SHORTLISTED' && onOpenChat && (
              <button
                onClick={() => onOpenChat(applicant.conversationId ?? undefined)}
                className="px-3 py-1.5 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}
                title="Direct 1-on-1 Live Chat"
              >
                <MessageSquare size={12} />
                Live Chat
              </button>
            )}

            {applicant.status !== 'REJECTED' && (
              <button
                disabled={isUpdatingStatus}
                onClick={() => void onStatusChange(applicant.id, 'REJECTED')}
                className="p-1.5 rounded-lg border transition-colors disabled:opacity-50"
                style={{ background: '#FFFFFF', color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.borderColor = 'var(--color-danger-border)'; e.currentTarget.style.background = 'var(--color-danger-light)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = '#FFFFFF'; }}
                title="Reject candidate"
              >
                <X size={11} />
              </button>
            )}
          </div>
        )}

        {/* Resume view + download */}
        {applicant.student.resumeUrl ? (
          <>
            <button disabled={viewingId === applicant.id}
              onClick={() => void onView(applicant.student.resumeUrl!, applicant.id)}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: 'var(--color-brand-light)', color: 'var(--color-brand)', border: '1px solid var(--color-brand-border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#E0E7FF')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-brand-light)')}>
              {viewingId === applicant.id ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />}
              {viewingId !== applicant.id ? 'View' : '…'}
              {viewingId !== applicant.id && <ExternalLink size={8} />}
            </button>
            <button disabled={downloadingId === applicant.id}
              onClick={() => void onDownload(applicant.student.resumeUrl!, name, applicant.id)}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: 'var(--color-success-light)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#DCFCE7')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-success-light)')}>
              {downloadingId === applicant.id ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
              {downloadingId === applicant.id ? '…' : 'PDF'}
            </button>
          </>
        ) : (
          <span className="px-2.5 py-1.5 text-xs rounded-lg" style={{ background: 'var(--color-border-subtle)', color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border)' }}>
            No Resume
          </span>
        )}

        {/* Email link */}
        <a href={`mailto:${applicant.student.user.email}`}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--color-text-tertiary)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-brand)'; e.currentTarget.style.background = 'var(--color-brand-light)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
          title={applicant.student.user.email}>
          <Mail size={14} />
        </a>
      </div>
    </div>
  );
}

// =============================================================================
// RecruiterJDModal — full JD preview sheet
// =============================================================================
function RecruiterJDModal({ job, onClose }: { job: Job; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
    >
      <div className="relative w-full sm:max-w-2xl max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col animate-slide-up overflow-hidden"
        style={{ background: '#FFFFFF', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-lg font-black" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.025em' }}>{job.title}</h2>
            <p className="type-caption mt-0.5">Posted {new Date(job.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-subtle)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Meta chips */}
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: 'var(--color-border-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              Min CGPA: <span style={{ color: 'var(--color-brand)', fontWeight: 700 }}>{job.minCgpa}</span>
            </span>
            <span className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: 'var(--color-border-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              Min Experience: <span style={{ color: 'var(--color-brand)', fontWeight: 700 }}>{job.minExperience} yrs</span>
            </span>
            <span className="px-3 py-1.5 rounded-lg text-xs font-bold border"
              style={job.isActive
                ? { background: 'var(--color-success-light)', color: 'var(--color-success)', borderColor: 'var(--color-success-border)' }
                : { background: 'var(--color-border-subtle)', color: 'var(--color-text-tertiary)', borderColor: 'var(--color-border)' }
              }>
              {job.isActive ? '● Active' : '● Closed'}
            </span>
          </div>

          {/* AI-extracted skills */}
          <div>
            <p className="type-label mb-2">AI-Extracted Required Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {job.requiredSkills.map(s => (
                <span key={s} className="px-2.5 py-1 text-xs font-semibold rounded-md"
                  style={{ background: 'var(--color-brand-light)', color: 'var(--color-brand)', border: '1px solid var(--color-brand-border)' }}>
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Full description */}
          <div>
            <p className="type-label flex items-center gap-1.5 mb-3">
              <FileText size={10} style={{ color: 'var(--color-brand)' }} />Full Job Description
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>{job.description}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t p-4" style={{ borderColor: 'var(--color-border)', background: '#FFFFFF' }}>
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
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

// Keeping unused internal component for future feature extensibility
function _CollapsibleTrigger({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
      <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</span>
      {open ? <ChevronUp size={15} style={{ color: 'var(--color-text-tertiary)' }} /> : <ChevronDown size={15} style={{ color: 'var(--color-text-tertiary)' }} />}
    </button>
  );
}

void _CollapsibleTrigger;
