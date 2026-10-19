# Agentra — Database Entity-Relationship Diagram (ERD)

## 1. Relational Schema Architecture

The database is built on PostgreSQL 16+ using versioned SQL migrations (`server/migrations/`).
All identifiers use `UUID PRIMARY KEY DEFAULT gen_random_uuid()` to prevent enumeration attacks and support distributed architectures.

```mermaid
erDiagram
    users ||--o{ user_identities : "has external OAuth identities"
    users ||--o{ sessions : "has active sessions"
    users ||--o{ tasks : "owns"
    users ||--o{ conversations : "participates in"
    users ||--o{ user_memories : "stores preferences"
    users ||--o{ agent_runs : "triggers"
    users ||--o{ action_proposals : "approves / rejects"
    
    conversations ||--o{ messages : "contains"
    conversations ||--o{ agent_runs : "generates runs"
    agent_runs ||--o{ tool_executions : "executes tools"
    agent_runs ||--o{ action_proposals : "proposes"

    users {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar display_name
        varchar timezone
        timestamptz created_at
        timestamptz updated_at
    }

    user_identities {
        uuid id PK
        uuid user_id FK
        varchar provider
        varchar provider_subject UK
        varchar provider_email
        timestamptz created_at
    }

    sessions {
        uuid id PK
        uuid user_id FK
        varchar token_hash UK
        timestamptz expires_at
        timestamptz created_at
    }

    tasks {
        uuid id PK
        uuid user_id FK
        varchar title
        text description
        varchar status
        varchar priority
        timestamptz due_at
        timestamptz completed_at
        timestamptz created_at
        timestamptz updated_at
    }

    conversations {
        uuid id PK
        uuid user_id FK
        varchar title
        timestamptz created_at
        timestamptz updated_at
    }

    messages {
        uuid id PK
        uuid conversation_id FK
        varchar role
        text content
        jsonb metadata
        timestamptz created_at
    }

    user_memories {
        uuid id PK
        uuid user_id FK
        text content
        varchar category
        varchar source
        timestamptz created_at
        timestamptz updated_at
    }

    agent_runs {
        uuid id PK
        uuid conversation_id FK
        uuid user_id FK
        varchar status
        varchar model
        timestamptz started_at
        timestamptz finished_at
        varchar error_code
        int prompt_tokens
        int completion_tokens
    }

    tool_executions {
        uuid id PK
        uuid agent_run_id FK
        varchar tool_name
        varchar status
        jsonb arguments
        jsonb result_summary
        timestamptz started_at
        timestamptz finished_at
        varchar error_code
    }

    action_proposals {
        uuid id PK
        uuid user_id FK
        uuid agent_run_id FK
        varchar action_type
        jsonb payload
        varchar status
        timestamptz expires_at
        timestamptz approved_at
        timestamptz executed_at
        timestamptz created_at
    }
```

---

## 2. Performance Indexes & Integrity Constraints

1. **Email Normalization:**
   `CREATE UNIQUE INDEX uq_users_email_lower ON users (LOWER(email));`
2. **Session Hash Lookup:**
   `CREATE INDEX idx_sessions_user_id ON sessions (user_id);`
   `CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);`
3. **Task Filters & Sorting:**
   `CREATE INDEX idx_tasks_user_status ON tasks (user_id, status);`
   `CREATE INDEX idx_tasks_user_priority ON tasks (user_id, priority);`
   `CREATE INDEX idx_tasks_user_due_at ON tasks (user_id, due_at);`
   `CREATE INDEX idx_tasks_user_created_at ON tasks (user_id, created_at DESC);`
4. **Chat & Message Pagination:**
   `CREATE INDEX idx_conversations_user_updated ON conversations (user_id, updated_at DESC);`
   `CREATE INDEX idx_messages_conversation_created ON messages (conversation_id, created_at ASC);`
5. **Memory Search:**
   `CREATE INDEX idx_user_memories_user_id ON user_memories (user_id);`
   `CREATE INDEX idx_user_memories_category ON user_memories (user_id, category);`
6. **Audit Logs:**
   `CREATE INDEX idx_agent_runs_conversation ON agent_runs (conversation_id);`
   `CREATE INDEX idx_tool_executions_agent_run ON tool_executions (agent_run_id);`
   `CREATE INDEX idx_action_proposals_user_status ON action_proposals (user_id, status);`
