<div align="center">



# CareerNest

**Next-Generation AI-Powered Campus Placement & Recruitment Platform**

[![Build](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square&logo=github-actions)](https://github.com)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Redis](https://img.shields.io/badge/Redis-Upstash-DC382D?style=flat-square&logo=redis&logoColor=white)](https://upstash.com)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

*CareerNest eliminates the inefficiency of manual campus placements. It leverages Google Gemini AI for zero-manual-entry resume parsing and a proprietary O(1) Hybrid Matching Engine (Jaccard similarity + hard filters) to rank candidates against job postings in real time — with zero LLM cost on every page load.*

[Live Demo](#) · [Report a Bug](https://github.com) · [Request Feature](https://github.com)

</div>

---

## 📸 Visual Tour

| | |
|:---:|:---:|
| ![Landing Page](screenshots/landing.png) <br /> **Landing Page** — Clean hero with feature trust strip | ![Auth Page](screenshots/auth-login.png) <br /> **Authentication** — Role-aware login & registration |
| ![Student Dashboard](screenshots/student-dashboard.png) <br /> **Student Dashboard** — AI job matches & skill gap | ![Recruiter Dashboard](screenshots/recruiter-dashboard.png) <br /> **Recruiter Dashboard** — Post jobs & track applicants |
| ![Skill Gap](screenshots/student-dashboard-bottom.png) <br /> **Skill Gap Analysis** — Zero-token actionable advice | ![Admin Panel](screenshots/admin-dashboard.png) <br /> **Admin Panel** — Platform governance & stats |

---

## 🚀 Core Features

### 👥 Multi-Role Ecosystem

| Role | Capabilities |
|:---|:---|
| **Student** | Upload resume → AI parses skills/CGPA/experience → View ranked job matches → Receive zero-cost skill-gap advice |
| **Recruiter** | Post jobs in natural language → AI extracts structured criteria → View ranked applicant list with match scores → Update application status |
| **Admin / Placement Cell** | Platform-wide statistics dashboard → User management → Delete inappropriate postings or profiles |

### 🧠 AI-Powered Resume Parsing Pipeline

```
PDF Upload → Cloudinary CDN → pdf-parse (text extraction) → Google Gemini API
         (Controlled Generation with JSON Schema)
         → Structured { skills[], cgpa, experienceYears } → MongoDB
```

- Uses Gemini **Controlled Generation** (JSON schema enforcement) to extract perfectly structured data from unstructured PDF text
- **Zero manual entry** — students upload once, the system profiles them automatically
- `USE_MOCK_LLM=true` flag for local dev that bypasses real API calls

### ⚡ Hybrid O(1) Matching Engine

The core scoring algorithm runs **entirely in-process** — zero external API calls:

```
Final Score = (0.7 × Jaccard Skill Similarity) + (0.3 × Proportional Hard Filters)

Jaccard(A, B) = |A ∩ B| / |A ∪ B|   where A = student skills, B = job required skills
Hard Filters  = normalized(CGPA score) + normalized(Experience score)
```

- Hard filters (CGPA, experience) eliminate ineligible students *before* any scoring
- Results cached in **Redis** (Upstash) for sub-millisecond subsequent reads

### 💡 Zero-Token Skill Gap Advisor

- Local set-difference: `missingSkills = jobRequiredSkills - studentParsedSkills`
- Generates dynamic, actionable "build a project in X" tips — **completely free**, no generative AI cost
- Updates automatically as students upload new resumes

### 🔒 Security & Reliability

- **JWT-based stateless auth** with strict role isolation (`STUDENT` | `RECRUITER` | `ADMIN`)
- **bcrypt** (12 rounds) with constant-time dummy-hash comparison to prevent timing attacks
- **Helmet.js** for HTTP security headers; **express-rate-limit** on all routes
- **Admin Secret** passphrase required for admin account registration

---

## 🏗️ Tech Stack

| Layer | Technology | Purpose |
|:---|:---|:---|
| **Frontend** | React 19, Vite, TypeScript | UI framework & build tooling |
| **Styling** | Tailwind CSS v3, Lucide React | Utility-first design system |
| **State** | Zustand | Lightweight client state management |
| **HTTP** | Axios, React Router v6 | API client & client-side routing |
| **Backend** | Node.js v20, Express.js, TypeScript | REST API server |
| **ORM** | Prisma v6 (MongoDB driver) | Type-safe database access |
| **Database** | MongoDB Atlas (Free M0) | Primary document store |
| **Cache** | Redis via Upstash (TLS) | Route-level caching & invalidation |
| **AI / LLM** | Google Gemini 2.0 Flash | Resume parsing & skill extraction |
| **Storage** | Cloudinary | PDF resume CDN & streaming |
| **Email** | Nodemailer (SMTP / Gmail) | Application status notifications |
| **Auth** | JWT + bcryptjs | Stateless authentication |
| **Security** | Helmet, express-rate-limit | HTTP hardening & DDoS mitigation |

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (React 19)                    │
│  Zustand Store ──► Axios (JWT headers) ──► Vite Dev Server  │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/REST
┌───────────────────────────▼─────────────────────────────────┐
│                   EXPRESS.JS API (Port 5000)                 │
│                                                             │
│  Helmet ──► Rate Limiter ──► JWT Middleware ──► Role Guard  │
│                                    │                        │
│          ┌─────────────────────────▼──────────────┐         │
│          │  auth | student | job | eligibility     │         │
│          └──────────────┬──────────────────────────┘         │
│                         │                                   │
│        ┌────────────────▼────────────────────┐              │
│        │  llm.service  │  matcher.service    │              │
│        └────┬──────────────────────┬─────────┘              │
│             │                      │                        │
│    ┌────────▼──────┐    ┌──────────▼───────┐                │
│    │  Gemini API   │    │  Jaccard Engine  │                │
│    │  Cloudinary   │    │  (in-process)    │                │
│    └───────────────┘    └──────────────────┘                │
│  ┌───────────────────────┐   ┌────────────────────────┐     │
│  │   Prisma ORM          │   │   Redis (Upstash)      │     │
│  │   MongoDB Atlas       │   │   Cache + Invalidation │     │
│  └───────────────────────┘   └────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Project Structure

```
career-nest/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # User, StudentProfile, RecruiterProfile, Job, Application
│   ├── src/
│   │   ├── config/
│   │   │   ├── prismaClient.ts    # Singleton (prevents hot-reload connection leaks)
│   │   │   └── redisClient.ts     # Upstash TLS Redis client
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts        # Register + Login (bcrypt & JWT)
│   │   │   ├── student.controller.ts     # Resume upload → Cloudinary → Gemini parse
│   │   │   ├── job.controller.ts         # Job CRUD + AI criteria extraction
│   │   │   └── eligibility.controller.ts # Jaccard scoring + skill gap
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts    # JWT verification
│   │   │   ├── role.middleware.ts    # Role-based access control
│   │   │   ├── multer.middleware.ts  # PDF file upload handling
│   │   │   └── rateLimiter.ts       # Global rate limiting
│   │   ├── routes/                  # auth | student | job | eligibility
│   │   ├── services/
│   │   │   ├── llm.service.ts       # 🧠 Gemini PDF parsing pipeline
│   │   │   └── matcher.service.ts   # ⚡ Hybrid Jaccard scoring engine
│   │   ├── utils/ & types/
│   │   ├── app.ts                   # Express setup, middleware, route mounting
│   │   └── server.ts                # HTTP server entry point
│   ├── .env                         # Secrets (never commit)
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Layout.tsx           # Global navbar + outlet wrapper
    │   │   └── ProtectedRoute.tsx   # Role-guard HOC
    │   ├── pages/
    │   │   ├── Landing.tsx          # Public hero page
    │   │   ├── Auth.tsx             # Login + Register (role-aware form)
    │   │   ├── student/Dashboard.tsx    # 🎯 AI matches + skill gap analysis
    │   │   ├── recruiter/Dashboard.tsx  # 📊 Job posting + applicant tracking
    │   │   └── admin/Dashboard.tsx      # 🛡️ Platform stats + governance
    │   ├── store/authStore.ts       # Zustand auth state + persistence
    │   └── App.tsx                  # BrowserRouter + role-based routing
    ├── tailwind.config.js
    ├── vite.config.ts
    └── package.json
```

---

## 🔐 Environment Variables

Create `backend/.env` with the following. **Never commit real secrets to Git.**

| Variable | Description | Required |
|:---|:---|:---:|
| `PORT` | Backend port (default: `5000`) | ✅ |
| `DATABASE_URL` | MongoDB Atlas URI — **must include database name** (`.../careernest?...`) | ✅ |
| `REDIS_URL` | Upstash Redis TLS URL (`rediss://...`) | ✅ |
| `JWT_SECRET` | Secret for signing JWTs | ✅ |
| `JWT_EXPIRES_IN` | Token expiry e.g. `7d` | ✅ |
| `GEMINI_API_KEY` | Google AI Studio key | ✅ |
| `ADMIN_SECRET` | Passphrase for Admin registration | ✅ |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | ✅ |
| `CLOUDINARY_API_KEY` | Cloudinary API key | ✅ |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | ✅ |
| `SMTP_HOST` / `SMTP_PORT` | SMTP server e.g. `smtp.gmail.com` / `587` | Optional |
| `SMTP_USER` / `SMTP_PASS` | SMTP credentials (Gmail App Password recommended) | Optional |
| `USE_MOCK_LLM` | `true` to skip Gemini calls in local dev | Optional |

> **Important:** Your `DATABASE_URL` must include the database name in the URI path:
> `mongodb://user:pass@host1,host2,host3/`**`careernest`**`?replicaSet=...`
> Omitting the database name causes an Atlas `Error 8000: empty database name not allowed`.

---

## 🛠️ Local Development Setup

### Prerequisites

- **Node.js** v20+  &  **npm** v9+
- [MongoDB Atlas](https://www.mongodb.com/atlas) — Free M0 cluster
- [Upstash Redis](https://upstash.com) — Free tier
- [Google AI Studio](https://aistudio.google.com/app/apikey) — Free API key (1,500 req/day)
- [Cloudinary](https://cloudinary.com) — Free account

### 1. Clone

```bash
git clone https://github.com/yourusername/career-nest.git
cd career-nest
```

### 2. Backend Setup

```bash
cd backend
npm install
# Create .env and fill in all required variables (see table above)
npx prisma generate
npm run dev
# → Server: http://localhost:5000
```

### 3. Frontend Setup

```bash
# Open a new terminal
cd frontend
npm install
npm run dev
# → App: http://localhost:5173
```

### 4. Health Check

```bash
curl http://localhost:5000/api/health
# {"status":"ok","message":"API is healthy"}
```

### Demo Accounts

Register via `http://localhost:5173/auth`:

| Role | Registration Notes |
|:---|:---|
| **Student** | Select "Student" role → fill First/Last name, College, CGPA |
| **Recruiter** | Select "Recruiter" role → fill Company name, Designation |
| **Admin** | Select "Admin" role → enter the `ADMIN_SECRET` value from your `.env` |

---

## 📡 API Reference

All protected routes require `Authorization: Bearer <token>`.

| Method | Endpoint | Description | Auth |
|:---:|:---|:---|:---|
| `GET` | `/api/health` | Server health check | Public |
| `POST` | `/api/auth/register` | Create user + provision role profile | Public |
| `POST` | `/api/auth/login` | Authenticate, receive JWT | Public |
| `POST` | `/api/student/resume` | Upload PDF → Cloudinary → Gemini → DB | `STUDENT` |
| `GET` | `/api/student/profile` | Fetch own parsed profile | `STUDENT` |
| `POST` | `/api/jobs` | Create job posting (AI extracts criteria) | `RECRUITER` |
| `GET` | `/api/jobs` | List active jobs (Redis cached) | `STUDENT` |
| `GET` | `/api/jobs/my-postings` | Recruiter's own listings | `RECRUITER` |
| `GET` | `/api/jobs/:jobId/applicants` | Applicants ranked by match score | `RECRUITER` / `ADMIN` |
| `PATCH` | `/api/jobs/:jobId/status` | Toggle job active/inactive | `RECRUITER` |
| `GET` | `/api/eligibility/matches` | Jaccard-scored job feed | `STUDENT` |
| `POST` | `/api/eligibility/apply/:jobId` | Apply to job (persists matchScore) | `STUDENT` |

---

## 🔭 Roadmap & Upcoming Improvements

### Infrastructure & Scalability
- **RabbitMQ / BullMQ Message Queue** — Offload resume parsing, email delivery, and match recomputation to background workers, fully decoupling them from synchronous HTTP requests for production-grade reliability
- **AWS S3 Bucket Storage** — Replace Cloudinary with S3 for enterprise-grade durability, lifecycle policies, and lower egress costs at scale
- **Docker + Docker Compose** — One-command local setup and environment parity across dev and production

### Authentication & User Experience
- **OAuth 2.0 / Google Sign-In** — One-click social login for students and recruiters via Google, eliminating password friction at registration
- **Recruiter-Built Application Forms** — Recruiters can design and publish custom forms (role-specific questions, assessments) that students fill out within the platform, replacing fragmented external tools like Google Forms
- **Real-time WebSocket Notifications** — Instant alerts on application status changes (Shortlisted / Rejected) without polling

### AI & Matching Intelligence
- **MongoDB Atlas Vector Search** — Replace string-array Jaccard with semantic vector embeddings for fuzzy skill matching ("ReactJS" ↔ "React.js" ↔ "React")
- **LLM Interview Prep** — AI-generated role-specific interview questions and feedback based on each student's skill gap
- **Batch Resume Processing** — Admin-triggered bulk parsing via a queue-backed worker pipeline

### Platform & Analytics
- **Placement Analytics Dashboard** — Charts for placement rates, in-demand skills, recruiter activity, and time-to-hire
- **Multi-Campus Support** — Tenant-aware architecture for multiple universities on one deployment
- **In-Platform Resume Builder** — AI-assisted resume creator auto-populated from the student's parsed profile

---

## 🤝 Contributing

1. **Fork** the repository
2. **Branch**: `git checkout -b feature/your-feature`
3. **Commit**: `git commit -m 'feat: your change'`
4. **Push**: `git push origin feature/your-feature`
5. **Open a Pull Request** against `main`

Follow TypeScript strict mode and ESLint rules. Tests for new features are appreciated.

---

## 📄 License

MIT License — see [`LICENSE`](LICENSE) for details.

---

<div align="center">
  <p>Built with ❤️ for modern software engineering placements.</p>
</div>
