import { useEffect, useState, useCallback } from 'react';
import { Users, Briefcase, FileText, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';
import { cn } from '../../lib/cn';

// =============================================================================
// Types
// =============================================================================
interface Job {
  id:             string;
  title:          string;
  requiredSkills: string[];
  isActive:       boolean;
  createdAt:      string;
  recruiter?: {
    recruiterProfile?: { companyName: string; designation: string } | null;
  };
}

// =============================================================================
// Admin Dashboard
// =============================================================================
export default function AdminDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  // Mocked stats as requested
  const stats = [
    {
      label: 'Total Registered Students',
      value: '1,245',
      icon: <Users size={20} className="text-indigo-400" />,
      sub: '+12% from last month',
    },
    {
      label: 'Active Job Postings',
      value: jobs.filter((j) => j.isActive).length.toString(),
      icon: <Briefcase size={20} className="text-emerald-400" />,
      sub: 'Across all recruiters',
    },
    {
      label: 'Total Applications Processed',
      value: '8,432',
      icon: <FileText size={20} className="text-rose-400" />,
      sub: '+24% from last month',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in w-full">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="text-left mb-8 border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-black text-slate-100">
          Admin Dashboard
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Placement Cell System Overview and Activity Monitoring
        </p>
      </div>

      {/* ── Stats grid — 3 cols ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map(({ label, value, icon, sub }) => (
          <div
            key={label}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-sm font-medium">{label}</span>
              <div className="p-2 bg-slate-800/50 rounded-lg">{icon}</div>
            </div>
            <p className="text-3xl font-black text-slate-100">{value}</p>
            <p className="text-slate-500 text-xs mt-2">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── System Activity Table ────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden mt-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Briefcase size={18} className="text-indigo-400" />
            System Activity — Recent Jobs
          </h2>
          <button
            onClick={() => void fetchJobs()}
            disabled={loading}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="overflow-x-auto p-6">
          <table className="w-full text-sm text-left border-collapse border border-slate-800">
            <thead className="bg-slate-800 text-slate-300 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold border-b border-slate-700">Job Title</th>
                <th className="px-6 py-4 font-semibold border-b border-slate-700">Company / Recruiter</th>
                <th className="px-6 py-4 font-semibold border-b border-slate-700">Required Skills</th>
                <th className="px-6 py-4 font-semibold border-b border-slate-700">Status</th>
                <th className="px-6 py-4 font-semibold border-b border-slate-700">Date Posted</th>
              </tr>
            </thead>
            <tbody className="bg-slate-900 divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 border border-slate-800">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading system activity...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 border border-slate-800">
                    <Briefcase size={32} className="mx-auto mb-3 text-slate-700" />
                    <p className="font-medium text-slate-400">No active jobs in the system.</p>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap border-b border-slate-800">
                      <p className="font-semibold text-slate-200">{job.title}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-400 border-b border-slate-800">
                      {job.recruiter?.recruiterProfile ? (
                        <>
                          <span className="font-medium text-slate-200">
                            {job.recruiter.recruiterProfile.companyName}
                          </span>
                          <span className="text-slate-500 ml-1 block text-xs">
                            {job.recruiter.recruiterProfile.designation}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-600 italic">Unknown</span>
                      )}
                    </td>
                    <td className="px-6 py-4 border-b border-slate-800">
                      <div className="flex flex-wrap gap-1.5">
                        {job.requiredSkills.slice(0, 3).map((s) => (
                          <span key={s} className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[11px] rounded-md font-medium border border-slate-700">
                            {s}
                          </span>
                        ))}
                        {job.requiredSkills.length > 3 && (
                          <span className="px-2 py-0.5 text-slate-500 text-[11px] font-medium">
                            +{job.requiredSkills.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap border-b border-slate-800">
                      <span className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-semibold',
                        job.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700',
                      )}>
                        {job.isActive ? 'Active' : 'Closed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-xs border-b border-slate-800">
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
