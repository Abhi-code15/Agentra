# Agentra — Testing Guide & Verification Suite

## 1. Test Architecture

Agentra uses Node.js's native test runner (`node --test`), `node:assert/strict`, and `supertest` for high-performance, dependency-free testing. Tests run directly against a dedicated PostgreSQL database (`agentra_test`).

Test files are organized into three tiers:
1. `tests/integration/health.test.js`: Health checks and error-handling verification.
2. `tests/integration/auth.test.js`: Registration, login, Argon2id verification, session cookies, Google auth verification, logout, profile updates.
3. `tests/integration/tasks.test.js`: Task CRUD, status transitions, pagination, filtering, search, and cross-user isolation.
4. `tests/integration/agent.test.js`: Conversation creation, bounded multi-step agent execution loop, tool executions, proposal generation, and transactional approvals.
5. `tests/integration/memories.test.js`: Long-term memory CRUD and keyword context retrieval.
6. `tests/security/security.test.js`: SQL injection resistance, CSRF protection, brute-force rate limiting, unauthorized access rejection, and data leakage defense.

---

## 2. Running Automated Tests

### Prerequisite: Migrating Test Database
```bash
# Set DATABASE_URL to test database and run migrations
npm --prefix server run migrate:test
```

### Run Entire Test Suite
```bash
npm test
# Or from server directory:
cd server && npm test
```

---

## 3. Verified Test Results

```text
▶ Health and System Routes
  ✔ GET /health/live should return 200 and status ok (75ms)
  ✔ GET /health/ready should return 200 and database connected (111ms)
  ✔ GET /api/v1 should return API metadata (8ms)
  ✔ GET /non-existent-route should return 404 with structured error (9ms)

▶ Authentication Module Integration Tests
  ✔ POST /api/v1/auth/register should create a user and set cookies (593ms)
  ✔ POST /api/v1/auth/register should reject duplicate email with 409 (13ms)
  ✔ POST /api/v1/auth/login should authenticate with valid credentials (448ms)
  ✔ POST /api/v1/auth/login should reject invalid password with 401 (315ms)
  ✔ GET /api/v1/auth/me should return current user profile with valid session (19ms)
  ✔ PATCH /api/v1/auth/me should update profile fields with CSRF token (12ms)
  ✔ POST /api/v1/auth/google should authenticate via mock Google token in dev/test (51ms)
  ✔ POST /api/v1/auth/logout should revoke session (20ms)

▶ Task Management Integration Tests
  ✔ POST /api/v1/tasks should create a new task for authenticated user (26ms)
  ✔ GET /api/v1/tasks should list tasks with pagination and filters (98ms)
  ✔ GET /api/v1/tasks/:taskId should retrieve task for owner (22ms)
  ✔ PATCH /api/v1/tasks/:taskId should update task fields (15ms)
  ✔ POST /api/v1/tasks/:taskId/complete should mark task completed (13ms)
  ✔ SECURITY: User B should NOT be able to view User A task (404) (12ms)
  ✔ SECURITY: User B should NOT be able to update User A task (11ms)
  ✔ SECURITY: User B should NOT be able to delete User A task (13ms)
  ✔ DELETE /api/v1/tasks/:taskId should delete task by owner (19ms)

▶ AI Agent Engine & Multi-Step Orchestration Integration Tests
  ✔ POST /api/v1/conversations should create a new conversation (24ms)
  ✔ POST /api/v1/conversations/:id/messages should execute tool create_task via agent loop (107ms)
  ✔ POST /api/v1/conversations/:id/messages should execute list_tasks tool (124ms)
  ✔ POST /api/v1/conversations/:id/messages should handle multi-step planning and create action proposal (52ms)
  ✔ GET /api/v1/agent-runs/:runId/tools should audit executed tools (13ms)
  ✔ POST /api/v1/agent-runs/:runId/proposals/:proposalId/approve should execute proposal atomically (22ms)
  ✔ POST /api/v1/agent-runs/:runId/proposals/:proposalId/approve should reject re-approving executed proposal (12ms)

▶ User Long-Term Memory Integration Tests
  ✔ POST /api/v1/memories should create a memory record (23ms)
  ✔ GET /api/v1/memories should list memories with filtering (18ms)
  ✔ PATCH /api/v1/memories/:memoryId should update memory (13ms)
  ✔ DELETE /api/v1/memories/:memoryId should remove memory (22ms)

▶ Application Security & Penetration Tests
  ✔ SECURITY: SQL Injection in task search should be safely treated as literal parameter (121ms)
  ✔ SECURITY: Protected endpoints without authentication must return 401 Unauthorized (9ms)
  ✔ SECURITY: State-changing cookie requests without CSRF token must return 403 Forbidden (23ms)
  ✔ SECURITY: State-changing cookie requests with mismatched CSRF token must return 403 Forbidden (9ms)
  ✔ SECURITY: Password hashes and session token hashes must not be exposed in user responses (12ms)
  ✔ SECURITY: Rate limiter protects against high-frequency authentication attempts (4392ms)

ℹ tests 38
ℹ suites 6
ℹ pass 38
ℹ fail 0
```
