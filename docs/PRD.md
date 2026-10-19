# Agentra — Product Requirements Document (PRD)

## 1. Product Identity
- **Product Name:** Agentra
- **Category:** Personal AI Productivity Agent
- **Tagline:** Think. Remember. Plan. Execute.
- **Target Audience:** Developers, knowledge workers, and technical professionals who manage multi-faceted projects and need an AI assistant that actually takes verified actions, remembers context, and proposes structured plans.

---

## 2. Core Functional Requirements

### 2.1 Authentication & Account Management
- Email & password registration and login with Argon2id hashing.
- Google OAuth 2.0 / OpenID Connect token verification with account linking safety.
- Opaque, cryptographically hashed session management stored in PostgreSQL with HttpOnly SameSite cookies.
- Timezone configuration to ensure natural-language dates are accurately scheduled.
- Rate limiting on authentication routes (30 attempts/min).

### 2.2 Task Management
- Full CRUD for tasks: Title, optional description, status (`pending`, `in_progress`, `completed`, `cancelled`), priority (`low`, `medium`, `high`), due date/time (`timestamptz`).
- Filter presets: Overdue, Upcoming, Today, by Status, by Priority.
- Search tasks by keyword in title and description.
- Pagination with customizable page limit.
- Strict cross-user data isolation.

### 2.3 Conversational AI & Workspace
- Multi-conversation persistent history.
- Markdown rendering (bold, code tags, headers, lists, blockquotes).
- Bounded context window: sliding window of recent messages (`AGENT_MAX_CONTEXT_MESSAGES = 20`).
- Tool execution badges showing real-time tool name, status, and outcome.

### 2.4 AI Tool Calling & Safe Execution
- 8 explicitly registered tools in central registry:
  1. `list_tasks`
  2. `get_task`
  3. `create_task`
  4. `update_task`
  5. `complete_task`
  6. `search_conversations`
  7. `get_saved_memories`
  8. `propose_action`
- Strict Zod schema validation on all tool arguments.
- Direct invocation of internal application services (no internal HTTP loops).
- Full audit records persisted in `tool_executions`.

### 2.5 Action Proposals & Approval Workflows
- Multi-task plans and bulk operations create an `action_proposal` with status `pending` and a 24-hour expiration.
- AI presents the proposal in the chat and requests user confirmation.
- User approves or rejects via one-click Action Proposal Card.
- Transactional execution commits all planned tasks atomically.

### 2.6 Long-Term User Memory
- User-controlled context records categorized into `preference`, `goal`, `project`, and `general`.
- Keyword-based context retrieval during chat context construction.
- Full user CRUD control over memories.
