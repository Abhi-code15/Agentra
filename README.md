# AGENTRA

> **Think. Remember. Plan. Execute.**  
> A production-style Personal AI Productivity Agent with persistent memory, PostgreSQL-backed task management, Google Sign-In, and bounded multi-step tool execution.

---

## 🚀 Overview

**Agentra** is not a generic chatbot or a trivial CRUD app. It is a full-stack, personal productivity assistant built with software craftsmanship and defensive application security. An AI agent is coupled to authorized application services to analyze tasks, retrieve long-term user context, propose multi-step schedules, and execute approved actions through a robust backend.

### Key Capabilities

- 🤖 **Bounded AI Agent Engine:** Multi-step loop with strict iteration limits (`AGENT_MAX_ROUNDS`), timeouts, token accounting, and audit logs.
- 🛠️ **Controlled Tool Calling:** 8 registered tools validated via Zod schemas, calling internal services directly with zero shell or arbitrary SQL access.
- 🛡️ **Action Proposal & Approval Workflow:** Sensitive bulk operations (e.g. multi-task plan creation) require explicit user confirmation before transactional database commitment.
- 🧠 **Persistent Long-Term Memory:** User-controlled preferences, goals, and working style automatically retrieved via keyword relevance into untrusted prompt blocks.
- 📋 **Production Task Management:** Filters by status, priority, presets (`overdue`, `upcoming`, `today`), keyword search, and pagination.
- 🔐 **Hardened Authentication:** Dual auth via Argon2id email/password and official Google OAuth 2.0 / OpenID Connect token verification with account linking safety.
- 🍪 **Defensive Session Security:** Cryptographically random 32-byte opaque tokens in `HttpOnly`, `SameSite` cookies; only SHA-256 token hashes stored in PostgreSQL; double-submit CSRF protection; rate limiting.
- 📊 **Observability & Health:** Structured JSON logging with recursive secret redaction, request IDs, agent run tracking, and liveness/readiness probes.

---

## 🏗️ Technology Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js (>= 20), Express.js, Pure JavaScript ES Modules (`"type": "module"`) |
| **Architecture** | Modular Monolith (`auth`, `tasks`, `conversations`, `memories`, `agent`, `proposals`) |
| **Database** | PostgreSQL 16+, official `pg` connection pool, parameterized queries, versioned SQL migrations |
| **Frontend** | React 18, Vite, React Router v6, Pure JavaScript ES Modules, Responsive Modern SaaS CSS |
| **Validation** | Zod for request payloads, query parameters, environment config, and tool schemas |
| **Testing** | Node.js native test runner (`node --test`), `node:assert/strict`, `supertest` |
| **Auth** | Argon2id, Google OAuth (`google-auth-library`), opaque session cookies, CSRF double-submit |
| **AI Providers** | Multi-provider adapter: Google Gemini (`@google/generative-ai`), OpenAI (`openai`), Deterministic Mock |
| **DevOps** | Docker, Docker Compose, non-root multi-stage builds, OpenAPI 3.0 |

> **Strict Architectural Exclusions:** Zero TypeScript, Zero Python, Zero microservices, Zero Kafka/Redis overhead, Zero heavy agent frameworks (clean understandable loop).

---

## 📂 Project Structure

```text
AGENTRA/
├── client/                     # Vite + React 18 (Pure JavaScript ES Modules)
│   ├── src/
│   │   ├── api/                # Fetch API client with CSRF & credential handling
│   │   ├── components/         # Navbar, accessible Modal dialog
│   │   ├── features/auth/      # AuthContext provider, ProtectedRoute
│   │   ├── pages/              # Dashboard, Tasks, AI Workspace, Memories, Settings, Login, Register
│   │   ├── styles/             # Modern SaaS design system & CSS variables
│   │   ├── App.jsx             # React Router structure
│   │   └── main.jsx            # React root entry
│   ├── index.html              # HTML shell with Google Identity Services script
│   └── vite.config.js          # Vite config with API proxy
├── server/                     # Node.js + Express (Pure JavaScript ES Modules)
│   ├── migrations/             # Versioned SQL migrations (001_initial_schema.sql)
│   ├── src/
│   │   ├── app.js              # Express app factory, CORS, CSRF, health routes
│   │   ├── server.js           # HTTP listener with graceful shutdown
│   │   ├── config/             # Zod environment validation (env.js)
│   │   ├── db/                 # pg Pool, transaction helper, migration runner
│   │   ├── middleware/         # auth, rate-limiter, request-id, error-handler
│   │   ├── modules/
│   │   │   ├── auth/           # Argon2id, session repository, Google auth, routes
│   │   │   ├── users/          # User repository & profile controller
│   │   │   ├── tasks/          # Task CRUD, filters, status transitions, service
│   │   │   ├── conversations/  # Conversation & message repositories, chat controller
│   │   │   ├── memories/       # Long-term memory repository & search
│   │   │   └── proposals/      # Action proposal approval & transactional execution
│   │   ├── ai/
│   │   │   ├── provider.js     # Unified AI adapter (Gemini, OpenAI, Mock)
│   │   │   ├── prompts.js      # System prompt generator & guardrails
│   │   │   ├── context-builder.js # Sliding message window & keyword memory lookup
│   │   │   ├── agent-runner.js # Bounded multi-step execution loop
│   │   │   └── tool-registry.js# 8 registered tools with Zod schemas
│   │   ├── shared/             # logger (secret redaction), errors, pagination
│   │   └── routes/             # Top-level /api/v1 router mounting
│   └── tests/
│       ├── integration/        # Health, Auth, Tasks, Agent, Memories test suites
│       └── security/           # SQL injection, CSRF, auth bypass, rate limit tests
├── docs/                       # Complete engineering documentation
│   ├── PRD.md                  # Product Requirements Document
│   ├── ARCHITECTURE.md         # Component diagrams & execution sequence
│   ├── DATABASE_ERD.md         # PostgreSQL Entity-Relationship Diagram
│   ├── API.md                  # REST API Contract
│   ├── openapi.json            # OpenAPI 3.0 specification
│   ├── SECURITY.md             # Security architecture & threat model
│   ├── TESTING.md              # Test execution report
│   ├── GOOGLE_OAUTH_SETUP.md   # Google Cloud setup walkthrough
│   └── DEPLOYMENT.md           # Production deployment & backup guide
├── docker-compose.yml          # Containerized PostgreSQL + Backend
├── Dockerfile                  # Multi-stage production container
├── .env.example                # Documented configuration variables
└── package.json                # Root orchestration scripts
```

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js**: `>= 20.0.0` (Verified on Node v24.12.0)
- **PostgreSQL**: `>= 16` (Running locally on port 5432) or **Docker**

### 2. Environment Setup
```bash
# Clone repository
git clone https://github.com/your-username/agentra.git
cd agentra

# Copy environment template
cp .env.example server/.env
```

Ensure `server/.env` contains your PostgreSQL credentials:
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/agentra_dev
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/agentra_test
SESSION_SECRET=change-me-to-a-very-long-and-secure-random-secret-key-32-chars-min
AI_PROVIDER=mock
```

### 3. Install Dependencies & Run Database Migrations
```bash
# Install root, server, and client dependencies
npm --prefix server install
npm --prefix client install

# Run database migrations
npm --prefix server run migrate
```

### 4. Run Automated Tests
```bash
npm test
```
*Expected: 38 passing tests across 6 suites with 0 failures.*

### 5. Start Development Servers
In two terminal tabs:
```bash
# Tab 1: Start Backend (Port 5000)
npm run server:dev

# Tab 2: Start Frontend (Port 5173)
npm run client
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🐳 Running with Docker Compose

```bash
docker compose up -d --build
docker compose exec backend npm run migrate
```

Check health:
```bash
curl http://localhost:5000/health/ready
# {"status":"ready","database":"connected","timestamp":"..."}
```

---

## 🧪 Verified Automated Test Suite

Agentra includes 38 automated integration and security tests verified against a live PostgreSQL instance:

```text
✔ Health and System Routes (4 tests passed)
✔ Authentication Module Integration Tests (8 tests passed)
✔ Task Management Integration Tests (9 tests passed)
✔ AI Agent Engine & Multi-Step Orchestration (7 tests passed)
✔ User Long-Term Memory Integration Tests (4 tests passed)
✔ Application Security & Penetration Tests (6 tests passed)

Total: 38 passed, 0 failed, 100% verified.
```

---

## 🔒 Security Architecture Highlights

1. **Least-Privilege Tool Registry:** The LLM cannot execute shell commands or arbitrary SQL. It can only call strictly validated functions.
2. **Untrusted Memory Isolation:** Retrieved preferences and user messages are isolated in an untrusted block to prevent prompt injection.
3. **Double-Submit CSRF:** Cookie mutations require matching `X-CSRF-Token` headers.
4. **Hashed Session Tokens:** The database stores only `SHA-256` token hashes.
5. **Cross-User Isolation:** Every query enforces user scoping: `WHERE user_id = $1`.
6. **Automatic Secret Redaction:** Logger redacts credentials, API keys, passwords, and tokens.

---

## 📚 Complete Documentation

- [Architecture & Sequence Flow](docs/ARCHITECTURE.md)
- [Database Schema & ERD](docs/DATABASE_ERD.md)
- [Product Requirements Document (PRD)](docs/PRD.md)
- [REST API Contract](docs/API.md)
- [OpenAPI 3.0 Specification](docs/openapi.json)
- [Security & Threat Model](docs/SECURITY.md)
- [Testing Guide & Report](docs/TESTING.md)
- [Google OAuth Setup Guide](docs/GOOGLE_OAUTH_SETUP.md)
- [Production Deployment Guide](docs/DEPLOYMENT.md)

---



