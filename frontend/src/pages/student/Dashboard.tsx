import { useEffect, useRef, useState, useCallback } from 'react';
import {
  UploadCloud, FileText, Zap, Trophy, TrendingUp,
  Briefcase, CheckCircle, Loader2, RefreshCw, ChevronRight,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';
import { useAuthStore } from '../../store/authStore';
import CircularProgress from '../../components/CircularProgress';
import { cn } from '../../lib/cn';

// =============================================================================
// Types
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
      setMatches(data.data);
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
      label:   'Skills Parsed',
      value:   profile?.parsedSkills.length ?? 0,
      icon:    <Zap size={20} className="text-emerald-400" />,
      color:   'emerald',
    },
    {
      label:   'Job Matches',
      value:   matches.length,
      icon:    <Trophy size={20} className="text-blue-400" />,
      color:   'blue',
    },
    {
      label:   'Top Score',
      value:   matches[0] ? `${matches[0].matchScore}%` : '—',
      icon:    <TrendingUp size={20} className="text-indigo-400" />,
      color:   'indigo',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in w-full">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="text-left border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-black text-slate-100">
          Student Dashboard
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Welcome back,{' '}
          <span className="text-slate-100 font-semibold">
            {profile?.firstName ?? user?.email ?? 'Student'}
          </span>
        </p>
      </div>

      {/* ── Stats grid — 1 col mobile / 3 col desktop ────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loadingProfile
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm animate-pulse">
                <div className="h-4 w-24 bg-slate-800 rounded mb-4" />
                <div className="h-8 w-16 bg-slate-800 rounded" />
              </div>
            ))
          : stats.map(({ label, value, icon }) => (
              <div
                key={label}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-slate-400 text-sm font-medium">{label}</span>
                  <div className="p-2 bg-slate-800/50 rounded-xl">{icon}</div>
                </div>
                <p className="text-3xl font-black text-slate-100">{value}</p>
              </div>
            ))
        }
      </div>

      {/* ── Profile info strip ───────────────────────────────────────────── */}
      {profile && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Profile Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { label: 'CGPA',       value: profile.cgpa.toFixed(1) },
              { label: 'Experience', value: `${profile.experienceYears} yrs` },
              { label: 'College',    value: profile.college },
              { label: 'Resume',     value: profile.resumeUrl ? '✅ Uploaded' : '❌ Missing' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm font-bold text-slate-100 truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* Skills */}
          {profile.parsedSkills.length > 0 && (
            <div className="mt-6">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-semibold">Parsed Skills</p>
              <div className="flex flex-wrap gap-2">
                {profile.parsedSkills.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 bg-slate-800 border border-slate-700
                               text-slate-300 text-xs font-medium rounded-full"
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-4">
          <FileText size={18} className="text-indigo-400"/>
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
            'border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3',
            'cursor-pointer transition-all duration-200 bg-slate-950',
            uploading
              ? 'border-indigo-500/50 bg-indigo-500/10 cursor-not-allowed'
              : dragOver
              ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
              : 'border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/50',
          )}
        >
          {uploading ? (
            <>
              <Loader2 size={36} className="text-indigo-400 animate-spin" />
              <p className="text-indigo-400 font-semibold text-sm">Uploading &amp; parsing…</p>
              <p className="text-indigo-500/80 text-xs">AI is extracting your skills</p>
            </>
          ) : profile?.resumeUrl ? (
            <>
              <CheckCircle size={36} className="text-emerald-400" />
              <p className="text-emerald-400 font-semibold text-sm">Resume uploaded ✓</p>
              <p className="text-slate-500 text-xs">Drop a new PDF to replace it</p>
            </>
          ) : (
            <>
              <UploadCloud size={36} className="text-slate-500" />
              <p className="text-slate-300 font-semibold text-sm">
                Drop your PDF here or <span className="text-indigo-400">click to browse</span>
              </p>
              <p className="text-slate-500 text-xs">Max 5 MB · PDF only · AI parses on upload</p>
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Briefcase size={18} className="text-indigo-400" />
            AI Job Matches
          </h2>
          <button
            onClick={() => void fetchMatches()}
            disabled={loadingMatches}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            aria-label="Refresh matches"
          >
            <RefreshCw size={16} className={loadingMatches ? 'animate-spin' : ''} />
          </button>
        </div>

        {loadingMatches ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 animate-pulse">
                <div className="h-4 w-1/2 bg-slate-800 rounded mb-3" />
                <div className="h-3 w-1/3 bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Briefcase size={40} className="mx-auto mb-3 text-slate-700" />
            <p className="font-medium text-slate-300">No matches yet</p>
            <p className="text-sm mt-1">Upload your resume to start matching jobs</p>
          </div>
        ) : (
          <div className="space-y-6">
            {matches.map(({ matchScore, job }) => {
              const { matched, missing } = analyzeSkillGap(job.requiredSkills, profile?.parsedSkills ?? []);
              const companyName = job.recruiter?.recruiterProfile?.companyName || 'this company';

              return (
                <div
                  key={job.id}
                  className="group bg-slate-950 border border-slate-800 rounded-xl p-6
                             hover:border-indigo-500/50 hover:shadow-[0_0_15px_rgba(99,102,241,0.1)] transition-all duration-300
                             flex flex-col gap-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Score ring */}
                    <div className="flex-shrink-0 mx-auto sm:mx-0">
                      <CircularProgress score={matchScore} size={72} stroke={7} />
                    </div>

                    {/* Job info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-100 text-lg mb-1">{job.title}</h3>
                      {job.recruiter?.recruiterProfile && (
                        <p className="text-sm font-medium text-slate-400 mb-3">
                          {job.recruiter.recruiterProfile.companyName} ·{' '}
                          <span className="text-slate-500">{job.recruiter.recruiterProfile.designation}</span>
                        </p>
                      )}
                      
                      <div className="flex gap-4 mt-2 text-sm text-slate-300 bg-slate-900 w-fit px-3 py-1.5 rounded-lg border border-slate-800">
                        <span>Min CGPA: <span className="font-semibold text-slate-100">{job.minCgpa}</span></span>
                        <span>Min Exp: <span className="font-semibold text-slate-100">{job.minExperience} yrs</span></span>
                      </div>
                    </div>

                    {/* Apply button */}
                    <button
                      onClick={() => void handleApply(job.id, job.title)}
                      disabled={applying === job.id || matchScore < 50 || appliedJobs.has(job.id)}
                      className={cn(
                        'flex-shrink-0 flex items-center justify-center gap-2 px-6 py-3 rounded-lg',
                        'text-sm font-semibold transition-all duration-200 shadow-sm w-full sm:w-auto',
                        appliedJobs.has(job.id)
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-not-allowed'
                          : matchScore >= 50
                            ? 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-[0.98]'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700',
                        applying === job.id && 'opacity-70 cursor-not-allowed',
                      )}
                    >
                      {applying === job.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : appliedJobs.has(job.id) ? (
                        <CheckCircle size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                      {appliedJobs.has(job.id) ? 'Applied' : matchScore >= 50 ? 'Apply Now' : 'Below threshold'}
                    </button>
                  </div>

                  {/* ── Skill Gap Analysis ───────────────────────────── */}
                  <div className="mt-2 pt-4 border-t border-slate-800">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                      Skill Gap Analysis
                    </h4>
                    <div className="flex flex-col gap-3">
                      
                      {/* Matched / Missing Pills */}
                      <div className="flex flex-wrap gap-2">
                        {matched.map(skill => (
                          <span key={skill} className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-xs font-medium">
                            ✓ {skill}
                          </span>
                        ))}
                        {missing.map(skill => (
                          <span key={skill} className="px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md text-xs font-medium">
                            ✗ {skill}
                          </span>
                        ))}
                      </div>

                      {/* Dynamic Advice Snippet */}
                      {missing.length > 0 && (
                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 flex items-start gap-2.5">
                          <Info size={16} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-indigo-200 leading-relaxed">
                            <strong>Tip:</strong> You are missing <span className="font-semibold text-indigo-300">{missing[0]}</span>. Consider adding a project using this to your resume before applying to {companyName}.
                          </p>
                        </div>
                      )}
                      {missing.length === 0 && matched.length > 0 && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-start gap-2.5">
                          <CheckCircle size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-emerald-200 leading-relaxed">
                            <strong>Perfect Match!</strong> Your resume covers all required skills. You have a high chance of standing out to {companyName}.
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
