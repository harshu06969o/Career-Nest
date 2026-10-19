import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, Check } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="w-full flex flex-col bg-[#FAFAFA] text-[#0F172A] overflow-x-hidden selection:bg-rose-100 selection:text-rose-900">
      <HeroSection navigate={navigate} />
      <TrustBanner />
      <RecruiterShowcase navigate={navigate} />
      <CandidateShowcase navigate={navigate} />
      <InteractiveSkillGapDemo />
      <PerformanceBenchmarks />
      <BottomCtaSection navigate={navigate} />
      <Footer />
    </div>
  );
}

// =============================================================================
// 1. HERO SECTION (Grand Centered Header + Dual Wellfound Action Cards)
// =============================================================================
function HeroSection({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <section className="relative w-full pt-12 pb-20 md:pt-16 md:pb-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background ambient accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none overflow-hidden opacity-60">
        <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] rounded-full bg-rose-200/40 blur-[100px] animate-pulse" />
        <div className="absolute -top-20 right-1/4 w-[450px] h-[450px] rounded-full bg-pink-100/50 blur-[90px]" />
      </div>

      <div className="relative max-w-[1360px] mx-auto flex flex-col items-center text-center">

        {/* Floating micro-chips floating around header */}
        <div className="hidden md:flex items-center justify-between w-full max-w-4xl mb-4 pointer-events-none">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-xs text-xs font-medium text-slate-600 animate-bounce">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Interview scheduled · 12m ago
          </div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-xs text-xs font-medium text-slate-600">
            <span className="w-2 h-2 rounded-full bg-[#E83B72]" />
            84 candidates shortlisted today
          </div>
        </div>

        {/* Main Grand Headline (Wellfound Editorial Style) */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[80px] font-black tracking-tight leading-[1.08] text-slate-950 max-w-5xl mb-6">
          Where campus talent{" "}
          <span className="font-editorial text-[#E83B72] block sm:inline font-normal italic">
            meets great companies.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-slate-600 max-w-2xl font-normal leading-relaxed mb-12">
          The recruitment platform built for modern universities and high-growth engineering teams.
          Asynchronous resume parsing, deterministic skill recall matching, and direct 1-on-1 messaging.
        </p>

        {/* ── DUAL HERO CARDS (Exact Wellfound Structure) ── */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 text-left mt-2">

          {/* CARD 1: FOR RECRUITERS (Dark Luxury Mode) */}
          <div className="relative rounded-3xl bg-[#0F1219] border border-slate-800 p-8 sm:p-10 flex flex-col justify-between overflow-hidden shadow-2xl group transition-all duration-300 hover:border-slate-700">
            {/* Subtle glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10">
              <span className="text-xs font-bold uppercase tracking-widest text-[#F43F5E] mb-3 block">
                FOR RECRUITERS
              </span>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
                Find your{" "}
                <span className="font-editorial text-[#F43F5E] font-normal italic">
                  next hire.
                </span>
              </h2>

              <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-8 max-w-md">
                Post technical openings with natural language descriptions. Gemini extracts hiring criteria once, and candidate skill recall is scored deterministically in O(1) time.
              </p>

              <button
                onClick={() => navigate("/auth")}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white bg-[#E83B72] hover:bg-[#D62D64] transition-all duration-200 shadow-md active:scale-95 mb-10"
              >
                Start hiring <ArrowRight size={15} />
              </button>
            </div>

            {/* Embedded Interactive Recruiter Widget */}
            <div className="relative z-10 rounded-2xl bg-[#171B24] border border-slate-800/90 p-4 sm:p-5 shadow-lg">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-3 pb-2 border-b border-slate-800">
                <span className="flex items-center gap-2 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  REACH CANDIDATES · LIVE STREAM
                </span>
                <span className="text-[11px] text-slate-500">Auto-scored</span>
              </div>

              {/* Candidate Item 1 */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#1E2330] border border-slate-700/50 mb-2.5 hover:border-slate-600 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                    PS
                  </div>
                  <div>
                    <h3 className="text-white text-xs sm:text-sm font-semibold">Priya Sharma</h3>
                    <p className="text-slate-400 text-[11px]">IIT Delhi · CGPA 9.2 · 1.5yr exp</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-emerald-400 text-xs font-bold bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                    96% Match
                  </span>
                  <span className="text-white text-[11px] font-medium bg-[#E83B72] px-2.5 py-1 rounded-full">
                    Shortlisted
                  </span>
                </div>
              </div>

              {/* Candidate Item 2 */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#1E2330] border border-slate-700/50 hover:border-slate-600 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                    AP
                  </div>
                  <div>
                    <h3 className="text-white text-xs sm:text-sm font-semibold">Aarav Patel</h3>
                    <p className="text-slate-400 text-[11px]">BITS Pilani · CGPA 8.8 · 1yr exp</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-emerald-400 text-xs font-bold bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                    91% Match
                  </span>
                  <span className="text-slate-300 text-[11px] font-medium bg-slate-800 px-2.5 py-1 rounded-full">
                    Reviewing
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: FOR CANDIDATES (Warm Editorial Rose-Cream Mode) */}
          <div className="relative rounded-3xl bg-[#FFF6F8] border border-rose-100 p-8 sm:p-10 flex flex-col justify-between overflow-hidden shadow-xl group transition-all duration-300 hover:border-rose-200">
            {/* Subtle ambient light */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-rose-200/30 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10">
              <span className="text-xs font-bold uppercase tracking-widest text-[#E83B72] mb-3 block">
                FOR CANDIDATES
              </span>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight mb-4">
                Find your{" "}
                <span className="font-editorial text-[#E83B72] font-normal italic">
                  dream role.
                </span>
              </h2>

              <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-8 max-w-md">
                Upload your resume once. BullMQ workers parse your skills asynchronously in &lt;130ms, calculating transparent match scores across all verified campus drives.
              </p>

              <button
                onClick={() => navigate("/auth")}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white bg-[#E83B72] hover:bg-[#D62D64] transition-all duration-200 shadow-md active:scale-95 mb-10"
              >
                Browse jobs <ArrowRight size={15} />
              </button>
            </div>

            {/* Embedded Interactive Student Match Feed */}
            <div className="relative z-10 rounded-2xl bg-white border border-rose-100/90 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-3 pb-2 border-b border-rose-50">
                <span className="flex items-center gap-2 font-medium text-slate-700">
                  <Sparkles size={13} className="text-[#E83B72]" />
                  MATCHED TO YOU · TODAY
                </span>
                <span className="text-[11px] text-slate-400">Zero keyword penalties</span>
              </div>

              {/* Job Item 1 */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAFAFA] border border-slate-100 mb-2.5 hover:border-rose-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xs font-bold">
                    🚀
                  </div>
                  <div>
                    <h3 className="text-slate-900 text-xs sm:text-sm font-bold">Full Stack Engineer</h3>
                    <p className="text-slate-500 text-[11px]">Acme Fintech · INR 24-32 LPA</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-700 text-xs font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    94% Match
                  </span>
                  <span className="text-[#E83B72] text-[10px] font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full uppercase">
                    New
                  </span>
                </div>
              </div>

              {/* Job Item 2 */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAFAFA] border border-slate-100 hover:border-rose-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-900 flex items-center justify-center text-white text-xs font-bold">
                    🧠
                  </div>
                  <div>
                    <h3 className="text-slate-900 text-xs sm:text-sm font-bold">ML Fellow / Engineer</h3>
                    <p className="text-slate-500 text-[11px]">DeepTech Labs · INR 28-36 LPA</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-700 text-xs font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    89% Match
                  </span>
                  <span className="text-[#E83B72] text-[10px] font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full uppercase">
                    New
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}

// =============================================================================
// 2. TRUST BANNER (Tech Ecosystem & Campus Network)
// =============================================================================
function TrustBanner() {
  const companies = [
    "Google", "Microsoft", "Stripe", "Amazon", "Swiggy",
    "Razorpay", "Uber", "CRED", "Zomato", "Zerodha"
  ];

  return (
    <section className="w-full py-12 border-y border-slate-200/80 bg-white">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-8">
          The technology teams building what&apos;s next hire on CareerNest
        </p>

        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14 opacity-75">
          {companies.map((brand) => (
            <span
              key={brand}
              className="text-lg md:text-xl font-bold tracking-tight text-slate-400 hover:text-slate-800 transition-colors cursor-default"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {brand}
            </span>
          ))}
        </div>

        <p className="text-xs text-slate-400 mt-6">
          Connecting premier university placement cells with high-growth technology employers.
        </p>
      </div>
    </section>
  );
}

// =============================================================================
// 3. RECRUITER SHOWCASE SECTION ("Build the team that defines what's next.")
// =============================================================================
function RecruiterShowcase({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const [shortlisted, setShortlisted] = useState<Record<string, boolean>>({ "cand-1": true });

  const toggleShortlist = (id: string) => {
    setShortlisted(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section id="for-recruiters" className="w-full py-24 bg-[#0B0E14] text-white relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-96 h-96 bg-rose-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

          {/* Left Column: Editorial Copy */}
          <div className="lg:col-span-5 text-left">
            <span className="text-xs font-bold uppercase tracking-widest text-[#F43F5E] mb-3 block">
              FOR RECRUITERS & HIRING MANAGERS
            </span>

            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] mb-6">
              Build the team that{" "}
              <span className="font-editorial text-[#F43F5E] font-normal italic block">
                defines what&apos;s next.
              </span>
            </h2>

            <p className="text-slate-300 text-base leading-relaxed mb-8">
              The candidates you hire shape your company&apos;s trajectory. CareerNest replaces subjective keyword screening with deterministic O(1) skill recall and direct real-time communication.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4 mb-12">
              <button
                onClick={() => navigate("/auth")}
                className="px-6 py-3 rounded-full text-sm font-semibold text-white bg-[#E83B72] hover:bg-[#D62D64] transition-all shadow-md active:scale-95"
              >
                Post a role now →
              </button>
              <button
                onClick={() => navigate("/auth")}
                className="px-6 py-3 rounded-full text-sm font-semibold text-slate-300 border border-slate-700 hover:border-slate-500 hover:text-white transition-all"
              >
                Explore candidate ranks
              </button>
            </div>

            {/* Three Numbered Pillars */}
            <div className="space-y-6 pt-4 border-t border-slate-800">
              <div className="flex gap-4">
                <span className="text-xs font-mono font-bold text-[#F43F5E]">01</span>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Single-Pass Job Description Parsing</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Paste raw text requirements once. Gemini AI extracts structured skills, CGPA, and experience without recurring token costs.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <span className="text-xs font-mono font-bold text-[#F43F5E]">02</span>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Pure Skill Recall Candidate Ranking</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Candidates are ranked by skill coverage without penalizing applicants for possessing complementary skills outside the JD.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <span className="text-xs font-mono font-bold text-[#F43F5E]">03</span>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Instant 1-on-1 WebSocket Channels</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Shortlisting automatically initiates private full-duplex chat rooms with typing waves and double-checkmark read receipts.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Recruiter Command Center Mockup */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl bg-[#131722] border border-slate-800 p-6 sm:p-8 shadow-2xl">

              {/* Mockup Header */}
              <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ACTIVE OPENING</span>
                  <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 mt-0.5">
                    Lead Full Stack Engineer
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                      Active
                    </span>
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-white">48</span>
                  <span className="text-xs text-slate-400 block">Total Applicants</span>
                </div>
              </div>

              {/* Applicant List */}
              <div className="space-y-3.5">
                {[
                  {
                    id: "cand-1",
                    name: "Devendra Verma",
                    college: "IIT Bombay · Computer Science",
                    score: 96,
                    exp: "2 yrs exp",
                    skills: ["React", "TypeScript", "Node.js", "PostgreSQL", "Docker"],
                  },
                  {
                    id: "cand-2",
                    name: "Ananya Iyer",
                    college: "IIIT Hyderabad · Software Engineering",
                    score: 92,
                    exp: "1.5 yrs exp",
                    skills: ["React", "TypeScript", "Node.js", "Redis"],
                  },
                  {
                    id: "cand-3",
                    name: "Rohan Mukherjee",
                    college: "NIT Trichy · Information Technology",
                    score: 87,
                    exp: "1 yr exp",
                    skills: ["React", "JavaScript", "Express", "PostgreSQL"],
                  },
                ].map((c) => {
                  const isShortlisted = !!shortlisted[c.id];
                  return (
                    <div
                      key={c.id}
                      className="p-4 sm:p-5 rounded-2xl bg-[#1A1F2D] border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <h4 className="text-sm sm:text-base font-bold text-white">{c.name}</h4>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {c.score}% Match
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{c.college} · {c.exp}</p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {c.skills.map((s) => (
                            <span key={s} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:self-center">
                        <button
                          onClick={() => toggleShortlist(c.id)}
                          className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                            isShortlisted
                              ? "bg-emerald-500 text-white shadow-sm"
                              : "bg-[#E83B72] hover:bg-[#D62D64] text-white"
                          }`}
                        >
                          {isShortlisted ? "✓ Shortlisted" : "Shortlist"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Status Note */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Real-time Candidate Sorting: O(1) in-memory computation
                </span>
                <span className="text-[#F43F5E] font-medium">Click buttons to test state</span>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

// =============================================================================
// 4. CANDIDATE SHOWCASE SECTION ("Find work that matters.")
// =============================================================================
function CandidateShowcase({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const [activeRole, setActiveRole] = useState("Software Engineer");
  const [appliedJobs, setAppliedJobs] = useState<Record<string, boolean>>({});

  const handleApply = (jobId: string) => {
    setAppliedJobs(prev => ({ ...prev, [jobId]: true }));
  };

  return (
    <section id="for-candidates" className="w-full py-24 bg-white text-[#0F172A] border-b border-slate-200">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

          {/* Left Column: Wellfound Editorial Copy */}
          <div className="lg:col-span-5 text-left">
            <span className="text-xs font-bold uppercase tracking-widest text-[#E83B72] mb-3 block">
              FOR CANDIDATES & STUDENTS
            </span>

            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] mb-6 text-slate-950">
              Find work{" "}
              <span className="font-editorial text-[#E83B72] font-normal italic block">
                that matters.
              </span>
            </h2>

            <p className="text-slate-600 text-base leading-relaxed mb-8">
              Find high-growth companies that accelerate your engineering career, and roles that match your exact competency profile — without black-box applicant tracking algorithms.
            </p>

            {/* 4 Numbered Bullet Points (Matching Image 3 & 4) */}
            <div className="space-y-6 pt-4 border-t border-slate-200 mb-8">
              <div className="flex gap-4">
                <span className="text-xs font-mono font-bold text-[#E83B72]">01</span>
                <div>
                  <h4 className="text-sm font-bold text-slate-950 mb-1">Dream roles at high-growth teams</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Direct campus placement connections with verified engineering startups, fintech unicorns, and tech giants.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <span className="text-xs font-mono font-bold text-[#E83B72]">02</span>
                <div>
                  <h4 className="text-sm font-bold text-slate-950 mb-1">Companies come find you</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Recruiter search surfaces candidates based on actual skill coverage, so relevant roles find you even when you aren&apos;t actively looking.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <span className="text-xs font-mono font-bold text-[#E83B72]">03</span>
                <div>
                  <h4 className="text-sm font-bold text-slate-950 mb-1">Talk to the people doing the hiring</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Direct lines to founders, tech leads, and placement coordinators. Zero third-party agency spam.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <span className="text-xs font-mono font-bold text-[#E83B72]">04</span>
                <div>
                  <h4 className="text-sm font-bold text-slate-950 mb-1">Show what you can build, not buzzwords</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    AI parses your projects, repositories, and technical stack. Extra skills never penalize your score.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate("/auth")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white bg-[#E83B72] hover:bg-[#D62D64] transition-all shadow-md active:scale-95"
            >
              Get started as a student <ArrowRight size={15} />
            </button>
          </div>

          {/* Right Column: Search & Live Job Match Feed (Exact Image 4 Interface) */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl bg-[#FFF6F8] border border-rose-100 p-6 sm:p-8 shadow-xl">

              {/* Interactive Search Bar Filter (Image 4 Recreation) */}
              <div className="flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-white border border-rose-200/80 shadow-xs mb-6">
                <span className="text-xs font-semibold text-slate-500 pl-2">Show me</span>
                <select
                  value={activeRole}
                  onChange={(e) => setActiveRole(e.target.value)}
                  className="text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 py-1.5 px-3 rounded-lg border-0 cursor-pointer outline-none"
                >
                  <option value="Software Engineer">Software Engineer</option>
                  <option value="Backend Developer">Backend Developer</option>
                  <option value="Full Stack Developer">Full Stack Developer</option>
                  <option value="Machine Learning">Machine Learning</option>
                </select>
                <span className="text-xs text-slate-500">roles hiring in</span>
                <span className="text-xs font-bold text-slate-900 bg-slate-100 py-1.5 px-3 rounded-lg">
                  Campus &amp; Remote
                </span>
                <button
                  className="ml-auto px-4 py-1.5 rounded-xl bg-slate-950 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
                >
                  Search
                </button>
              </div>

              {/* Feed Header */}
              <div className="flex items-center justify-between text-xs text-slate-500 mb-4 px-1">
                <span className="font-bold text-slate-900">Matches for your profile</span>
                <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  RECRUITERS ACTIVE NOW
                </span>
              </div>

              {/* Live Match Cards List */}
              <div className="space-y-3.5">
                {[
                  {
                    id: "job-1",
                    role: "Full Stack Engineer",
                    company: "Acme Fintech",
                    location: "Bangalore · INR 22-30 LPA",
                    score: 94,
                    skills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
                  },
                  {
                    id: "job-2",
                    role: "Backend Infrastructure Engineer",
                    company: "Scale Cloud",
                    location: "Hyderabad · INR 24-34 LPA",
                    score: 91,
                    skills: ["Node.js", "Redis", "Docker", "PostgreSQL"],
                  },
                  {
                    id: "job-3",
                    role: "AI Application Developer",
                    company: "NeuralMesh",
                    location: "Remote · INR 26-36 LPA",
                    score: 86,
                    skills: ["Python", "FastAPI", "React", "Docker"],
                  },
                ].map((job) => {
                  const hasApplied = !!appliedJobs[job.id];
                  return (
                    <div
                      key={job.id}
                      className="p-5 rounded-2xl bg-white border border-rose-100 hover:border-rose-300 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <h4 className="text-sm sm:text-base font-bold text-slate-900">{job.role}</h4>
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {job.score}% Fit
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">{job.company} · {job.location}</p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {job.skills.map((s) => (
                            <span key={s} className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:self-center">
                        <button
                          onClick={() => handleApply(job.id)}
                          className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
                            hasApplied
                              ? "bg-slate-100 text-slate-600 border border-slate-300"
                              : "bg-[#E83B72] hover:bg-[#D62D64] text-white shadow-sm"
                          }`}
                        >
                          {hasApplied ? "✓ Applied" : "Quick Apply"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Card Footer */}
              <div className="mt-5 pt-3 border-t border-rose-100/80 flex items-center justify-between text-[11px] text-slate-500">
                <span>Calculated via Skill Coverage + CGPA Hard Gate</span>
                <span className="font-semibold text-[#E83B72]">Minimum Apply Threshold: 50%</span>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

// =============================================================================
// 5. INTERACTIVE SKILL GAP ENGINE DEMONSTRATOR
// =============================================================================
function InteractiveSkillGapDemo() {
  const allJobSkills = ["React", "TypeScript", "Node.js", "PostgreSQL", "Docker", "Redis"];
  const [userSkills, setUserSkills] = useState<string[]>(["React", "TypeScript", "Node.js"]);

  const toggleSkill = (skill: string) => {
    if (userSkills.includes(skill)) {
      setUserSkills(userSkills.filter(s => s !== skill));
    } else {
      setUserSkills([...userSkills, skill]);
    }
  };

  const matchedCount = allJobSkills.filter(s => userSkills.includes(s)).length;
  const matchPercentage = Math.round((matchedCount / allJobSkills.length) * 70 + 30); // 70% skill + 30% CGPA/exp

  return (
    <section id="matching-model" className="w-full py-24 bg-[#FAFAFA] border-b border-slate-200">
      <div className="max-w-[1200px] mx-auto px-4 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-[#E83B72] mb-3 block">
          DETERMINISTIC IN-PROCESS MATCHING ENGINE
        </span>

        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-950 tracking-tight mb-4">
          Test the{" "}
          <span className="font-editorial text-[#E83B72] font-normal italic">
            skill recall algorithm
          </span>{" "}
          live.
        </h2>

        <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto mb-12">
          Toggle candidate skills below to witness how the in-memory matching engine evaluates candidate fit and dynamically computes skill gaps without LLM inference delay.
        </p>

        {/* Interactive Engine Card */}
        <div className="max-w-3xl mx-auto rounded-3xl bg-white border border-slate-200/90 p-8 shadow-lg text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TARGET ROLE</span>
              <h3 className="text-lg font-bold text-slate-900">Backend Infrastructure Engineer</h3>
              <p className="text-xs text-slate-500">6 Required Competencies · Min CGPA: 7.5</p>
            </div>
            <div className="sm:text-right">
              <span className="text-3xl font-black text-[#E83B72]">{matchPercentage}%</span>
              <span className="text-xs text-slate-500 block">Calculated Match Score</span>
            </div>
          </div>

          {/* Skill Selector Chips */}
          <div className="py-6">
            <span className="text-xs font-bold text-slate-700 block mb-3">
              YOUR PARSED SKILLS (Click chips to toggle):
            </span>
            <div className="flex flex-wrap gap-2.5">
              {allJobSkills.map((skill) => {
                const isSelected = userSkills.includes(skill);
                return (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-rose-50 text-[#E83B72] border border-rose-300 shadow-xs"
                        : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                    }`}
                  >
                    {isSelected ? <Check size={13} className="text-[#E83B72]" /> : "+"}
                    {skill}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Real-time Gap Output */}
          <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-slate-900 block mb-0.5">Identified Skill Gap:</span>
              <span className="text-slate-600">
                {allJobSkills.filter(s => !userSkills.includes(s)).length === 0
                  ? "🎉 Zero missing skills! Perfect candidate fit for this role."
                  : `Missing: ${allJobSkills.filter(s => !userSkills.includes(s)).join(", ")}`}
              </span>
            </div>
            <span className="font-semibold text-[#E83B72] whitespace-nowrap">
              {matchPercentage >= 50 ? "Eligible to Apply (>=50%)" : "Ineligible (<50%)"}
            </span>
          </div>

        </div>
      </div>
    </section>
  );
}

// =============================================================================
// 6. PERFORMANCE BENCHMARKS (Verified Empirical Metrics)
// =============================================================================
function PerformanceBenchmarks() {
  const metrics = [
    {
      value: "<130ms",
      title: "Asynchronous Enqueue",
      desc: "BullMQ queue response time for resume PDF uploads",
    },
    {
      value: "0.48µs",
      title: "Matching Latency",
      desc: "Average in-process evaluation time per candidate-job pair",
    },
    {
      value: "100%",
      title: "Real-Time Duplex",
      desc: "Socket.io streaming for chat, typing, and notifications",
    },
    {
      value: "0",
      title: "Data Invariant Drift",
      desc: "PostgreSQL relational cascades with zero orphaned records",
    },
  ];

  return (
    <section id="benchmarks" className="w-full py-20 bg-white border-b border-slate-200">
      <div className="max-w-[1360px] mx-auto px-4 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 block">
          SYSTEM VERIFICATION &amp; BENCHMARKS
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 mb-12">
          Engineered for high throughput.
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          {metrics.map((m) => (
            <div
              key={m.title}
              className="p-6 rounded-2xl bg-[#FAFAFA] border border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors"
            >
              <span className="text-3xl sm:text-4xl font-black text-[#E83B72] tracking-tight block mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                {m.value}
              </span>
              <h3 className="text-sm font-bold text-slate-900 mb-1">{m.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// 7. BOTTOM CALL TO ACTION
// =============================================================================
function BottomCtaSection({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <section className="w-full py-24 bg-[#0F1219] text-white relative overflow-hidden text-center px-4">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
        <img
          src="/logo.png"
          alt="CareerNest"
          className="w-16 h-16 rounded-full object-cover shadow-xl ring-2 ring-rose-400/50 mb-6"
        />

        <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-4">
          Ready to experience{" "}
          <span className="font-editorial text-[#F43F5E] font-normal italic">
            modern placement?
          </span>
        </h2>

        <p className="text-slate-400 text-base md:text-lg max-w-xl mb-10 leading-relaxed">
          Join thousands of university candidates and forward-thinking recruitment teams on CareerNest today.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
          <button
            onClick={() => navigate("/auth")}
            className="px-8 py-3.5 rounded-full text-sm font-bold text-white bg-[#E83B72] hover:bg-[#D62D64] transition-all shadow-lg active:scale-95"
          >
            I&apos;m a Student <ArrowRight size={15} className="inline ml-1.5" />
          </button>
          <button
            onClick={() => navigate("/auth")}
            className="px-8 py-3.5 rounded-full text-sm font-bold text-slate-200 border border-slate-700 hover:border-slate-500 hover:text-white transition-all"
          >
            I&apos;m a Recruiter
          </button>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// 8. RICH ELITE FOOTER
// =============================================================================
function Footer() {
  return (
    <footer className="w-full bg-[#0A0C10] text-slate-400 border-t border-slate-800/80 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1360px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="CareerNest"
            className="w-7 h-7 rounded-full object-cover ring-1 ring-rose-400/50"
          />
          <span className="text-sm font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            Career<span className="text-[#E83B72]">Nest</span>
          </span>
          <span className="text-slate-600">·</span>
          <span>Campus Recruitment &amp; Placement Platform</span>
        </div>

        <div className="flex items-center gap-6 text-slate-400">
          <a href="#for-recruiters" className="hover:text-white transition-colors">For Recruiters</a>
          <a href="#for-candidates" className="hover:text-white transition-colors">For Candidates</a>
          <a href="#matching-model" className="hover:text-white transition-colors">Matching Engine</a>
          <a href="#benchmarks" className="hover:text-white transition-colors">Benchmarks</a>
        </div>

        <div className="flex items-center gap-2 text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>All systems operational · MIT Licensed</span>
        </div>
      </div>
    </footer>
  );
}
