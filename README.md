<div align="center">
  
![CareerNest Banner](docs/careernest-banner.png)

# 🚀 CareerNest

**Next-Generation AI-Powered Placement & Recruitment Portal**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](#)
[![React](https://img.shields.io/badge/React-19-blue.svg)](#)

*CareerNest revolutionizes the university placement process through intelligent automation. It leverages the Google Gemini AI and a proprietary Hybrid Matching Engine to parse resumes, rank candidates in real-time with O(1) efficiency, and provide actionable skill-gap insights to students without incurring massive API costs.*

</div>

---

## 🚀 Core Features & Product Capabilities

### 👥 Multi-Persona Ecosystem
1. **Student:** Upload resumes, get instant AI-parsed profiles, view ranked job matches, and receive dynamic skill-gap advice.
2. **Recruiter:** Post job requirements (AI auto-extracts criteria), track active listings, and instantly view a ranked list of top-matched applicants.
3. **Admin / Placement Cell:** Oversee the entire ecosystem, manage users, and delete any inappropriate listings or profiles.

### 🧠 AI-Powered Resume Parsing
- **Pipeline:** PDF upload → Cloudinary CDN → Stream processing via `pdf-parse` → **Google Gemini API** (using Controlled Generation JSON schemas).
- Extracts structured metrics (Skills array, CGPA, Years of Experience) directly from unstructured PDF text, completely eliminating manual data entry.

### ⚡ Hybrid Matching Engine
- **O(1) Efficiency:** Calculates candidate-job compatibility entirely in-process using pre-parsed database payloads, achieving zero latency and zero LLM API cost on every page load.
- **Algorithm:** 70% Jaccard Skill Similarity (Set theory intersection over union) + 30% Hard Filters (Proportional scaling for CGPA and Experience).

### 💡 Zero-Token Skill Gap Advice
- Performs a local intersection computation to identify exactly which required skills a student is missing.
- Dynamically generates actionable "Tip" alerts on the student dashboard encouraging targeted project building, completely free of generative AI token costs.

---

## 📸 Application Screenshots (Visual Tour)

| Student Dashboard | Recruiter Job Posting |
| :---: | :---: |
| ![Student Dashboard - Job Matches & Skill Gap](docs/student-dashboard.png) <br> *AI Job Matches & Skill Gap Analysis* | ![Recruiter Job Posting](docs/recruiter-posting.png) <br> *AI-Assisted Job Requirements Extraction* |

| Applicant Tracking | Admin Stats Panel |
| :---: | :---: |
| ![Applicant Tracking View](docs/applicant-tracking.png) <br> *Ranked Candidate List by Match Score* | ![Admin Stats Panel](docs/admin-panel.png) <br> *Global Placement Statistics & Governance* |

---

## 🏗️ Tech Stack & System Architecture

### 🛠️ Technologies
| Layer | Technology |
| --- | --- |
| **Frontend** | React 19, Vite, Tailwind CSS, Zustand, React Router, Axios, Lucide React |
| **Backend** | Node.js, Express.js, Prisma ORM, bcryptjs, JWT |
| **Database & Cache** | MongoDB (Atlas), Redis (Upstash) |
| **Cloud & AI Services** | Google Gemini (Gen AI), Cloudinary (CDN), Nodemailer (SMTP) |

### 🔄 Data Flow Architecture
1. **Client Request:** Frontend issues JWT-protected requests via Axios.
2. **Controller Logic:** Express controllers handle validation and authorize roles.
3. **Cache Layer:** Redis sits in front of read-heavy routes (like `getAllJobs`), serving responses in microseconds. Cache invalidation happens atomically on writes.
4. **AI & Database:** Uploads are streamed to Cloudinary, parsed via Gemini, and structured payloads are written to MongoDB utilizing Prisma ORM.

---

## 🔐 Environment Variables

Create a `.env` file in the `backend/` directory and configure the following variables. *Never commit your actual secrets.*

| Variable Name | Description | Required? |
| :--- | :--- | :---: |
| `PORT` | The port the backend server runs on (e.g., `5000`) | Yes |
| `DATABASE_URL` | MongoDB connection string (Local or Atlas) | Yes |
| `REDIS_URL` | Redis instance connection string (e.g., Upstash) | Yes |
| `JWT_SECRET` | Secret key for signing JSON Web Tokens | Yes |
| `JWT_EXPIRES_IN` | Token validity duration (e.g., `7d`) | Yes |
| `GEMINI_API_KEY` | API Key for Google Gemini LLM access | Yes |
| `ADMIN_SECRET` | Passphrase required to register an Admin account | Yes |
| `USE_MOCK_LLM` | Set to `true` to bypass real AI calls during local dev | No |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account Cloud Name | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary account API Key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary account API Secret | Yes |
| `SMTP_HOST` / `SMTP_PORT` | SMTP Server configuration for emails | No |
| `SMTP_USER` / `SMTP_PASS` | SMTP Authentication credentials | No |


---

## 🛠️ Local Development Setup

Follow these steps to run the project locally.

**1. Clone the repository**
```bash
git clone https://github.com/yourusername/career-nest.git
cd career-nest
```

**2. Setup the Backend**
```bash
cd backend
npm install
# Create and configure your .env file here
npx prisma generate
npm run dev
```

**3. Setup the Frontend**
```bash
# In a new terminal tab
cd frontend
npm install
npm run dev
```

The application will now be running. The frontend typically starts at `http://localhost:5173` and the backend at `http://localhost:5000`.

---

## 📂 Project Folder Structure

```ascii
career-nest/
├── backend/
│   ├── prisma/                  # Database schema models
│   ├── src/
│   │   ├── config/              # Prisma, Redis, Cloudinary initialization
│   │   ├── controllers/         # Core business logic (auth, jobs, students)
│   │   ├── middlewares/         # JWT verification, Role checks, Multer
│   │   ├── routes/              # Express API route definitions
│   │   ├── services/
│   │   │   ├── llm.service.ts     # 🧠 Gemini parsing & PDF extraction
│   │   │   └── matcher.service.ts # ⚡ Hybrid Jaccard scoring engine
│   │   └── server.ts            # Entry point
│   ├── .env                     # Environment variables
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/          # Reusable UI (Layout, Spinners)
    │   ├── lib/                 # Axios instance, Tailwind merge utilities
    │   ├── pages/               # Role-based views
    │   │   ├── student/
    │   │   │   └── Dashboard.tsx  # 🎯 Skill Gap & Job Match UI
    │   │   ├── recruiter/
    │   │   │   └── Dashboard.tsx  # 📊 Applicant Tracking UI
    │   │   └── auth/
    │   ├── store/
    │   │   └── authStore.ts       # Zustand state management
    │   └── App.tsx              # Router & Guard configuration
    ├── vite.config.ts
    └── package.json
```

---

## 🛣️ Core API Reference

| Method | Endpoint | Description | Protected Status |
| :---: | :--- | :--- | :--- |
| **POST** | `/api/auth/register` | Create a User and provision specific Profile | Public |
| **POST** | `/api/student/resume` | Extract PDF text, parse via LLM, update profile | 🔒 `STUDENT` |
| **POST** | `/api/jobs` | Parse requirements via LLM, save to DB, prime cache | 🔒 `RECRUITER` |
| **GET** | `/api/jobs/my-postings` | Fetch active listings for the logged-in recruiter | 🔒 `RECRUITER` |
| **GET** | `/api/jobs/:jobId/applicants`| View joined student data ranked by match score | 🔒 `RECRUITER / ADMIN` |
| **GET** | `/api/eligibility/matches`| Calculate Jaccard similarity and return job feed | 🔒 `STUDENT` |

---
<div align="center">
  <i>Built with ❤️ for modern software engineering placements.</i>
</div>
