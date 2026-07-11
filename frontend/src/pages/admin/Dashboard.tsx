import { useEffect, useState, useCallback } from 'react';
import { Users, Briefcase, FileText, Loader2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';
import { cn } from '../../lib/cn';

// =============================================================================
// Types (UNCHANGED)
// =============================================================================
interface Job {
  id:             string;
  title:          string;
  requiredSkills: string[];
  isActive:       boolean;
  createdAt:      string;
  _count?:        { applications: number };
  recruiter?: {
    recruiterProfile?: { companyName: string; designation: string } | null;
  };
}

// =============================================================================
// Admin Dashboard
// REDESIGN: Stripe-style metric cards, clean data table, enterprise light theme.
// Stats are now fetched in real-time from /api/jobs/admin-stats.
// =============================================================================

interface AdminStats {
  totalStudents:      number;
  totalApplications:  number;
  activeJobCount:     number;
}

export default function AdminDashboard() {
  const [jobs,       setJobs]       = useState<Job[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ data: Job[] }>('/jobs');
      setJobs(data.data ?? []);
    } catch {
      toast.error('Failed to load system activity.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get<{ data: AdminStats }>('/jobs/admin-stats');
      setAdminStats(data.data);
    } catch {
      toast.error('Failed to load platform statistics.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const handleRefreshAll = useCallback(async () => {
    await Promise.all([fetchJobs(), fetchStats()]);
  }, [fetchJobs, fetchStats]);

  useEffect(() => {
    void fetchJobs();
    void fetchStats();
  }, [fetchJobs, fetchStats]);

  const stats = [
    {
      label:   'Total Registered Students',
      value:   statsLoading ? '…' : (adminStats?.totalStudents ?? 0).toLocaleString(),
      trend:   'All time',
      trendUp: true,
      icon:    <Users size={20} className="text-indigo-600" />,
      iconBg:  'bg-indigo-50',
      sub:     'Registered on platform',
    },
    {
      label:   'Active Job Postings',
      value:   statsLoading ? '…' : (adminStats?.activeJobCount ?? 0).toLocaleString(),
      trend:   'Live now',
      trendUp: true,
      icon:    <Briefcase size={20} className="text-emerald-600" />,
      iconBg:  'bg-emerald-50',
      sub:     'Across all recruiters',
    },
    {
      label:   'Total Applications Processed',
      value:   statsLoading ? '…' : (adminStats?.totalApplications ?? 0).toLocaleString(),
      trend:   'All time',
      trendUp: true,
      icon:    <FileText size={20} className="text-violet-600" />,
      iconBg:  'bg-violet-50',
      sub:     'Submitted by students',
    },
  ];


  return (
    <div className="space-y-6 animate-fade-in w-full">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="section-header">
        <h1 className="text-2xl font-black text-slate-900">
          Admin Dashboard
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Placement Cell · System Overview and Activity Monitoring
        </p>
      </div>

      {/* ── Stripe-style Stats grid — 3 cols ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statsLoading ? (
          // Skeleton cards while stats load
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="stat-card animate-pulse">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-slate-200 rounded-xl" />
                <div className="w-16 h-5 bg-slate-200 rounded-full" />
              </div>
              <div className="w-20 h-9 bg-slate-200 rounded-lg mb-2" />
              <div className="w-32 h-3 bg-slate-100 rounded" />
            </div>
          ))
        ) : (
          stats.map(({ label, value, trend, trendUp, icon, iconBg, sub }) => (
            <div key={label} className="stat-card">
              <div className="flex items-start justify-between mb-4">
                <div className={cn('p-2.5 rounded-xl', iconBg)}>
                  {icon}
                </div>
                <span className={cn(
                  'flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full',
                  trendUp
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200',
                )}>
                  {trendUp
                    ? <TrendingUp size={11} />
                    : <TrendingDown size={11} />
                  }
                  {trend}
                </span>
              </div>
              <p className="text-4xl font-black text-slate-900 tabular-nums">{value}</p>
              <div className="mt-2 flex flex-col">
                <p className="text-slate-500 text-xs font-medium">{label}</p>
                <p className="text-slate-400 text-xs mt-0.5">{sub}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── System Activity Table ────────────────────────────────────────── */}
      <div className="enterprise-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Briefcase size={15} className="text-indigo-500" />
            System Activity — Recent Job Postings
          </h2>
          <button
            onClick={() => void handleRefreshAll()}
            disabled={loading || statsLoading}
            className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            aria-label="Refresh all"
          >
            <RefreshCw size={14} className={(loading || statsLoading) ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Job Title</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Company / Recruiter</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Required Skills</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Applicants</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Date Posted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                    <p className="text-slate-400 text-sm font-medium">Loading system activity...</p>
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Briefcase size={22} className="text-slate-400" />
                    </div>
                    <p className="font-medium text-slate-700 text-sm">No active jobs in the system.</p>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/70 transition-colors bg-white">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="font-semibold text-slate-900 text-sm">{job.title}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {job.recruiter?.recruiterProfile ? (
                        <>
                          <span className="font-semibold text-slate-800 text-sm">
                            {job.recruiter.recruiterProfile.companyName}
                          </span>
                          <span className="text-slate-400 block text-xs mt-0.5">
                            {job.recruiter.recruiterProfile.designation}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400 italic text-sm">Unknown</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {job.requiredSkills.slice(0, 3).map((s) => (
                          <span key={s} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] rounded-md font-semibold border border-indigo-100">
                            {s}
                          </span>
                        ))}
                        {job.requiredSkills.length > 3 && (
                          <span className="text-slate-400 text-[11px] font-medium self-center">
                            +{job.requiredSkills.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold text-slate-900 text-sm">{job._count?.applications ?? 0}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-bold border',
                        job.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200',
                      )}>
                        {job.isActive ? '● Active' : '● Closed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-400 text-xs font-medium">
                      {new Date(job.createdAt).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
