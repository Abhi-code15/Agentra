# Agentra — Security Architecture & Threat Model

## 1. Authentication & Session Security

- **Argon2id Password Hashing:** Passwords are never stored in plaintext. Argon2id (OWASP recommended) is used with memoryCost: 65,536 KiB, timeCost: 3, parallelism: 1.
- **Opaque Session Tokens:** 32-byte cryptographically random session tokens are generated via `crypto.randomBytes(32).toString('hex')`.
- **Database Token Hashing:** The database stores only the SHA-256 hash of the session token (`sessions.token_hash`). If the database were ever compromised, raw session tokens cannot be extracted.
- **Secure Cookie Transport:** The session token is transmitted in an `HttpOnly`, `SameSite=Lax` cookie (`agentra_session`), preventing JavaScript access and XSS theft.

---

## 2. CSRF (Cross-Site Request Forgery) Defense

For cookie-based authentication, mutating state via `POST`, `PATCH`, `PUT`, and `DELETE` requires double-submit CSRF validation:
1. Upon login, the server sets a matching `agentra_csrf` cookie and sends the CSRF token in the JSON response.
2. The client JavaScript includes the CSRF token in the `X-CSRF-Token` HTTP header.
3. The server middleware (`server/src/middleware/auth.js`) verifies that `req.cookies.agentra_csrf === req.headers['x-csrf-token']`.
4. Requests with missing or forged CSRF headers are immediately rejected with `403 Forbidden`.

---

## 3. Google OAuth 2.0 / OpenID Connect Integrity

- **Cryptographic Server Verification:** Identity tokens received from Google Identity Services are verified using Google's official `google-auth-library` (`OAuth2Client.verifyIdToken`).
- **Claim Enforcement:** Signature, expiration, issuer (`accounts.google.com`), audience (`GOOGLE_CLIENT_ID`), and `email_verified: true` are strictly enforced.
- **Stable Identity Mapping:** External identities are mapped using Google's immutable `sub` claim (`user_identities.provider_subject`), never mutable email strings alone.

---

## 4. SQL Injection Prevention

- Zero dynamic string concatenation for SQL queries.
- 100% of queries use PostgreSQL parameterized placeholders (`$1, $2, ...`) via the official `pg` package.
- Unit and security integration tests specifically test SQL injection payloads (`'; DROP TABLE tasks; --`) to prove that attacks are evaluated as literal parameter strings.

---

## 5. Cross-User Resource Isolation

- Every database query for user-owned resources (`tasks`, `conversations`, `messages`, `memories`, `agent_runs`, `action_proposals`) enforces `WHERE user_id = $1` using the authenticated session user ID.
- Access attempts by User B to User A's resources yield `404 Not Found` to prevent resource discovery and ID enumeration.

---

## 6. Prompt Injection & AI Agent Guardrails

- **Separation of Instructions and Context:** User messages and retrieved long-term memories are clearly demarcated inside an untrusted context block in the system prompt.
- **Tool Execution Allowlisting:** The LLM cannot execute arbitrary SQL queries, shell commands, or unapproved functions. It can only emit structured tool calls for explicitly registered tools in `server/src/ai/tool-registry.js`.
- **Strict Parameter Validation:** Every tool argument is parsed and sanitized through Zod schemas before reaching the service layer.
- **No Self-Privilege Escalation:** The agent loop is bounded by a maximum round counter (`AGENT_MAX_ROUNDS = 5`) and total execution timeout (`AGENT_TOTAL_TIMEOUT_MS = 30000ms`).
- **Human Approval for Bulk / Sensitive Workflows:** Actions altering multiple tasks or schedules require human confirmation through the Action Proposal system before database commitment.

---

## 7. Sensitive Data Redaction in Logs

- The structured JSON logger (`server/src/shared/logger.js`) recursively redacts sensitive keys including `password`, `password_hash`, `token`, `token_hash`, `secret`, `authorization`, `cookie`, `gemini_api_key`, and `openai_api_key`.
