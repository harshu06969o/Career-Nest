import { useEffect, useRef, useState, useCallback } from 'react';
import {
  UploadCloud, FileText, Zap, Trophy, TrendingUp,
  Briefcase, CheckCircle, Loader2, RefreshCw, ChevronRight,
  Info, GraduationCap, Building2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';
import { useAuthStore } from '../../store/authStore';
import CircularProgress from '../../components/CircularProgress';
import { cn } from '../../lib/cn';

// =============================================================================
// Types (UNCHANGED)
// =============================================================================
interface StudentProfile {
  firstName:      string;
  lastName:       string;
  college:        string;
  cgpa:           number;
  experienceYears: number;
  resumeUrl:      string | null;
  parsedSkills:   string[];
}

interface MatchedJob {
  matchScore: number;
  hasApplied: boolean; // BUG 2 FIX: injected by backend so apply state survives page refresh
  job: {
    id:            string;
    title:         string;
    description:   string;
    requiredSkills: string[];
    minCgpa:       number;
    minExperience: number;
    recruiter?: {
      recruiterProfile?: { companyName: string; designation: string } | null;
    };
  };
}

/**
 * Performs a zero-token local computation to determine the skill gap.
 * 
 * @param {string[]} required - Array of skills required by the job.
 * @param {string[]} studentSkills - Array of skills extracted from the student's resume.
 * @returns {{ matched: string[], missing: string[] }} The intersection and difference of the two sets.
 */
function analyzeSkillGap(required: string[], studentSkills: string[]) {
  const studentSkillsLower = studentSkills.map(s => s.toLowerCase());
  const matched: string[] = [];
  const missing: string[] = [];

  required.forEach(skill => {
    if (studentSkillsLower.includes(skill.toLowerCase())) {
      matched.push(skill);
    } else {
      missing.push(skill);
    }
  });

  return { matched, missing };
}

/**
 * Student Dashboard Component.
 * Acts as the primary interface for students to upload resumes, view their profile, 
 * and browse AI-matched job opportunities.
 * 
 * REDESIGN: Enterprise light theme — white cards, slate borders, indigo accents.
 * All API calls, state hooks, and event handlers are UNCHANGED.
 */
export default function StudentDashboard() {
  const { user } = useAuthStore();

  const [profile,   setProfile]   = useState<StudentProfile | null>(null);
  const [matches,   setMatches]   = useState<MatchedJob[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [uploading,  setUploading]  = useState(false);
  const [applying,   setApplying]   = useState<string | null>(null); // jobId
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set()); // Track applied jobs
  const [dragOver,   setDragOver]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);


  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: StudentProfile }>('/student/profile');
      setProfile(data.data);
    } catch {
      // 404 means profile not yet created — handled gracefully in UI
    } finally {
      setLoadingProfile(false);
    }
  }, []);


  const fetchMatches = useCallback(async () => {
    setLoadingMatches(true);
    try {
      const { data } = await api.get<{ data: MatchedJob[] }>('/eligibility/matches');
      const fetched = data.data ?? [];
      setMatches(fetched);

      // BUG 2 FIX: Initialize appliedJobs Set from the hasApplied flags the
      // backend injected. This ensures the 'Applied' button state is correct
      // on every page load — not just within the same session.
      const preApplied = new Set(
        fetched.filter((m) => m.hasApplied).map((m) => m.job.id),
      );
      setAppliedJobs(preApplied);
    } catch {
      // Silently fail — matches can be empty while resume is pending
    } finally {
      setLoadingMatches(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
    void fetchMatches();
  }, [fetchProfile, fetchMatches]);


  const handleUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5 MB.');
      return;
    }

    setUploading(true);
    const form = new FormData();
    form.append('resume', file);

    try {
      await api.post('/student/resume', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Resume uploaded & parsed! ✨');
      await fetchProfile();
      await fetchMatches();
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };


  const handleApply = async (jobId: string, jobTitle: string) => {
    setApplying(jobId);
    try {
      await api.post(
        `/eligibility/apply/${jobId}`,
      );
      toast.success(`Successfully applied to "${jobTitle}"! 🎉`);
      setAppliedJobs(prev => new Set(prev).add(jobId));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Application failed.';
      toast.error(msg);
    } finally {
      setApplying(null);
    }
  };


  const stats = [
    {
      label:    'Skills Parsed',
      value:    profile?.parsedSkills.length ?? 0,
      icon:     <Zap size={20} className="text-indigo-600" />,
      iconBg:   'bg-indigo-50',
      color:    'text-indigo-600',
    },
    {
      label:    'Job Matches',
      value:    matches.length,
      icon:     <Trophy size={20} className="text-emerald-600" />,
      iconBg:   'bg-emerald-50',
      color:    'text-emerald-600',
    },
    {
      label:    'Top Score',
      value:    matches[0] ? `${matches[0].matchScore}%` : '—',
      icon:     <TrendingUp size={20} className="text-violet-600" />,
      iconBg:   'bg-violet-50',
      color:    'text-violet-600',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in w-full">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="section-header">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">
              Student Dashboard
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              Welcome back,{' '}
              <span className="text-slate-700 font-semibold">
                {profile?.firstName ?? user?.email ?? 'Student'}
              </span>
            </p>
          </div>
          {profile && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              <CheckCircle size={16} className="text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">Profile Active</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats grid — 1 col mobile / 3 col desktop ────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loadingProfile
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="enterprise-card p-6">
                <div className="skeleton h-4 w-24 mb-4" />
                <div className="skeleton h-8 w-16" />
              </div>
            ))
          : stats.map(({ label, value, icon, iconBg }) => (
              <div
                key={label}
                className="enterprise-card p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-slate-500 text-sm font-medium">{label}</span>
                  <div className={cn('p-2 rounded-lg', iconBg)}>{icon}</div>
                </div>
                <p className="text-3xl font-black text-slate-900">{value}</p>
              </div>
            ))
        }
      </div>

      {/* ── Profile info strip ───────────────────────────────────────────── */}
      {profile && (
        <div className="enterprise-card p-6">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <GraduationCap size={14} className="text-indigo-500" />
            Profile Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'CGPA',       value: profile.cgpa.toFixed(1),                  accent: 'text-indigo-700' },
              { label: 'Experience', value: `${profile.experienceYears} yrs`,          accent: 'text-slate-900' },
              { label: 'College',    value: profile.college,                            accent: 'text-slate-900' },
              { label: 'Resume',     value: profile.resumeUrl ? 'Uploaded ✓' : 'Missing', accent: profile.resumeUrl ? 'text-emerald-700' : 'text-red-600' },
            ].map(({ label, value, accent }) => (
              <div key={label} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-medium">{label}</p>
                <p className={cn('text-sm font-bold truncate', accent)}>{value}</p>
              </div>
            ))}
          </div>

          {/* Skills */}
          {profile.parsedSkills.length > 0 && (
            <div className="mt-5">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-2 font-bold flex items-center gap-1.5">
                <Zap size={12} className="text-indigo-500" />
                Parsed Skills from Resume
              </p>
              <div className="flex flex-wrap gap-1.5">
                {profile.parsedSkills.map((skill) => (
                  <span
                    key={skill}
                    className="px-2.5 py-1 bg-indigo-50 border border-indigo-100
                               text-indigo-700 text-xs font-semibold rounded-md"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Resume upload dropzone ────────────────────────────────────────── */}
      <div className="enterprise-card p-6">
        <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
          <FileText size={16} className="text-indigo-500" />
          Resume Upload
        </h2>

        <div
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) void handleUpload(file);
          }}
          className={cn(
            'border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3',
            'cursor-pointer transition-all duration-200',
            uploading
              ? 'border-indigo-300 bg-indigo-50/50 cursor-not-allowed'
              : dragOver
              ? 'border-indigo-500 bg-indigo-50 scale-[1.01]'
              : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/30',
          )}
        >
          {uploading ? (
            <>
              <Loader2 size={36} className="text-indigo-500 animate-spin" />
              <p className="text-indigo-600 font-semibold text-sm">Uploading & parsing…</p>
              <p className="text-indigo-400 text-xs">AI is extracting your skills</p>
            </>
          ) : profile?.resumeUrl ? (
            <>
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle size={24} className="text-emerald-600" />
              </div>
              <p className="text-emerald-700 font-semibold text-sm">Resume uploaded ✓</p>
              <p className="text-slate-400 text-xs">Drop a new PDF to replace it</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                <UploadCloud size={24} className="text-slate-400" />
              </div>
              <p className="text-slate-700 font-semibold text-sm">
                Drop your PDF here or{' '}
                <span className="text-indigo-600 underline underline-offset-2">click to browse</span>
              </p>
              <p className="text-slate-400 text-xs">Max 5 MB · PDF only · AI parses on upload</p>
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
            e.target.value = '';
          }}
        />
      </div>

      {/* ── Job matches feed ─────────────────────────────────────────────── */}
      <div className="enterprise-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Briefcase size={16} className="text-indigo-500" />
            AI Job Matches
            {!loadingMatches && matches.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                {matches.length}
              </span>
            )}
          </h2>
          <button
            onClick={() => void fetchMatches()}
            disabled={loadingMatches}
            className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            aria-label="Refresh matches"
          >
            <RefreshCw size={15} className={loadingMatches ? 'animate-spin' : ''} />
          </button>
        </div>

        {loadingMatches ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-5">
                <div className="skeleton h-4 w-1/2 mb-3" />
                <div className="skeleton h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase size={28} className="text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700 text-base">No matches yet</p>
            <p className="text-slate-400 text-sm mt-1">Upload your resume to start matching jobs</p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map(({ matchScore, job }) => {
              const { matched, missing } = analyzeSkillGap(job.requiredSkills, profile?.parsedSkills ?? []);
              const companyName = job.recruiter?.recruiterProfile?.companyName || 'this company';
              const isApplied   = appliedJobs.has(job.id);
              const canApply    = matchScore >= 50 && !isApplied;

              return (
                <div
                  key={job.id}
                  className="job-card flex flex-col gap-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Score ring */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                      <CircularProgress score={matchScore} size={72} stroke={7} />
                      {/* Score label badge */}
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full',
                        matchScore >= 80
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : matchScore >= 50
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-red-50 text-red-700 border border-red-200',
                      )}>
                        {matchScore >= 80 ? 'Excellent' : matchScore >= 50 ? 'Good Fit' : 'Low Match'}
                      </span>
                    </div>

                    {/* Job info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-slate-900 text-lg leading-snug mb-1">{job.title}</h3>
                      {job.recruiter?.recruiterProfile && (
                        <p className="text-sm text-slate-500 mb-3 flex items-center gap-1.5">
                          <Building2 size={13} className="text-slate-400" />
                          <span className="font-semibold text-slate-700">
                            {job.recruiter.recruiterProfile.companyName}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span>{job.recruiter.recruiterProfile.designation}</span>
                        </p>
                      )}

                      <div className="flex gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 font-medium">
                          Min CGPA: <span className="text-slate-800 font-bold ml-0.5">{job.minCgpa}</span>
                        </span>
                        <span className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 font-medium">
                          Min Exp: <span className="text-slate-800 font-bold ml-0.5">{job.minExperience} yrs</span>
                        </span>
                      </div>
                    </div>

                    {/* Apply button */}
                    <button
                      onClick={() => void handleApply(job.id, job.title)}
                      disabled={applying === job.id || !canApply}
                      className={cn(
                        'flex-shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg',
                        'text-sm font-bold transition-all duration-150 w-full sm:w-auto',
                        isApplied
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed'
                          : canApply
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm active:scale-[0.98]'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200',
                        applying === job.id && 'opacity-70 cursor-not-allowed',
                      )}
                    >
                      {applying === job.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : isApplied ? (
                        <CheckCircle size={15} />
                      ) : (
                        <ChevronRight size={15} />
                      )}
                      {isApplied ? 'Applied' : matchScore >= 50 ? 'Apply Now' : 'Below Threshold'}
                    </button>
                  </div>

                  {/* ── Skill Gap Analysis ────────────────────────────── */}
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                      Skill Gap Analysis
                    </h4>
                    <div className="flex flex-col gap-3">

                      {/* Matched / Missing Pills */}
                      <div className="flex flex-wrap gap-1.5">
                        {matched.map(skill => (
                          <span key={skill} className="skill-matched">✓ {skill}</span>
                        ))}
                        {missing.map(skill => (
                          <span key={skill} className="skill-missing">✗ {skill}</span>
                        ))}
                      </div>

                      {/* Dynamic Advice Snippet */}
                      {missing.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex items-start gap-2.5">
                          <Info size={15} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-indigo-800 leading-relaxed">
                            <strong>Tip:</strong> You are missing{' '}
                            <span className="font-bold text-indigo-700">{missing[0]}</span>. Consider adding a
                            project using this skill before applying to {companyName}.
                          </p>
                        </div>
                      )}
                      {missing.length === 0 && matched.length > 0 && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-start gap-2.5">
                          <CheckCircle size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-emerald-800 leading-relaxed">
                            <strong>Perfect Match!</strong> Your resume covers all required skills. You have a
                            high chance of standing out to {companyName}.
                          </p>
                        </div>
                      )}

                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
