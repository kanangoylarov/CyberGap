# GRC Intelligence

AI-powered Governance, Risk & Compliance assessment platform. Evaluate your organization's security posture against ISO 27001 and NIST frameworks, then receive deep vulnerability analysis with attack scenarios and remediation plans — powered by Claude AI.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the App](#running-the-app)
- [Architecture](#architecture)
  - [API Layer](#api-layer)
  - [Frontend Layer](#frontend-layer)
- [API Reference](#api-reference)
  - [Authentication](#authentication)
  - [Questions](#questions)
  - [Audit](#audit)
  - [Reports](#reports)
  - [Health Check](#health-check)
- [Database Schema](#database-schema)
- [AI Analysis Pipeline](#ai-analysis-pipeline)
- [Standards Coverage](#standards-coverage)
- [Production Deployment](#production-deployment)
- [License](#license)

---

## Overview

GRC Intelligence provides a complete workflow for security compliance assessment:

1. **Register** and create your organization profile
2. **Assess** your security controls by answering 50 questions across 13 categories
3. **Analyze** — Claude AI evaluates every gap with attack vectors, real-world breach examples, and severity scoring
4. **Report** — receive a board-level executive report with remediation roadmap and investment estimates

## Features

- **50 GRC control questions** across ISO 27001 and NIST Cybersecurity Framework
- **13 assessment categories** — Access Control, Network Security, Incident Management, Cryptography, and more
- **AI-powered gap analysis** — each gap is analyzed for attack scenarios, real-world breach parallels, and business impact
- **Executive summary generation** — board-ready report with top risks, attack scenarios, compliance matrix, and implementation roadmap
- **Compliance radar chart** — visual overview of category-level scores
- **Risk scoring** — automated risk level (Low/Medium/High) and maturity level (Initial through Optimizing)
- **JWT authentication** — secure user registration and login with bcrypt password hashing
- **Role-based access** — admin routes for question management
- **SQLite database** — zero-configuration, file-based persistence with WAL mode

## Tech Stack

### API (`api/`)

| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express 4 | HTTP framework |
| better-sqlite3 | SQLite database driver (WAL mode) |
| @anthropic-ai/sdk | Claude AI integration |
| jsonwebtoken | JWT authentication |
| bcryptjs | Password hashing (12 rounds) |
| cors | Cross-origin resource sharing |
| dotenv | Environment variable loading |

### Frontend (`front/`)

| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| React Router 6 | Client-side routing |
| Vite 5 | Build tool and dev server |
| Chart.js 4 | Doughnut and radar charts (CDN) |

## Project Structure

```
grc-app-2/
├── api/                              # Express REST API
│   ├── server.js                     # Entry point — loads config, inits DB, starts listening
│   ├── app.js                        # Express app — middleware, route mounting, error handling
│   ├── .env.example                  # Environment variable template
│   ├── config/
│   │   ├── index.js                  # Centralized config from env vars
│   │   ├── database.js               # SQLite connection singleton, WAL mode, schema init
│   │   └── claude.js                 # Anthropic client setup, callClaude() helper
│   ├── middleware/
│   │   ├── auth.js                   # JWT verification (authenticateToken, requireAdmin)
│   │   └── errorHandler.js           # Global error handler (JWT errors, JSON parse, generic)
│   ├── routes/
│   │   ├── index.js                  # Mounts all route groups under /api/*
│   │   ├── auth.routes.js            # POST /register, POST /login, GET /me
│   │   ├── questions.routes.js       # GET /, GET /flat, POST /, DELETE /:id
│   │   ├── audit.routes.js           # POST /submit, GET /my-responses, GET /my-analysis, GET /analysis-status
│   │   └── reports.routes.js         # GET /my-report, GET /executive-summary, GET /stats
│   ├── controllers/
│   │   ├── auth.controller.js        # Parse request, call service, format response
│   │   ├── questions.controller.js
│   │   ├── audit.controller.js
│   │   └── reports.controller.js
│   ├── services/
│   │   ├── auth.service.js           # User registration, login, profile lookup, JWT signing
│   │   ├── questions.service.js      # Grouped/flat question queries, CRUD
│   │   ├── audit.service.js          # Batch response submission, response/analysis queries
│   │   ├── reports.service.js        # Report aggregation, category scores, dashboard stats
│   │   └── ai.service.js             # Claude prompt engineering, background analysis loop
│   └── db/
│       └── init.sql                  # Schema (4 tables, 3 indexes) + 50 seed questions
│
├── front/                            # React SPA
│   ├── index.html                    # Entry HTML — Google Fonts + Chart.js CDN
│   ├── vite.config.js                # Dev server proxy (/api -> localhost:3001)
│   └── src/
│       ├── main.jsx                  # ReactDOM entry — BrowserRouter, AuthProvider, CSS imports
│       ├── App.jsx                   # Route definitions with nested layouts
│       ├── api/
│       │   └── client.js             # Fetch wrapper — auto Bearer token, 401 redirect
│       ├── context/
│       │   └── AuthContext.jsx       # Auth state — token/user in localStorage, login/register/logout
│       ├── hooks/
│       │   └── useApi.js             # Reusable hook with loading/error states
│       ├── layouts/
│       │   ├── AuthLayout.jsx        # Split-screen layout for login/register pages
│       │   └── AppLayout.jsx         # Sidebar + scrollable main content area
│       ├── components/
│       │   ├── Sidebar.jsx           # Navigation with active route highlighting
│       │   ├── ProtectedRoute.jsx    # Redirects to /login if unauthenticated
│       │   ├── LoadingSpinner.jsx    # Centered spinner with optional message
│       │   └── StatCard.jsx          # Reusable metric card (label, value, sub-text)
│       ├── pages/
│       │   ├── Login.jsx             # Email/password form with validation
│       │   ├── Register.jsx          # Full registration form (5 fields)
│       │   ├── Dashboard.jsx         # Stats grid, doughnut chart, quick actions
│       │   ├── Assessment.jsx        # Multi-phase quiz — intro, category tabs, submit with polling
│       │   └── Report.jsx            # 11-section security report with charts
│       ├── utils/
│       │   ├── constants.js          # Color maps for risk levels and categories
│       │   └── helpers.js            # Date formatting, score-to-color mapping
│       └── styles/
│           ├── index.css             # CSS variables, reset, base typography
│           ├── auth.css              # Auth page split layout
│           ├── layout.css            # Sidebar, main area, page transitions
│           ├── components.css        # Cards, buttons, forms, badges, tables, loading states
│           ├── assessment.css        # Quiz flow — tabs, progress bar, question rows
│           └── report.css            # Report sections, gap cards, exec summary, attack cards
│
└── README.md
```

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Anthropic API key** — optional; the app works without it, but AI analysis features require it

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd grc-app-2

# Install API dependencies
cd api
npm install

# Install frontend dependencies
cd ../front
npm install
```

### Environment Variables

Copy the example env file and configure it:

```bash
cp api/.env.example api/.env
```

Edit `api/.env`:

```env
# Server
PORT=3001

# JWT — change this in production
JWT_SECRET=your-secure-random-string-here
JWT_EXPIRES_IN=24h

# Anthropic Claude API — required for AI analysis
ANTHROPIC_API_KEY=sk-ant-...

# CORS — frontend dev server origin
CORS_ORIGIN=http://localhost:5173
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3001` | API server port |
| `JWT_SECRET` | Yes (production) | `grc-secret-change-in-production` | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | No | `24h` | Token expiration time |
| `ANTHROPIC_API_KEY` | No | — | Claude API key for AI analysis |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin |

### Running the App

You need two terminal windows:

**Terminal 1 — API server:**

```bash
cd api
npm run dev        # Development with auto-reload (node --watch)
# or
npm start          # Production
```

**Terminal 2 — Frontend dev server:**

```bash
cd front
npm run dev        # Vite dev server on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

The Vite dev server automatically proxies all `/api/*` requests to the Express API on port 3001.

## Architecture

### API Layer

The API follows a **3-layer architecture** with strict separation of concerns:

```
Request → Route → Controller → Service → Database
                                       → Claude AI
```

| Layer | Responsibility | Example |
|---|---|---|
| **Routes** | HTTP method + path + middleware chain | `router.post('/submit', authenticateToken, controller.submit)` |
| **Controllers** | Parse request params/body, call services, format HTTP response | Extracts `req.body.responses`, calls `auditService.submitResponses()`, returns `res.json()` |
| **Services** | Business logic, database queries, external API calls | Validates data, runs SQL transactions, calls Claude API |
| **Config** | Connection setup, environment loading | Database singleton, Anthropic client, centralized config object |
| **Middleware** | Cross-cutting concerns | JWT verification, error handling, CORS |

### Frontend Layer

The frontend follows a **component-based architecture** with React patterns:

```
main.jsx → AuthProvider → BrowserRouter → App (Routes)
                                            ├── AuthLayout → Login / Register
                                            └── ProtectedRoute → AppLayout → Dashboard / Assessment / Report
```

| Layer | Responsibility |
|---|---|
| **Context** | Global auth state with localStorage persistence |
| **Layouts** | Page-level structure (auth split-screen vs. sidebar + content) |
| **Pages** | Feature-specific views with data fetching |
| **Components** | Reusable UI elements (StatCard, Sidebar, LoadingSpinner) |
| **Hooks** | Shared logic (useApi for loading/error state management) |
| **API Client** | Centralized fetch wrapper with auth headers and error handling |
| **Utils** | Constants (color maps) and helper functions (formatting) |
| **Styles** | Modular CSS split by feature area |

## API Reference

All endpoints return JSON in the format:

```json
{
  "success": true,
  "data": { ... }
}
```

On error:

```json
{
  "success": false,
  "error": "Error message"
}
```

### Authentication

All endpoints except `/register` and `/login` require a Bearer token:

```
Authorization: Bearer <jwt-token>
```

#### `POST /api/auth/register`

Create a new user account.

**Request body:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "securepassword",
  "company": "Acme Corp"
}
```

**Response** `201`:

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "company": "Acme Corp",
      "isAdmin": false
    }
  }
}
```

#### `POST /api/auth/login`

Authenticate and receive a token.

**Request body:**

```json
{
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Response** `200`: Same shape as register response.

#### `GET /api/auth/me`

Get the authenticated user's profile. Requires auth.

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "company": "Acme Corp",
    "isAdmin": false,
    "createdAt": "2026-03-15 10:30:00"
  }
}
```

### Questions

#### `GET /api/questions`

Get all questions grouped by standard and category. Requires auth.

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "ISO 27001": {
      "Access Control": [
        { "id": 1, "clauseNumber": "A.9.1", "text": "Is there a formal access control policy..." }
      ],
      "Network Security": [ ... ]
    },
    "NIST": {
      "Risk Assessment": [ ... ]
    }
  },
  "total": 50
}
```

#### `GET /api/questions/flat?standard=ISO 27001`

Get a flat list of questions. Optional `standard` query parameter to filter. Requires auth.

#### `POST /api/questions`

Create a new question. Requires auth + admin.

**Request body:**

```json
{
  "standardName": "ISO 27001",
  "category": "Access Control",
  "clauseNumber": "A.9.5",
  "questionText": "Are access logs reviewed regularly?"
}
```

#### `DELETE /api/questions/:id`

Delete a question by ID. Requires auth + admin.

### Audit

#### `POST /api/audit/submit`

Submit assessment responses. Deletes any previous responses for the user and triggers background AI analysis. Requires auth.

**Request body:**

```json
{
  "responses": [
    { "questionId": 1, "answer": true, "comment": null },
    { "questionId": 2, "answer": false, "comment": "Not yet implemented" }
  ]
}
```

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "totalResponses": 50,
    "message": "Responses saved. AI analysis is being generated..."
  }
}
```

> AI analysis runs in the background. Poll `/api/audit/analysis-status` to track progress.

#### `GET /api/audit/analysis-status`

Check the progress of background AI analysis. Requires auth.

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "totalResponses": 50,
    "analyzedCount": 35,
    "isComplete": false,
    "progress": 70
  }
}
```

#### `GET /api/audit/my-responses`

Get the authenticated user's assessment responses with question details. Requires auth.

#### `GET /api/audit/my-analysis`

Get AI analysis results for the user's responses, sorted by score ascending (worst gaps first). Requires auth.

### Reports

#### `GET /api/reports/my-report`

Get the full assessment report. Requires auth.

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "company": "Acme Corp",
    "assessedBy": "John Doe",
    "email": "john@example.com",
    "date": "2026-03-15 10:30:00",
    "overallScore": 66,
    "riskLevel": "Medium Risk",
    "maturityLevel": "Managed",
    "totalQuestions": 50,
    "totalGaps": 17,
    "totalStrengths": 33,
    "categoryScores": [
      {
        "name": "ISO 27001 - Access Control",
        "standard": "ISO 27001",
        "category": "Access Control",
        "score": 71,
        "total": 7,
        "gaps": 2,
        "strengths": 5
      }
    ],
    "criticalGaps": [
      {
        "questionId": 6,
        "standard": "ISO 27001",
        "category": "Access Control",
        "clause": "A.9.4.2",
        "question": "Is multi-factor authentication (MFA) enforced...?",
        "aiScore": 15,
        "gapAnalysis": "Detailed vulnerability analysis...",
        "recommendation": "Step-by-step remediation plan..."
      }
    ],
    "strengths": [
      {
        "questionId": 1,
        "standard": "ISO 27001",
        "category": "Access Control",
        "clause": "A.9.1",
        "question": "Is there a formal access control policy...?"
      }
    ]
  }
}
```

#### `GET /api/reports/executive-summary`

Generate a board-level executive report via Claude AI. Requires auth.

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "boardStatement": "Urgent statement for the board...",
    "executiveSummary": "Overview of GRC posture...",
    "topRisks": [
      {
        "risk": "Inadequate Access Controls",
        "severity": "Critical",
        "description": "How attackers can exploit this...",
        "businessImpact": "Financial/legal impact...",
        "immediateAction": "Action for this week..."
      }
    ],
    "attackScenarios": [
      {
        "scenario": "Credential Stuffing Attack",
        "description": "Step-by-step attack description...",
        "gapsExploited": ["A.9.4.2", "A.9.2.5"],
        "likelihood": "High",
        "impact": "Full system compromise..."
      }
    ],
    "complianceRisks": [
      {
        "regulation": "GDPR",
        "status": "Non-Compliant",
        "gaps": ["Encryption at rest", "Access logging"],
        "penalty": "Up to 4% of annual global turnover",
        "deadline": "Immediate"
      }
    ],
    "roadmap": {
      "immediate": ["Enable MFA on all admin accounts"],
      "shortTerm": ["Deploy SIEM solution"],
      "longTerm": ["Achieve ISO 27001 certification"]
    },
    "investmentEstimate": {
      "minimum": "$50,000",
      "maximum": "$150,000",
      "roi": "Prevents potential $2M+ breach costs..."
    }
  }
}
```

#### `GET /api/reports/stats`

Get dashboard summary statistics. Requires auth.

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "totalResponses": 50,
    "totalGaps": 17,
    "totalStrengths": 33,
    "overallScore": 66,
    "avgGapScore": 28,
    "riskLevel": "Medium Risk"
  }
}
```

### Health Check

#### `GET /api/health`

Check API and database status. No auth required.

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "database": "connected",
    "claudeApi": "configured",
    "uptime": 1234.56
  }
}
```

## Database Schema

The app uses SQLite with 4 tables:

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│      users        │       │  audit_responses  │       │   ai_analysis     │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)           │◄──────│ user_id (FK)      │       │ id (PK)           │
│ first_name        │       │ question_id (FK)  │──┐    │ response_id (FK)  │──┐
│ last_name         │       │ answer            │  │    │ ai_score (0-100)  │  │
│ email (UNIQUE)    │       │ comment           │  │    │ gap_analysis      │  │
│ password (hash)   │       │ file_path         │  │    │ recommendation    │  │
│ company           │       │ created_at        │  │    │ created_at        │  │
│ is_admin          │       │ updated_at        │  │    │ updated_at        │  │
│ created_at        │       └──────────────────┘  │    └──────────────────┘  │
│ updated_at        │                              │                          │
└──────────────────┘       ┌──────────────────┐  │                          │
                            │    questions      │  │    audit_responses.id ◄──┘
                            ├──────────────────┤  │
                            │ id (PK)           │◄─┘
                            │ standard_name     │
                            │ category          │
                            │ clause_number     │
                            │ question_text     │
                            └──────────────────┘
```

| Table | Purpose |
|---|---|
| **users** | Registered accounts with bcrypt-hashed passwords |
| **questions** | 50 pre-seeded GRC control questions (ISO 27001 + NIST) |
| **audit_responses** | User answers per question (1 = compliant, 0 = gap) |
| **ai_analysis** | Claude-generated analysis per response (score, gap analysis, recommendation) |

The database file is created automatically at `api/db/grc.db` on first run. WAL (Write-Ahead Logging) mode is enabled for concurrent read performance.

## AI Analysis Pipeline

When a user submits an assessment, the following happens:

```
User submits answers
        │
        ▼
  Save responses to DB (transaction)
        │
        ▼
  Return 200 immediately (non-blocking)
        │
        ▼
  Background: For each gap (answer = NO)
        │
        ├── Build prompt with:
        │   ├── Company context and overall compliance %
        │   ├── Standard, category, and clause reference
        │   ├── Control question that failed
        │   └── Instructions for attack scenarios, breach examples, remediation
        │
        ├── Call Claude API (claude-sonnet-4-20250514, 8000 max tokens)
        │
        ├── Parse JSON response → { score, gapAnalysis, recommendation }
        │
        └── Store in ai_analysis table
        │
        ▼
  Background: For each strength (answer = YES)
        │
        └── Store with score=85 and standard positive message
        │
        ▼
  Frontend polls GET /api/audit/analysis-status every 3s
        │
        ▼
  When isComplete = true → navigate to Report page
```

Each gap analysis includes:

- **Vulnerability analysis** — why the gap is dangerous, specific attack vectors it enables
- **Attack scenarios** — step-by-step exploitation methods with real attacker tools
- **Real-world parallels** — specific breaches and regulatory fines from similar gaps
- **Business impact** — financial losses, regulatory penalties, reputational damage
- **Remediation plan** — immediate, short-term, and long-term actions with responsible roles, tools, and cost estimates

### Risk Scoring

| Overall Score | Risk Level | Maturity Level |
|---|---|---|
| >= 81% | Low Risk | Optimizing |
| 61-80% | Low Risk | Managed |
| 41-60% | Medium Risk | Defined |
| 21-40% | High Risk | Developing |
| 0-20% | High Risk | Initial |

## Standards Coverage

### ISO 27001 — 33 questions

| Category | Clauses | Questions |
|---|---|---|
| Access Control | A.9.1 — A.9.4 | 7 |
| Information Security Policies | A.5.1 — A.6.1 | 3 |
| Network Security | A.13.1 — A.13.2 | 4 |
| Incident Management | A.16.1 | 4 |
| Business Continuity | A.17.1 | 3 |
| Cryptography | A.10.1 | 2 |
| Physical Security | A.11.1 — A.11.2 | 3 |
| HR Security | A.7.1 — A.7.3 | 4 |
| Asset Management | A.8.1 — A.8.2 | 3 |

### NIST Cybersecurity Framework — 17 questions

| Category | Functions | Questions |
|---|---|---|
| Risk Assessment | ID.RA | 5 |
| Data Protection | PR.DS | 4 |
| Monitoring & Detection | DE.CM, DE.AE | 5 |
| Recovery Planning | RC.RP, RC.IM, RC.CO | 3 |

## Production Deployment

### 1. Build the Frontend

```bash
cd front
npm run build
```

This generates optimized static files in `front/dist/`.

### 2. Serve with the API

To serve the built frontend from Express, add this to `api/app.js` after the API routes and before the error handler:

```js
const path = require('path');

app.use(express.static(path.join(__dirname, '..', 'front', 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'front', 'dist', 'index.html'));
});
```

Then run only the API server — it serves both the API and the frontend:

```bash
cd api
NODE_ENV=production node server.js
```

### 3. Environment Checklist

- [ ] Set a strong, random `JWT_SECRET` (at least 32 characters)
- [ ] Set `ANTHROPIC_API_KEY` for AI features
- [ ] Set `CORS_ORIGIN` to your production domain (or remove CORS if serving from same origin)
- [ ] Set `NODE_ENV=production`
- [ ] Put a reverse proxy (nginx/Caddy) in front for HTTPS termination
- [ ] Back up `api/db/grc.db` regularly — it is the sole data store

### 4. Running with PM2

```bash
cd api
pm2 start server.js --name grc-api
pm2 save
```

### 5. Docker (optional)

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install API dependencies
COPY api/package*.json ./api/
RUN cd api && npm ci --production

# Install and build frontend
COPY front/package*.json ./front/
RUN cd front && npm ci
COPY front/ ./front/
RUN cd front && npm run build

# Copy API source
COPY api/ ./api/

EXPOSE 3001
WORKDIR /app/api
CMD ["node", "server.js"]
```

## License

This project is proprietary. All rights reserved.
