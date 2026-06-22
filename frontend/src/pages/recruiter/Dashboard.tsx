import { useEffect, useState, useCallback, type FormEvent } from 'react';
import {
  PlusCircle, Briefcase, Users, Loader2,
  Sparkles, ChevronDown, ChevronUp, RefreshCw,
  Search, Mail, Trash2,
  FileText, ExternalLink
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

// BUG FIX (Bug 3 + Bug 5): Real applicant type from the API — replaces
// the old hardcoded mock `Applicant` interface with actual DB-backed data.
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

// =============================================================================
// Recruiter Dashboard
// =============================================================================
export default function RecruiterDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  // BUG FIX (Bug 3 + Bug 5): Replace mock applicants state with real API state
  const [viewingApplicantsFor, setViewingApplicantsFor] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<RealApplicant[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minCgpa, setMinCgpa] = useState('');
  const [minExp, setMinExp] = useState('');

  // ── Fetch jobs ─────────────────────────────────────────────────────────────
  // BUG FIX (Bug 1): Changed from '/jobs' to '/jobs/my-postings'.
  // The original '/jobs' (getAllJobs) returns ALL active jobs from every recruiter.
  // '/jobs/my-postings' strictly filters by `recruiterId: req.user.userId`.
  const fetchJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const { data } = await api.get<{ data: Job[] }>('/jobs/my-postings'); // BUG FIX ← was '/jobs'
      setJobs(data.data ?? []);
    } catch {
      toast.error('Failed to load your job listings.');
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => { void fetchJobs(); }, [fetchJobs]);

  // ── Post new job ───────────────────────────────────────────────────────────
  const handlePost = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error('Title and description are required.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/jobs', {
        title: title.trim(),
        description: description.trim(),
        // BUG FIX (Bug 2): parseFloat() ensures HTML input strings like '7.5'
        // are correctly typed as Floats. `|| undefined` sends nothing (not 0)
        // when the field is left blank, so the backend falls back to LLM parsing.
        minCgpa:      minCgpa.trim()  ? parseFloat(minCgpa)  : undefined,
        minExperience: minExp.trim()  ? parseFloat(minExp)   : undefined,
      });

      toast.success('Job posted! AI has parsed the skills. 🤖');
      setTitle(''); setDescription(''); setMinCgpa(''); setMinExp('');
      setFormOpen(false);
      await fetchJobs();
    } catch {
      toast.error('Failed to post job. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete job ─────────────────────────────────────────────────────────────
  // BUG FIX (Bug 6): Already implemented — now properly scoped to recruiter's
  // own jobs because fetchJobs now calls /my-postings (Bug 1 fix).
  const handleDeleteJob = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this job posting? This cannot be undone.')) return;

    try {
      await api.delete(`/jobs/${id}`);
      toast.success('Job successfully deleted.');
      // Optimistic local state update — no full refetch needed
      setJobs((prev) => prev.filter((j) => j.id !== id));
      if (viewingApplicantsFor === id) {
        setViewingApplicantsFor(null);
        setApplicants([]);
      }
    } catch {
      toast.error('Failed to delete job.');
    }
  };

  // ── Fetch real applicants ──────────────────────────────────────────────────
  // BUG FIX (Bug 3 + Bug 5): Replace the hardcoded mockApplicants array with
  // a real API call to GET /api/jobs/:jobId/applicants.
  // The backend verifies job ownership before returning any data.
  const handleViewApplicants = async (jobId: string) => {
    // Toggle: clicking the same job closes the panel
    if (viewingApplicantsFor === jobId) {
      setViewingApplicantsFor(null);
      setApplicants([]);
      return;
    }

    setViewingApplicantsFor(jobId);
    setApplicants([]);
    setLoadingApplicants(true);

    try {
      const { data } = await api.get<{ data: RealApplicant[]; totalApplicants: number }>(
        `/jobs/${jobId}/applicants`, // BUG FIX: real endpoint — was hardcoded mock array
      );
      setApplicants(data.data ?? []);
    } catch {
      toast.error('Failed to load applicants.');
      setViewingApplicantsFor(null);
    } finally {
      setLoadingApplicants(false);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  // BUG FIX (Bug 5): totalApps is computed from the REAL _count.applications
  // returned by getMyJobs. This now reflects only this recruiter's jobs.
  const totalApps = jobs.reduce((s, j) => s + (j._count?.applications ?? 0), 0);
  const activeJobs = jobs.filter((j) => j.isActive).length;

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="text-left border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-black text-gray-900">
          Recruiter Dashboard
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Manage your job postings and review AI-scored applicants
        </p>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          label="Your Open Positions"
          value={activeJobs}
          icon={<Briefcase size={20} className="text-indigo-600" />}
          sub="Your active listings only"  // BUG FIX note: now scoped to this recruiter
        />
        <StatCard
          label="Total Applications Received"
          value={totalApps}
          icon={<Users size={20} className="text-emerald-600" />}
          sub="Across all your postings"
        />
      </div>

      {/* ── Post job form ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-5
                     hover:bg-gray-50 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <PlusCircle size={20} className="text-indigo-600" />
            </div>
            <div className="text-left">
              <p className="font-bold text-gray-900 text-base">Post a New Job</p>
              <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5 font-medium">
                <Sparkles size={12} className="text-emerald-600" />
                AI will automatically extract required skills from your description
              </p>
            </div>
          </div>
          {formOpen
            ? <ChevronUp size={20} className="text-gray-400" />
            : <ChevronDown size={20} className="text-gray-400" />
          }
        </button>

        {formOpen && (
          <div className="px-6 pb-6 border-t border-gray-100 animate-slide-up bg-gray-50">
            <form onSubmit={(e) => { void handlePost(e); }} className="space-y-5 pt-6">
              <FormField
                label="Job Title"
                value={title}
                onChange={setTitle}
                placeholder="e.g. Full Stack Developer Intern"
              />

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  Job Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={`Describe the role, responsibilities, and requirements.\n\nExample:\nWe are looking for a React/Node.js developer with 1+ year of experience...\nRequired: React, TypeScript, MongoDB, REST APIs\nMin CGPA: 7.5`}
                  rows={6}
                  required
                  className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3
                             text-sm text-gray-900 placeholder-gray-400 resize-y
                             focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40
                             transition-colors shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* BUG FIX (Bug 2): step="0.1" ensures numeric input is float-compatible */}
                <FormField
                  label="Min CGPA (optional — leave blank for AI to decide)"
                  value={minCgpa}
                  onChange={setMinCgpa}
                  placeholder="e.g. 7.0"
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                />
                <FormField
                  label="Min Experience (years, optional)"
                  value={minExp}
                  onChange={setMinExp}
                  placeholder="e.g. 1"
                  type="number"
                  step="0.5"
                  min="0"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2
                             bg-indigo-600 text-white
                             font-bold py-3 rounded-xl hover:bg-indigo-700 hover:shadow-md
                             active:scale-[0.99] transition-all duration-200
                             disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {submitting
                    ? <Loader2 size={18} className="animate-spin" />
                    : <Sparkles size={18} />
                  }
                  {submitting ? 'Posting & Parsing…' : 'Post Job with AI'}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 bg-white
                             hover:bg-gray-50 transition-colors text-sm font-semibold shadow-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ── Job listings ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Briefcase size={18} className="text-indigo-600" />
            {/* BUG FIX (Bug 1): Label now says "Your Postings" — data is scoped to this recruiter */}
            Your Postings ({jobs.length})
          </h2>
          <button
            onClick={() => void fetchJobs()}
            disabled={loadingJobs}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={16} className={loadingJobs ? 'animate-spin' : ''} />
          </button>
        </div>

        {loadingJobs ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-50 border border-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Briefcase size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="font-semibold text-gray-900 text-lg">No jobs posted yet</p>
            <p className="text-sm mt-1">Click "Post a New Job" above to get started</p>
          </div>
        ) : (
          <div className="space-y-6">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all duration-300"
              >
                {/* Job Header */}
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-lg truncate">{job.title}</h3>
                      <p className="text-sm text-gray-500 mt-1 font-medium">
                        Posted {new Date(job.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={cn(
                      'flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold border',
                      job.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200',
                    )}>
                      {job.isActive ? 'Active' : 'Closed'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {job.requiredSkills.slice(0, 5).map((s) => (
                      <span key={s} className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold rounded-md">
                        {s}
                      </span>
                    ))}
                    {job.requiredSkills.length > 5 && (
                      <span className="text-gray-500 text-xs font-medium self-center px-1">
                        +{job.requiredSkills.length - 5} more
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-6 mt-4 text-sm text-gray-600 border-t border-gray-100 pt-4">
                    <span>CGPA ≥ <span className="font-bold text-gray-900">{job.minCgpa}</span></span>
                    <span>Exp ≥ <span className="font-bold text-gray-900">{job.minExperience} yrs</span></span>

                    {/* BUG FIX (Bug 5): Total Applicants from REAL _count.applications */}
                    <span className="font-semibold text-emerald-600">
                      Total Applicants: {job._count?.applications ?? 0}
                    </span>

                    <div className="ml-auto flex items-center gap-4">
                      {/* BUG FIX (Bug 6): Delete button — already worked, now scoped correctly */}
                      <button
                        onClick={() => void handleDeleteJob(job.id)}
                        className="flex items-center gap-1.5 text-red-500 font-semibold hover:text-red-700 transition-colors"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>

                      {/* BUG FIX (Bug 3 + Bug 5): "View Applicants" now calls real API */}
                      <button
                        onClick={() => void handleViewApplicants(job.id)}
                        className="flex items-center gap-1.5 text-indigo-600 font-semibold hover:text-indigo-800 transition-colors"
                      >
                        <Users size={16} />
                        {viewingApplicantsFor === job.id ? 'Hide Applicants' : 'View Applicants'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Real Applicants Panel ─────────────────────────────────── */}
                {/* BUG FIX (Bug 3 + Bug 5): Replaced hardcoded mockApplicants        */}
                {/* with real data fetched from GET /api/jobs/:jobId/applicants.        */}
                {viewingApplicantsFor === job.id && (
                  <div className="bg-gray-50 border-t border-gray-200 p-6 animate-slide-up">
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Search size={16} className="text-indigo-600" />
                      AI Ranked Applicants
                      {!loadingApplicants && (
                        <span className="ml-auto text-indigo-600 font-semibold normal-case text-sm">
                          {applicants.length} {applicants.length === 1 ? 'applicant' : 'applicants'}
                        </span>
                      )}
                    </h4>

                    {loadingApplicants ? (
                      <div className="flex items-center justify-center py-8 gap-3 text-gray-500">
                        <Loader2 size={20} className="animate-spin text-indigo-500" />
                        <span className="text-sm font-medium">Loading applicants…</span>
                      </div>
                    ) : applicants.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Users size={36} className="mx-auto mb-3 text-gray-300" />
                        <p className="font-medium text-gray-500">No applications yet</p>
                        <p className="text-sm mt-1">Students will appear here once they apply</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {applicants.map((applicant) => {
                          const name = `${applicant.student.firstName} ${applicant.student.lastName}`.trim()
                            || applicant.student.user.email;
                          const score = applicant.matchScore ?? 0;

                          return (
                            <div
                              key={applicant.id}
                              className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between shadow-sm hover:border-indigo-200 transition-colors"
                            >
                              <div className="flex items-center gap-5">
                                <div className="flex-shrink-0">
                                  <CircularProgress score={score} size={56} stroke={5} />
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900">{name}</p>
                                  <p className="text-sm text-gray-500">
                                    {applicant.student.college} · {applicant.student.cgpa} CGPA
                                  </p>
                                  {/* Status badge */}
                                  <span className={cn(
                                    'inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-semibold',
                                    applicant.status === 'PENDING'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : applicant.status === 'SHORTLISTED'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-red-50 text-red-700 border border-red-200',
                                  )}>
                                    {applicant.status}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 flex-shrink-0">
                                {/* Resume link — only shown if student has uploaded */}
                                {applicant.student.resumeUrl ? (
                                  <a
                                    href={applicant.student.resumeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                                  >
                                    <FileText size={14} />
                                    Resume
                                    <ExternalLink size={12} />
                                  </a>
                                ) : (
                                  <span className="px-4 py-2 bg-gray-50 text-gray-400 text-sm rounded-lg border border-gray-200">
                                    No Resume
                                  </span>
                                )}
                                {/* Contact via email */}
                                <a
                                  href={`mailto:${applicant.student.user.email}`}
                                  className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title={`Email ${applicant.student.user.email}`}
                                >
                                  <Mail size={18} />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon, sub,
}: {
  label: string; value: number; icon: React.ReactNode; sub: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-600 text-sm font-semibold">{label}</span>
        <div className="p-2.5 bg-gray-50 rounded-xl">{icon}</div>
      </div>
      <p className="text-4xl font-black text-gray-900">{value}</p>
      <p className="text-gray-500 text-xs mt-2 font-medium">{sub}</p>
    </div>
  );
}

function FormField({
  label, value, onChange, placeholder, type = 'text', step, min, max,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; step?: string; min?: string; max?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3
                   text-sm text-gray-900 placeholder-gray-400
                   focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40
                   transition-colors shadow-sm"
      />
    </div>
  );
}
