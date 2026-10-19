# Agentra — REST API Contract & Reference

Base URL: `/api/v1`

All responses use standard HTTP status codes and consistent JSON payloads.

---

## 1. Authentication Endpoints

### Register User
- **Endpoint:** `POST /api/v1/auth/register`
- **Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!",
    "displayName": "Alex Johnson",
    "timezone": "America/New_York"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "user": {
      "id": "e587ff90-2857-4e62-8647-e24007b88988",
      "email": "user@example.com",
      "display_name": "Alex Johnson",
      "timezone": "America/New_York",
      "created_at": "2026-10-19T02:00:00.000Z"
    },
    "csrfToken": "...",
    "token": "..."
  }
  ```

### Login
- **Endpoint:** `POST /api/v1/auth/login`
- **Body:** `{ "email": "user@example.com", "password": "Password123!" }`
- **Response (200 OK):** User object + session cookie

### Google Authentication
- **Endpoint:** `POST /api/v1/auth/google`
- **Body:** `{ "credential": "<Google ID Token>" }`
- **Response (200 OK):** User object + session cookie

### Current User Profile
- **Endpoint:** `GET /api/v1/auth/me`
- **Response (200 OK):** `{ "user": { ... }, "csrfToken": "..." }`

### Logout
- **Endpoint:** `POST /api/v1/auth/logout`
- **Response (200 OK):** `{ "message": "Successfully logged out" }`

---

## 2. Tasks Endpoints

### List Tasks
- **Endpoint:** `GET /api/v1/tasks`
- **Query Parameters:**
  - `status`: `pending` | `in_progress` | `completed` | `cancelled`
  - `priority`: `low` | `medium` | `high`
  - `filter`: `all` | `overdue` | `upcoming` | `today`
  - `search`: string
  - `sortBy`: `created_at` | `due_at` | `priority` | `title`
  - `order`: `asc` | `desc`
  - `page`: integer (default 1)
  - `limit`: integer (default 20)
- **Response (200 OK):**
  ```json
  {
    "data": [
      {
        "id": "3b29c91f-0b4a-4e20-9118-490333d98782",
        "title": "Design Database Schema",
        "status": "pending",
        "priority": "high",
        "due_at": "2026-10-20T17:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
  ```

### Create Task
- **Endpoint:** `POST /api/v1/tasks`
- **Body:** `{ "title": "...", "description": "...", "priority": "high", "dueAt": "..." }`
- **Response (201 Created):** `{ "task": { ... } }`

### Update Task
- **Endpoint:** `PATCH /api/v1/tasks/:taskId`
- **Body:** `{ "title": "...", "status": "completed" }`
- **Response (200 OK):** `{ "task": { ... } }`

### Complete Task Shortcut
- **Endpoint:** `POST /api/v1/tasks/:taskId/complete`
- **Response (200 OK):** `{ "task": { "status": "completed", ... } }`

### Delete Task
- **Endpoint:** `DELETE /api/v1/tasks/:taskId`
- **Response (200 OK):** `{ "id": "...", "deleted": true }`

---

## 3. Conversations & AI Agent Endpoints

### List Conversations
- **Endpoint:** `GET /api/v1/conversations`
- **Response (200 OK):** `{ "conversations": [ ... ] }`

### Create Conversation
- **Endpoint:** `POST /api/v1/conversations`
- **Body:** `{ "title": "Sprint Planning" }`
- **Response (201 Created):** `{ "conversation": { ... } }`

### Send Message / Invoke AI Loop
- **Endpoint:** `POST /api/v1/conversations/:conversationId/messages`
- **Body:** `{ "content": "Show my pending tasks and plan tomorrow's schedule" }`
- **Response (200 OK):**
  ```json
  {
    "message": {
      "id": "...",
      "role": "assistant",
      "content": "Here is your plan for tomorrow...",
      "metadata": { "agentRunId": "...", "toolsUsed": ["list_tasks", "propose_action"] }
    },
    "agentRun": { "id": "...", "status": "completed", "promptTokens": 120, "completionTokens": 60 },
    "tools": [ { "toolName": "list_tasks", "status": "success", "result": { ... } } ],
    "proposals": [ { "proposalId": "...", "actionType": "create_tasks_plan", "status": "pending" } ]
  }
  ```

---

## 4. Action Proposals Endpoints

### Approve Proposal
- **Endpoint:** `POST /api/v1/agent-runs/:runId/proposals/:proposalId/approve`
- **Response (200 OK):**
  ```json
  {
    "proposalId": "...",
    "status": "executed",
    "message": "Proposal successfully approved and executed",
    "executedResults": [ { "id": "...", "title": "Morning Standup" } ]
  }
  ```

### Reject Proposal
- **Endpoint:** `POST /api/v1/agent-runs/:runId/proposals/:proposalId/reject`
- **Response (200 OK):** `{ "proposalId": "...", "status": "rejected" }`

---

## 5. Memories Endpoints

- `GET /api/v1/memories`: List user memories
- `POST /api/v1/memories`: Save new memory
- `PATCH /api/v1/memories/:memoryId`: Update memory
- `DELETE /api/v1/memories/:memoryId`: Delete memory
