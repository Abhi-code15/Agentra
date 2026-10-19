# Agentra — Architecture & Engineering Specification

## 1. System Overview

Agentra is a production-grade Personal AI Productivity Agent built as a modular monolith in Node.js (pure JavaScript ES Modules) and PostgreSQL. It delivers conversational task planning, persistent memory, and safe multi-step tool execution.

```mermaid
graph TD
    User["User Client (React + Vite)"] -->|HTTPS + HttpOnly Cookies| ExpressApp["Express Modular Monolith"]
    ExpressApp -->|Auth & CSRF Middleware| Modules["Application Modules"]

    subgraph "Application Monolith"
        Modules --> AuthModule["Auth (Argon2id + Google OAuth)"]
        Modules --> TaskModule["Task Management Service"]
        Modules --> ConvModule["Conversations & Messages"]
        Modules --> MemoryModule["User Memories Service"]
        Modules --> ProposalModule["Action Proposal & Approval Engine"]
    end

    subgraph "AI Agent Engine"
        ConvModule --> AgentRunner["Bounded Agent Loop Runner"]
        AgentRunner --> ContextBuilder["Context Builder (Sliding Window + Memory Search)"]
        AgentRunner --> ProviderAdapter["AI Provider Adapter (Gemini / OpenAI / Mock)"]
        AgentRunner --> ToolRegistry["Tool Registry (8 Tools + Zod Validation)"]
        ToolRegistry -->|Direct Service Calls| TaskModule
        ToolRegistry -->|Direct Service Calls| MemoryModule
        ToolRegistry -->|Create Pending Proposal| ProposalModule
    end

    subgraph "Persistence Layer"
        Modules -->|pg Pool & Transactions| PostgresDB[("PostgreSQL 16+")]
    end
```

---

## 2. Component Boundaries & Responsibilities

| Component | Directory | Responsibilities |
|---|---|---|
| **Routes** | `src/modules/*/` & `src/routes/` | HTTP paths, middleware attachment (rate limit, auth). |
| **Controllers** | `src/modules/*/*-controller.js` | Parses HTTP requests, validates with Zod, sets cookies, formats JSON. |
| **Services** | `src/modules/*/*-service.js` | Business logic, state transitions, domain invariants. |
| **Repositories** | `src/modules/*/*-repository.js` | Parameterized SQL queries, pagination, count queries. |
| **Context Builder** | `src/ai/context-builder.js` | Bounded sliding window, keyword memory retrieval, untrusted context block injection. |
| **Agent Runner** | `src/ai/agent-runner.js` | Enforces bounded loops (`AGENT_MAX_ROUNDS`), timeouts, audit logging of tool executions. |
| **Tool Registry** | `src/ai/tool-registry.js` | Defines tools, Zod argument schemas, exports Gemini/OpenAI formats, executes via services. |
| **AI Provider** | `src/ai/provider.js` | Isolates external LLM SDKs behind a unified interface (`Gemini`, `OpenAI`, `Mock`). |

---

## 3. The Bounded Agent Execution Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Express as Express API
    participant Runner as Agent Runner
    participant Context as Context Builder
    participant Provider as AI Provider Adapter
    participant Registry as Tool Registry
    participant TaskSvc as Task Service
    participant DB as PostgreSQL

    User->>Express: POST /conversations/:id/messages
    Express->>Runner: run({ user, conversationId, userMessageContent })
    Runner->>DB: INSERT user message & touch conversation
    Runner->>DB: INSERT agent_run (status: 'running')
    Runner->>Context: buildContext(user, conversationId, query)
    Context->>DB: Fetch bounded messages & relevant memories
    Context-->>Runner: { systemPrompt, messages, memories }

    loop Agent Loop (Max 5 Rounds, 30s Timeout)
        Runner->>Provider: generateResponse({ systemPrompt, messages, tools })
        Provider-->>Runner: { content, toolCalls, finishReason }
        
        alt Model requested tool call
            Runner->>DB: INSERT tool_executions (status: 'started')
            Runner->>Registry: executeTool(name, args, userId)
            Registry->>TaskSvc: createTask / listTasks / proposeAction
            TaskSvc->>DB: Execute parameterized SQL / Transaction
            TaskSvc-->>Registry: Result Data
            Registry-->>Runner: toolResult
            Runner->>DB: UPDATE tool_executions (status: 'success')
            Runner->>Runner: Append assistant tool_calls & tool results to context
        else Model returned final answer
            Runner->>DB: INSERT assistant message
            Runner->>DB: UPDATE agent_run (status: 'completed')
        end
    end

    Runner-->>Express: Response payload
    Express-->>User: 200 OK { message, agentRun, tools, proposals }
```

---

## 4. Action Proposals & Sensitive Execution Workflows

To prevent unauthorized or hallucinated bulk modifications:
1. When asked to schedule a multi-task plan, the agent invokes `propose_action`.
2. A pending record is written to `action_proposals` with a 24-hour expiration.
3. The frontend renders an interactive **Action Proposal Card**.
4. The user inspects the proposed schedule and clicks **Approve Plan**.
5. The backend validates proposal ownership, verifies pending and non-expired status, and executes the tasks atomically in a database transaction (`withTransaction`).
6. The proposal transitions to `executed`. Duplicate submissions return a 409 Conflict.
