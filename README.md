<div align="center">

# 🪺 CareerNest

**Next-Generation AI-Powered Campus Recruitment & Placement Platform**

[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Prisma ORM](https://img.shields.io/badge/Prisma-6.x-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io)
[![Redis](https://img.shields.io/badge/Redis-Upstash-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://upstash.com)
[![BullMQ](https://img.shields.io/badge/BullMQ-Worker_Queue-FF4F81?style=for-the-badge&logo=redis&logoColor=white)](https://bullmq.io)
[![Socket.io](https://img.shields.io/badge/Socket.io-Realtime_Engine-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Gemini AI](https://img.shields.io/badge/Google_Gemini-2.0_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

<br />

*CareerNest revolutionizes campus recruitment by replacing slow, manual placement drives with asynchronous queue workers, deterministic O(1) matching algorithms, structured AI schema parsing, and a full-duplex real-time communication mesh.*

<p align="center">
  <a href="#-system-architecture">Architecture</a> •
  <a href="#-key-capabilities">Capabilities</a> •
  <a href="#-real-time-websocket-engine">WebSockets</a> •
  <a href="#-database-schema--erd">Data Model</a> •
  <a href="#-api-reference">REST APIs</a> •
  <a href="#-local-development-setup">Setup Guide</a>
</p>

</div>

---

## 📸 Visual Tour

| | |
|:---:|:---:|
| ![Landing Page](screenshots/landing.png) <br /> **Executive Landing** — Modern hero, live trust strip, & role access | ![Auth Page](screenshots/auth-login.png) <br /> **Authentication** — Dual-mode login & OAuth 2.0 social sync |
| ![Student Dashboard](screenshots/student-dashboard.png) <br /> **Candidate Terminal** — Ranked job feed, real-time alerts | ![Recruiter Dashboard](screenshots/recruiter-dashboard.png) <br /> **Recruiter Command Center** — Dynamic job creation & applicant ranks |
| ![Skill Gap Analysis](screenshots/student-dashboard-bottom.png) <br /> **Zero-Token Skill Advisor** — Instant project roadmaps | ![Admin Panel](screenshots/admin-dashboard.png) <br /> **Placement Governance** — Institutional metrics & candidate oversight |

---

## ⚡ Architecture Highlights

```mermaid
flowchart TB
    subgraph ClientLayer["🖥️ Frontend Client (React 19 + TypeScript + Zustand)"]
        UI["Modern Responsive UI\n(Tailwind CSS + Lucide)"]
        Store["State Layer\n(useAuthStore + useChatStore)"]
        SocketClient["Socket.io Client\n(Auto-reconnect + Heartbeat)"]
        Audio["Web Audio API\n(Synthesized Chimes)"]
    end

    subgraph GatewayLayer["🚪 API & Real-Time Gateway (Node.js + Express)"]
        HTTPGateway["Express REST Gateway\n(RateLimiter + Helmet + JWT Guard)"]
        SocketGateway["Socket.io Server Engine\n(Multi-tenant Room Mesh + Presence)"]
    end

    subgraph ProcessingLayer["⚙️ Processing & Asynchronous Workers"]
        BullWorker["BullMQ Worker Concurrency (x5)\n(resumeParser.worker.ts)"]
        JaccardEngine["Hybrid Jaccard Matcher\n(O(1) In-Memory Evaluation)"]
    end

    subgraph StorageLayer["💾 Storage & Persistence Mesh"]
        Postgres[(PostgreSQL Primary DB\nRelational Schema via Prisma ORM)]
        RedisCache[(Redis Cache & BullMQ Queue\nUpstash / Local TLS)]
        CloudinaryCDN[("Cloudinary CDN\n(PDF Raw Storage)")]
    end

    subgraph ExternalIntelligence["🧠 External Cognitive Services"]
        Gemini["Google Gemini 2.0 Flash\n(JSON Schema Controlled Generation)"]
        Nodemailer["SMTP Transactional Mailer\n(Application Alerts)"]
    end

    %% Client Interactions
    UI --> Store
    Store --> HTTPGateway
    UI --> SocketClient
    SocketClient <--> SocketGateway
    SocketClient --> Audio

    %% Gateway Routing
    HTTPGateway --> Postgres
    HTTPGateway --> RedisCache
    HTTPGateway --> BullWorker
    HTTPGateway --> JaccardEngine

    %% Worker Pipeline
    BullWorker --> CloudinaryCDN
    BullWorker --> Gemini
    BullWorker --> Postgres
    BullWorker -.->|"Emits (resume:parsed)"| SocketGateway

    %% Live Events & Mail
    HTTPGateway -.->|"Push Alerts & Messages"| SocketGateway
    HTTPGateway -.->|"Async Fire-and-Forget"| Nodemailer
```

---

## 🌟 Key Capabilities

### 1. 📬 Asynchronous Resume Ingestion (BullMQ + Redis)
- **Zero Request-Blocking**: Resume PDF uploads return HTTP `202 Accepted` in `<150ms`.
- **Decoupled Worker Processing**: A dedicated BullMQ background worker downloads the binary stream from Cloudinary, extracts text via `pdf-parse`, and runs Google Gemini 2.0 Flash with deterministic JSON schema enforcement.
- **Instant Reactive Updates**: When parsing finishes, the worker pushes a `resume:parsed` event over WebSockets to the student's active session, instantly rendering skills without manual page refreshes.

### 2. 🗄️ Relational Data Layer (PostgreSQL + Prisma ORM)
- **Strict Referential Integrity**: Migrated from document-based storage to PostgreSQL with foreign key constraints, cascading deletes, and unique compound constraints (e.g. `[studentId, jobId]` uniqueness prevents double application submission).
- **Relational Messaging Structure**: Clean 1-to-1 conversation channels linking applicants and recruiters with full cascading delete capabilities on parent job deletion.

### 3. 💬 1-on-1 Real-Time Live Chat Drawer
- **Role-Gated Messaging**: Direct communication activates as soon as a student applies or is shortlisted for a role.
- **MAANG-Grade Real-Time UX**:
  - **Presence Indicators**: Live green pulse when the other party is online in the room.
  - **Typing Wave Animation**: Real-time typing indicators relaying keystrokes with debounced timeouts.
  - **Read Receipts**: Blue double checkmarks (`✓✓`) triggered automatically when recipient views messages.
  - **Optimistic UI Updates**: Outbound messages appear instantly with single checkmarks (`✓`) prior to database ACK.
  - **Auto-Linked URLs & Emojis**: One-click quick response chips, emoji picker, and clickable markdown hyperlinks.

### 4. 🔔 In-App Notification Center & Acoustic Synthesis
- **Centralized Alert Center**: Bell popover tracking status changes (`SHORTLISTED`, `REJECTED`), new candidate arrivals, and direct chat pings.
- **Zero External Audio Assets**: Generates clean two-tone synthesized acoustic chimes ($587.33\text{ Hz} \to 880\text{ Hz}$) dynamically via the browser's native **Web Audio API** — avoiding external MP3 dependencies or 404 failures.
- **Interactive Management**: Unread filtering tab, single-item dismissal, and batch mark-all-as-read.

### 5. ⚡ Deterministic O(1) Hybrid Matcher & Zero-Token Advisor
- **Two-Tier Scoring Pipeline**:
  $$\text{Score} = (0.7 \times \text{Jaccard Skill Similarity}) + (0.3 \times \text{Normalized Hard Filters})$$
- **Zero LLM Token Incurrence on Page Load**: Evaluates candidate suitability purely in-memory using set intersection and union over pre-parsed skill vectors.
- **Dynamic Skill Gap Engine**: Performs set-subtraction ($\text{Skills}_{\text{Job}} \setminus \text{Skills}_{\text{Student}}$) to provide actionable, step-by-step project suggestions free of generative inference costs.

---

## 📡 Real-Time WebSocket Engine

The platform coordinates real-time state using a multi-tenant room architecture.

### Room Scoping Model

| Room Target | Pattern | Access Constraint | Purpose |
|:---|:---|:---|:---|
| **User Room** | `user:<userId>` | Authenticated user session | In-app alerts, background parser completion, direct notifications |
| **Conversation Room** | `conversation:<convId>` | Recruiter & Student of the application | Bi-directional 1-on-1 live chat, typing waves, read receipts |

### Socket.io Event Contract

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          SOCKET.IO EVENT CONTRACT                         │
└───────────────────────────────────────────────────────────────────────────┘
```

| Event Name | Direction | Payload Contract | Description |
|:---|:---:|:---|:---|
| `join:conversation` | Client ➔ Server | `{ conversationId: string }` | Enters a private chat channel; broadcasts online status. |
| `leave:conversation` | Client ➔ Server | `{ conversationId: string }` | Exits a private chat channel; broadcasts offline status. |
| `typing:start` | Client ➔ Server | `{ conversationId: string }` | Relays typing active indicator to other room participant. |
| `typing:stop` | Client ➔ Server | `{ conversationId: string }` | Relays typing inactive indicator. |
| `message:read` | Client ➔ Server | `{ conversationId: string, readerId: string }` | Triggers double-checkmark (`✓✓`) read receipts for all unread items. |
| `message:received` | Server ➔ Client | `ChatMessage & { sender: ChatSender }` | Delivers persisted message in real time to the channel. |
| `message:read_receipt` | Server ➔ Client | `{ conversationId: string, readBy: string, readAt: string }` | Updates UI message badges from single to double checkmark. |
| `user:status` | Server ➔ Client | `{ userId: string, isOnline: boolean }` | Notifies active drawer of participant's connectivity state. |
| `resume:parsed` | Server ➔ Client | `{ skills: string[], cgpa: number, experienceYears: number }` | Pushed by BullMQ background worker on parsing completion. |
| `resume:parse-failed` | Server ➔ Client | `{ message: string }` | Pushed by BullMQ worker if PDF extraction or LLM fails. |
| `application:status_changed`| Server ➔ Client | `{ applicationId: string, status: string, jobTitle: string }` | Notifies student live when their application is Shortlisted/Rejected. |
| `recruiter:new_applicant` | Server ➔ Client | `{ jobId: string, studentName: string, matchScore: number }` | Notifies recruiter in real time when a candidate applies. |
| `notification:new` | Server ➔ Client | `AppNotification` | Real-time push to the user's notification bell popover. |

---

## 🗄️ Database Schema & ERD

CareerNest utilizes **PostgreSQL** configured via **Prisma ORM** with indexes on foreign keys and frequently queried status fields.

```mermaid
erDiagram
    User ||--o| StudentProfile : "has"
    User ||--o| RecruiterProfile : "has"
    User ||--o{ Job : "creates (as recruiter)"
    User ||--o{ ChatMessage : "sends"
    User ||--o{ Notification : "receives"

    Job ||--o{ Application : "receives"
    StudentProfile ||--o{ Application : "submits"
    
    Application ||--o| Conversation : "initiates"
    Conversation ||--o{ ChatMessage : "contains"

    User {
        string id PK
        string email UK
        string passwordHash
        enum role "STUDENT | RECRUITER | ADMIN"
        datetime createdAt
    }

    StudentProfile {
        string id PK
        string userId FK,UK
        string firstName
        string lastName
        string college
        float cgpa
        float experienceYears
        string resumeUrl
        string[] parsedSkills
    }

    RecruiterProfile {
        string id PK
        string userId FK,UK
        string companyName
        string designation
    }

    Job {
        string id PK
        string recruiterId FK
        string title
        string description
        string[] requiredSkills
        float minCgpa
        float minExperience
        boolean isActive
        datetime createdAt
    }

    Application {
        string id PK
        string studentId FK
        string jobId FK
        float matchScore
        enum status "PENDING | SHORTLISTED | REJECTED"
        datetime appliedAt
    }

    Conversation {
        string id PK
        string applicationId FK,UK
        string recruiterId FK
        string studentId FK
        datetime createdAt
        datetime updatedAt
    }

    ChatMessage {
        string id PK
        string conversationId FK
        string senderId FK
        string content
        boolean isRead
        datetime readAt
        datetime createdAt
    }

    Notification {
        string id PK
        string userId FK
        enum type "SHORTLISTED | REJECTED | APPLICATION | CHAT"
        string title
        string message
        string linkUrl
        boolean isRead
        datetime createdAt
    }
```

---

## 📚 REST API Reference

All protected routes require an `Authorization: Bearer <token>` HTTP header.

### 🔐 Authentication & Session
| Method | Endpoint | Access | Description |
|:---:|:---|:---:|:---|
| `POST` | `/api/auth/register` | Public | Registers a new user and auto-provisions role profile. |
| `POST` | `/api/auth/login` | Public | Validates credentials (with dummy hash timing protection); returns JWT. |
| `GET` | `/api/auth/google` | Public | Initiates Google OAuth 2.0 social authentication flow. |
| `GET` | `/api/auth/google/callback` | Public | Passport callback redirecting to client with signed credentials. |
| `POST` | `/api/auth/setup-role` | Public | Finishes initial profile creation for OAuth first-time accounts. |

### 🎓 Candidate & Profile
| Method | Endpoint | Access | Description |
|:---:|:---|:---:|:---|
| `GET` | `/api/student/profile` | Student | Fetches parsed profile details, skills, and current resume URL. |
| `PUT` | `/api/student/profile` | Student | Updates student details (college, CGPA, experience). |
| `POST` | `/api/student/resume` | Student | Multer ➔ Cloudinary upload; enqueues parsing job in BullMQ (HTTP 202). |
| `GET` | `/api/student/recruiter-profile` | Recruiter | Returns authenticated recruiter's company profile. |
| `PUT` | `/api/student/recruiter-profile` | Recruiter | Updates company name and title. |

### 💼 Jobs & Recruitment Management
| Method | Endpoint | Access | Description |
|:---:|:---|:---:|:---|
| `GET` | `/api/jobs` | Authenticated | Lists all active openings (Redis cached with graceful DB fallback). |
| `POST` | `/api/jobs` | Recruiter | Creates job posting; extracts structured criteria via Gemini LLM. |
| `GET` | `/api/jobs/my-postings` | Recruiter | Fetches postings belonging strictly to the requesting recruiter. |
| `GET` | `/api/jobs/admin-stats` | Admin | Aggregate platform statistics (active jobs, candidates, placements). |
| `GET` | `/api/jobs/:jobId/applicants` | Recruiter, Admin | Returns all applicants ranked by algorithmic match score. |
| `PATCH` | `/api/jobs/:jobId/status` | Recruiter | Toggles job between active and closed. |
| `PATCH` | `/api/jobs/applications/:appId/status` | Recruiter | Updates applicant state (`SHORTLISTED` / `REJECTED`); emits live alerts. |
| `DELETE` | `/api/jobs/:id` | Recruiter, Admin | Deletes job posting with cascading relational cleanup. |

### 🎯 Match Scoring & Applications
| Method | Endpoint | Access | Description |
|:---:|:---|:---:|:---|
| `GET` | `/api/eligibility/matches` | Student | Evaluates student against all active jobs in O(1) in-memory time. |
| `POST` | `/api/eligibility/apply/:jobId` | Student | Evaluates threshold (>=40%), commits application, notifies recruiter. |

### 💬 1-on-1 Chat & Real-Time Messaging
| Method | Endpoint | Access | Description |
|:---:|:---|:---:|:---|
| `GET` | `/api/chat/conversations` | Authenticated | Lists all active 1-on-1 conversation channels with latest messages. |
| `GET` | `/api/chat/conversations/:id/messages` | Authenticated | Retrieves chronological message thread for a verified participant. |
| `POST` | `/api/chat/conversations/:id/messages` | Authenticated | Sends a message; persists to PostgreSQL and broadcasts via WebSocket. |
| `POST` | `/api/chat/application/:appId` | Authenticated | Retrieves or initializes a conversation thread for an application. |

### 🔔 In-App Notifications
| Method | Endpoint | Access | Description |
|:---:|:---|:---:|:---|
| `GET` | `/api/notifications` | Authenticated | Returns the recent 30 notifications with unread count summary. |
| `PATCH` | `/api/notifications/:id/read` | Authenticated | Marks a specific notification as read. |
| `PATCH` | `/api/notifications/read-all` | Authenticated | Marks all unread notifications for the user as read. |
| `DELETE` | `/api/notifications/:id` | Authenticated | Dismisses/removes a single notification item from the feed. |

### 🩺 System
| Method | Endpoint | Access | Description |
|:---:|:---|:---:|:---|
| `GET` | `/api/health` | Public | Liveness probe returning server status and uptime. |

---

## 🗂️ Project Structure

```
career-nest/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma              # Relational models, enums & foreign keys
│   │   └── migrations/                # Immutable SQL migration history
│   ├── src/
│   │   ├── config/
│   │   │   ├── prismaClient.ts        # Prisma ORM singleton instance
│   │   │   ├── redisClient.ts         # Upstash / Local Redis connection
│   │   │   ├── bullmq.ts              # BullMQ queue definitions
│   │   │   ├── socketServer.ts        # Socket.io gateway & room mesh
│   │   │   └── passport.ts            # Google OAuth 2.0 authentication strategy
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts            # Registration, login, JWT & OAuth callbacks
│   │   │   ├── student.controller.ts         # Profile handling & async PDF upload triggers
│   │   │   ├── job.controller.ts             # Job listings, LLM extraction & status transitions
│   │   │   ├── eligibility.controller.ts     # In-memory Jaccard scoring & application gateway
│   │   │   ├── chat.controller.ts            # 1-on-1 message threads & channel authorization
│   │   │   └── notification.controller.ts    # In-app notification center operations
│   │   ├── workers/
│   │   │   └── resumeParser.worker.ts        # BullMQ worker: PDF parse ➔ Gemini AI ➔ DB
│   │   ├── services/
│   │   │   ├── llm.service.ts         # Google Gemini 2.0 Flash JSON schema parsing
│   │   │   ├── matcher.service.ts     # Pure deterministic Jaccard matching algorithm
│   │   │   └── notification.service.ts# SMTP email dispatcher
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts     # JWT validation & user attachment
│   │   │   ├── role.middleware.ts     # Role-based access control (RBAC)
│   │   │   ├── multer.middleware.ts   # Cloudinary multipart file streaming
│   │   │   └── rateLimiter.ts         # IP-based rate limiting guardrails
│   │   ├── routes/                    # Express domain route definitions
│   │   ├── app.ts                     # Express pipeline configuration
│   │   └── server.ts                  # Server entry point, Socket.io boot & worker initialization
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Layout.tsx             # Responsive global layout, navbar & drawer mount
    │   │   ├── LiveChatDrawer.tsx     # Full-featured 1-on-1 messaging drawer
    │   │   ├── NotificationBell.tsx   # Real-time notification center popover
    │   │   ├── ProtectedRoute.tsx     # RBAC client route guard
    │   │   └── ResumeAnalyzing.tsx    # Live processing status animation
    │   ├── pages/
    │   │   ├── Landing.tsx            # High-conversion public showcase
    │   │   ├── Auth.tsx               # Unified login / registration forms
    │   │   ├── student/Dashboard.tsx  # Match feed, skill-gap advisor & application history
    │   │   ├── recruiter/Dashboard.tsx# Dynamic job creation, applicant ranking & status manager
    │   │   └── admin/Dashboard.tsx    # System overview & platform metrics
    │   ├── store/
    │   │   ├── authStore.ts           # Client session & JWT persistence
    │   │   └── chatStore.ts           # Centralized chat drawer state
    │   ├── lib/
    │   │   ├── axios.ts               # Axios interceptor attaching Bearer tokens
    │   │   └── socket.ts              # Socket.io client wrapper & singleton connection
    │   ├── App.tsx                    # React router routes & role routing
    │   └── main.tsx                   # React 19 entry point
    ├── tailwind.config.js
    ├── vite.config.ts
    └── package.json
```

---

## 🔐 Environment Variables

Create a `.env` file in `career-nest/backend/.env`:

| Key | Description | Example / Default | Required |
|:---|:---|:---|:---:|
| `PORT` | Node.js backend port | `5000` | ✅ |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://postgres:password@localhost:5432/careernest` | ✅ |
| `REDIS_URL` | Redis URL for caching & BullMQ queues | `redis://localhost:6379` or `rediss://...` | ✅ |
| `JWT_SECRET` | Secret key used for signing JWT tokens | `your_super_secret_jwt_key` | ✅ |
| `JWT_EXPIRES_IN` | Token duration | `7d` | ✅ |
| `GEMINI_API_KEY` | Google AI Studio API key | `AIzaSy...` | ✅ |
| `ADMIN_SECRET` | Passphrase required to register an Admin account | `admin_passphrase` | ✅ |
| `CLOUDINARY_CLOUD_NAME`| Cloudinary account cloud name | `your_cloud_name` | ✅ |
| `CLOUDINARY_API_KEY` | Cloudinary account API key | `1234567890` | ✅ |
| `CLOUDINARY_API_SECRET`| Cloudinary account API secret | `abcdef...` | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client ID | `your_google_client_id.apps.googleusercontent.com` | ✅ |
| `GOOGLE_CLIENT_SECRET`| Google OAuth 2.0 Web Client Secret | `your_google_client_secret` | ✅ |
| `FRONTEND_URL` | Client origin URL for CORS & OAuth redirects | `http://localhost:5173` | ✅ |
| `BACKEND_URL` | Backend public base URL | `http://localhost:5000` | ✅ |
| `SMTP_HOST` | Transactional email SMTP server | `smtp.gmail.com` | Optional |
| `SMTP_PORT` | Transactional email SMTP port | `587` | Optional |
| `SMTP_USER` | SMTP username / email address | `your_email@gmail.com` | Optional |
| `SMTP_PASS` | SMTP application password | `app_password` | Optional |
| `USE_MOCK_LLM` | Set `true` to use mock AI parser during local dev | `false` | Optional |

---

## 🛠️ Local Development Setup

### Prerequisites
- **Node.js** v20+ and **npm** v9+
- **PostgreSQL** v14+ (Local service or cloud provider like Neon / Supabase)
- **Redis** v6+ (Local service or Upstash Redis)
- **Google AI Studio Key** ([Get free key](https://aistudio.google.com/app/apikey))
- **Cloudinary Account** ([Free tier](https://cloudinary.com))

### 1. Clone & Navigate
```bash
git clone https://github.com/yourusername/career-nest.git
cd career-nest
```

### 2. Backend Initialization
```bash
cd backend
npm install

# Populate your backend/.env using the table above
# Then generate the Prisma Client & push schema migrations:
npx prisma generate
npx prisma migrate dev --name init

# Start the Express API server and BullMQ background workers:
npm run dev
# ➔ Server running at http://localhost:5000
```

### 3. Frontend Initialization
```bash
# In a separate terminal window:
cd frontend
npm install

# Start Vite development server:
npm run dev
# ➔ Web Application accessible at http://localhost:5173
```

### 4. Verify System Health
```bash
curl http://localhost:5000/api/health
# Response: {"status":"ok","message":"API is healthy"}
```

---

## 🧪 Demo Credentials & Testing Walkthrough

You can immediately register accounts through `http://localhost:5173/auth`:

1. **Student Account**: Select **Student**, provide personal and college details. Once logged in, upload any PDF resume. Observe the asynchronous BullMQ pipeline and live WebSocket skill extraction.
2. **Recruiter Account**: Select **Recruiter**, provide company metadata. Create a job opening with natural language requirements — Gemini will extract structured criteria.
3. **Admin Account**: Select **Admin**, supply the matching `ADMIN_SECRET` configured in `.env`. Access institutional placement analytics and platform-wide moderation.

---

## 🔒 Security Best Practices

- **Constant-Time Cryptographic Comparison**: Prevents timing attacks on email enumeration during authentication by comparing against a dummy bcrypt hash when accounts are not found.
- **Strict Role-Based Access Control**: Route middlewares verify user context (`STUDENT`, `RECRUITER`, `ADMIN`) on both REST routes and WebSocket channel connections.
- **Resource Ownership Validation**: Deletion and update controllers enforce database record ownership directly against the authenticated `userId`.
- **HTTP Hardening**: Configured with `helmet` security headers, strict CORS origin checks, and IP-level rate limiting via `express-rate-limit`.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for complete details.

<div align="center">
  <sub>Engineered with precision for elite campus placements and scalable recruitment.</sub>
</div>
