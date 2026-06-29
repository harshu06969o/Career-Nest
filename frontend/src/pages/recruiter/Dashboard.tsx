import { useEffect, useState, useCallback, type FormEvent } from 'react';
import {
  PlusCircle, Briefcase, Users, Loader2,
  Sparkles, ChevronDown, ChevronUp, RefreshCw,
  Search, Mail, Trash2,
  FileText, ExternalLink, Download
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

/**
 * Recruiter Dashboard Component.
 * Primary interface for recruiters to post new jobs, manage existing active listings,
 * and review algorithmic candidate matches.
 * 
 * @architecture
 * Client-Side Filtering: The dashboard fetches only the active jobs belonging to the 
 * authenticated recruiter. "View Applicants" triggers a lazy, on-demand fetch to 
 * avoid loading heavy applicant datasets for jobs the user isn't currently inspecting.
 */
export default function RecruiterDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  // BUG FIX (Bug 3 + Bug 5): Replace mock applicants state with real API state
  const [viewingApplicantsFor, setViewingApplicantsFor] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<RealApplicant[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  // Tracks which applicant's resume is currently being downloaded (shows spinner)
  const [downloadingId, setDownloadingId] = useState<string | null>(null);


  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minCgpa, setMinCgpa] = useState('');
  const [minExp, setMinExp] = useState('');


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
        // Send empty strings as undefined so the backend defaults to LLM extraction
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


  const handleDeleteJob = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this job posting? This cannot be undone.')) return;

    try {
      await api.delete(`/jobs/${id}`);
      toast.success('Job successfully deleted.');
      // Optimistically update the UI to avoid a full refetch
      setJobs((prev) => prev.filter((j) => j.id !== id));
      if (viewingApplicantsFor === id) {
        setViewingApplicantsFor(null);
        setApplicants([]);
      }
    } catch {
      toast.error('Failed to delete job.');
    }
  };


  const handleViewApplicants = async (jobId: string) => {
    // Toggle visibility if clicking the same job
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


  // ===========================================================================
  // handleDownloadResume — Blob-based PDF Download
  // ===========================================================================
  // WHY NOT fl_attachment URL injection:
  //   Cloudinary only supports transformation flags (fl_attachment, fl_attachment:filename)
  //   on `image` and `video` resource types. Our resumes are uploaded as resource_type:
  //   "raw", which deliberately bypasses Cloudini's transformation pipeline. Injecting
  //   `fl_attachment` into a raw URL simply returns a 400 or serves the file unchanged.
  //
  // WHY NOT <a href={url} download>:
  //   The HTML `download` attribute is silently ignored by all browsers for cross-origin
  //   URLs (Cloudinary's domain ≠ your app's domain) — it falls back to navigation,
  //   opening the raw binary as text in the tab.
  //
  // THE FIX — fetch → Blob → createObjectURL:
  //   1. We fetch the raw PDF bytes directly (no axios interceptors — plain fetch).
  //   2. We explicitly wrap the bytes in a new Blob({ type: 'application/pdf' }).
  //      This forces the browser to treat the data as a PDF regardless of the
  //      Content-Type header the remote server sent.
  //   3. We create a fully local blob:// URL via URL.createObjectURL(blob).
  //   4. We click an invisible <a> with the blob URL + download attribute.
  //      The `download` attribute WORKS on same-origin blob:// URLs, so the
  //      browser always saves it as a named .pdf file — no CORS issue at all.
  //   5. We immediately revoke the blob URL to free memory.
  //
  // ⚠️  TEST WITH A NEWLY UPLOADED RESUME:
  //     Old database URLs were generated before Cloudinary was configured with
  //     resource_type: "raw" and the careernest_resumes folder. Re-upload from
  //     the Student Dashboard to generate a valid, fetchable URL before testing.
  // ===========================================================================
  const handleDownloadResume = async (resumeUrl: string, studentName: string, applicantId: string) => {
    setDownloadingId(applicantId);
    try {
      // Step 1: Fetch the raw PDF bytes from Cloudinary.
      // Using native fetch (not axios) to avoid the JWT interceptor adding
      // an Authorization header to the Cloudinary request (would cause a 401).
      const response = await fetch(resumeUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch resume: ${response.status} ${response.statusText}`);
      }

      // Step 2: Read as ArrayBuffer and wrap in a Blob with forced MIME type.
      // This guarantees the browser treats the data as a PDF even if Cloudinary
      // served it with a generic Content-Type: application/octet-stream header.
      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });

      // Step 3: Create a fully local blob:// URL.
      // blob:// URLs are same-origin by definition — the `download` attribute
      // is guaranteed to work here.
      const blobUrl = window.URL.createObjectURL(blob);

      // Step 4: Build a sanitized filename and trigger the download.
      const safeName = studentName.trim().replace(/\s+/g, '_') || 'resume';
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `${safeName}_Resume.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Step 5: Revoke the blob URL immediately after click to free memory.
      window.URL.revokeObjectURL(blobUrl);

      toast.success(`Downloaded ${safeName}'s resume`);
    } catch (err) {
      console.error('[Download] Resume fetch failed:', err);
      toast.error('Failed to download resume. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const totalApps = jobs.reduce((s, j) => s + (j._count?.applications ?? 0), 0);
  const activeJobs = jobs.filter((j) => j.isActive).length;

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="text-left border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-black text-slate-100">
          Recruiter Dashboard
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Manage your job postings and review AI-scored applicants
        </p>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          label="Your Open Positions"
          value={activeJobs}
          icon={<Briefcase size={20} className="text-indigo-600" />}
          sub="Your active listings only"
        />
        <StatCard
          label="Total Applications Received"
          value={totalApps}
          icon={<Users size={20} className="text-emerald-600" />}
          sub="Across all your postings"
        />
      </div>

      {/* ── Post job form ─────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-5
                     hover:bg-slate-950 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl">
              <PlusCircle size={20} className="text-indigo-600" />
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-100 text-base">Post a New Job</p>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 font-medium">
                <Sparkles size={12} className="text-emerald-600" />
                AI will automatically extract required skills from your description
              </p>
            </div>
          </div>
          {formOpen
            ? <ChevronUp size={20} className="text-slate-500" />
            : <ChevronDown size={20} className="text-slate-500" />
          }
        </button>

        {formOpen && (
          <div className="px-6 pb-6 border-t border-slate-800 animate-slide-up bg-slate-950">
            <form onSubmit={(e) => { void handlePost(e); }} className="space-y-5 pt-6">
              <FormField
                label="Job Title"
                value={title}
                onChange={setTitle}
                placeholder="e.g. Full Stack Developer Intern"
              />

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Job Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={`Describe the role, responsibilities, and requirements.\n\nExample:\nWe are looking for a React/Node.js developer with 1+ year of experience...\nRequired: React, TypeScript, MongoDB, REST APIs\nMin CGPA: 7.5`}
                  rows={6}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3
                             text-sm text-slate-100 placeholder-gray-400 resize-y
                             focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40
                             transition-colors shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Conditional Float Input Parsing */}
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
                  className="px-6 py-3 rounded-xl border border-slate-700 text-slate-300 bg-slate-900
                             hover:bg-slate-950 transition-colors text-sm font-semibold shadow-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ── Job listings ─────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Briefcase size={18} className="text-indigo-600" />
            Your Postings ({jobs.length})
          </h2>
          <button
            onClick={() => void fetchJobs()}
            disabled={loadingJobs}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={16} className={loadingJobs ? 'animate-spin' : ''} />
          </button>
        </div>

        {loadingJobs ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-slate-950 border border-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Briefcase size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="font-semibold text-slate-100 text-lg">No jobs posted yet</p>
            <p className="text-sm mt-1">Click "Post a New Job" above to get started</p>
          </div>
        ) : (
          <div className="space-y-6">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all duration-300"
              >
                {/* Job Header */}
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-100 text-lg truncate">{job.title}</h3>
                      <p className="text-sm text-slate-400 mt-1 font-medium">
                        Posted {new Date(job.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={cn(
                      'flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold border',
                      job.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-800',
                    )}>
                      {job.isActive ? 'Active' : 'Closed'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {job.requiredSkills.slice(0, 5).map((s) => (
                      <span key={s} className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold rounded-md">
                        {s}
                      </span>
                    ))}
                    {job.requiredSkills.length > 5 && (
                      <span className="text-slate-400 text-xs font-medium self-center px-1">
                        +{job.requiredSkills.length - 5} more
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-6 mt-4 text-sm text-slate-400 border-t border-slate-800 pt-4">
                    <span>CGPA ≥ <span className="font-bold text-slate-100">{job.minCgpa}</span></span>
                    <span>Exp ≥ <span className="font-bold text-slate-100">{job.minExperience} yrs</span></span>


                    <span className="font-semibold text-emerald-600">
                      Total Applicants: {job._count?.applications ?? 0}
                    </span>

                    <div className="ml-auto flex items-center gap-4">

                      <button
                        onClick={() => void handleDeleteJob(job.id)}
                        className="flex items-center gap-1.5 text-red-500 font-semibold hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>


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
                {/* Lazy-loaded Applicants List */}
                {viewingApplicantsFor === job.id && (
                  <div className="bg-slate-950 border-t border-slate-800 p-6 animate-slide-up">
                    <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Search size={16} className="text-indigo-600" />
                      AI Ranked Applicants
                      {!loadingApplicants && (
                        <span className="ml-auto text-indigo-600 font-semibold normal-case text-sm">
                          {applicants.length} {applicants.length === 1 ? 'applicant' : 'applicants'}
                        </span>
                      )}
                    </h4>

                    {loadingApplicants ? (
                      <div className="flex items-center justify-center py-8 gap-3 text-slate-400">
                        <Loader2 size={20} className="animate-spin text-indigo-500" />
                        <span className="text-sm font-medium">Loading applicants…</span>
                      </div>
                    ) : applicants.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <Users size={36} className="mx-auto mb-3 text-slate-600" />
                        <p className="font-medium text-slate-400">No applications yet</p>
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
                              className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between shadow-sm hover:border-indigo-200 transition-colors"
                            >
                              <div className="flex items-center gap-5">
                                <div className="flex-shrink-0">
                                  <CircularProgress score={score} size={56} stroke={5} />
                                </div>
                                <div>
                                  <p className="font-bold text-slate-100">{name}</p>
                                  <p className="text-sm text-slate-400">
                                    {applicant.student.college} · {applicant.student.cgpa} CGPA
                                  </p>
                                  {/* Status badge */}
                                  <span className={cn(
                                    'inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-semibold',
                                    applicant.status === 'PENDING'
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                      : applicant.status === 'SHORTLISTED'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-red-500/10 text-red-400 border border-red-500/20',
                                  )}>
                                    {applicant.status}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 flex-shrink-0">
                                {/* Resume Actions — only shown if student has uploaded a resume */}
                                {/* BUG 1 PERMANENT FIX:
                                    The `download` attribute is silently ignored by all browsers
                                    for cross-origin URLs (Cloudinary is on a different domain).
                                    Strategy: handleDownloadResume() injects `fl_attachment` directly
                                    into the Cloudinary CDN URL path. This forces Cloudinary's server
                                    to respond with Content-Disposition: attachment headers,
                                    making the browser save it as a named PDF file — no CORS issue.
                                    ⚠️ Test ONLY with a newly uploaded resume. Old URLs may be stale. */}
                                {applicant.student.resumeUrl ? (
                                  <div className="flex items-center gap-2">
                                    {/* View: opens inline in new tab for quick preview */}
                                    <a
                                      href={applicant.student.resumeUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                                      title="View resume in new tab"
                                    >
                                      <FileText size={14} />
                                      View
                                      <ExternalLink size={12} />
                                    </a>
                                    {/* Download: fetch→Blob→createObjectURL pattern
                                        bypasses ALL cross-origin download restrictions */}
                                    <button
                                      type="button"
                                      disabled={downloadingId === applicant.id}
                                      onClick={() => {
                                        const name = `${applicant.student.firstName} ${applicant.student.lastName}`.trim()
                                          || applicant.student.user.email;
                                        void handleDownloadResume(applicant.student.resumeUrl!, name, applicant.id);
                                      }}
                                      className="px-3 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Download resume as PDF"
                                    >
                                      {downloadingId === applicant.id
                                        ? <Loader2 size={14} className="animate-spin" />
                                        : <Download size={14} />
                                      }
                                      {downloadingId === applicant.id ? 'Downloading…' : 'Download'}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="px-4 py-2 bg-slate-950 text-slate-500 text-sm rounded-lg border border-slate-800">
                                    No Resume
                                  </span>
                                )}
                                {/* Contact via email */}
                                <a
                                  href={`mailto:${applicant.student.user.email}`}
                                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-500/10 rounded-lg transition-colors"
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <span className="text-slate-400 text-sm font-semibold">{label}</span>
        <div className="p-2.5 bg-slate-950 rounded-xl">{icon}</div>
      </div>
      <p className="text-4xl font-black text-slate-100">{value}</p>
      <p className="text-slate-400 text-xs mt-2 font-medium">{sub}</p>
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
      <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
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
        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3
                   text-sm text-slate-100 placeholder-gray-400
                   focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40
                   transition-colors shadow-sm"
      />
    </div>
  );
}
