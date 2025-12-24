# CM-TEAM — Supporting Technical Details v1.0 (MVP)

This document supports the **feature-based roadmap** and explains the technical shape needed to implement those features.

## 1) System Overview (MVP)
**Frontend (Vue)**
- Screens: Chat, Projects, Workflow, Config/Status
- Talks to backend via HTTP JSON APIs.

**Backend (Express)**
- Hosts APIs.
- Calls DeepSeek for Orion.
- Runs Aider CLI for Tara/Devon.
- Runs git commands for branch/commit.
- Reads/writes all state to PostgreSQL.

**Database (PostgreSQL on VM)**
- Single Source of Truth for:
  - chat messages
  - projects/features/tasks/subtasks
  - agent runs
  - activity log

**User Control (MVP)**
- Manual: you click UI buttons to trigger steps.
- No automatic orchestration / state machine required for MVP.

---

## 2) Data Model (Initial Schema)

### 2.1 projects
Purpose: top-level container.
- id
- name
- description
- created_at

### 2.2 features
Purpose: user-facing deliverables within a project.
- id
- project_id (FK)
- title
- description
- status (draft|active|done|archived)
- created_at

### 2.3 tasks
Purpose: implementation work items under a feature.
- id
- feature_id (FK)
- title
- description
- status (pending|in_progress|blocked|done)
- created_at

### 2.4 subtasks
Purpose: smallest unit that maps to workflow steps and git commits.
- id
- task_id (FK)
- title
- description
- status (pending|ready|tests_requested|tests_done|impl_requested|impl_done|review_requested|review_done|blocked|done)
- current_owner (orion|tara|devon|user)
- branch_name (nullable)
- last_commit_hash (nullable)
- updated_at

### 2.5 chat_threads (optional MVP)
Purpose: allow multiple chats later.
- id
- project_id (nullable)
- title
- created_at

### 2.6 chat_messages
Purpose: store chat history.
- id
- thread_id (nullable)
- role (user|orion)
- content (text)
- metadata_json (jsonb, optional)
- created_at

### 2.7 agent_runs
Purpose: store each agent execution attempt.
- id
- subtask_id (FK)
- agent (orion|tara|devon)
- action (cdp|tests|implement|refactor|review)
- input_prompt (text)
- output_text (text)
- status (success|error)
- started_at
- finished_at

### 2.8 activity_log
Purpose: audit trail.
- id
- project_id (nullable)
- feature_id (nullable)
- task_id (nullable)
- subtask_id (nullable)
- event_type (ui_click|status_change|agent_run|git|error)
- message (text)
- metadata_json (jsonb)
- created_at

**Notes (MVP):**
- Keep status values small and human-readable.
- Orion can evolve schema later (controlled SQL runner).

---

## 3) Backend API Contracts (MVP)

### 3.1 Chat
- POST /api/chat
  - input: { threadId?, message }
  - output: { response, messageIdUser, messageIdOrion }
- GET /api/chat/history
  - input: { threadId?, limit? }
  - output: { messages: [...] }

### 3.2 Projects
- POST /api/projects
- GET /api/projects
- GET /api/projects/:id

### 3.3 Planning
- POST /api/projects/:id/plan
  - input: { goalText }
  - output: { feature, tasks, subtasks }

### 3.4 Workflow (Manual Trigger Endpoints)
- POST /api/subtasks/:id/run-cdp
- POST /api/subtasks/:id/request-tests
- POST /api/subtasks/:id/request-implement
- POST /api/subtasks/:id/request-review

### 3.5 System Status
- GET /api/system/status
  - checks: database reachable, deepseek key present, aider available, git repo configured.

**API Response Convention (recommended):**
- success: { ok: true, data: ... }
- error: { ok: false, error: { code, message, details? } }

---

## 4) Orion / Tara / Devon: Interfaces

### 4.1 OrionAgent (DeepSeek)
Responsibilities:
- respond to chat
- generate structured plan (Feature/Task/Subtask)
- run CDP analysis per subtask (manual trigger)
- propose SQL changes (limited SQL runner)

Inputs:
- user message
- context: last N chat messages + project/task state

Outputs:
- chat response
- optional: JSON plan objects

### 4.2 TaraAgent (Aider - Tests)
Responsibilities:
- generate failing tests
- review implementation (feedback)

Inputs:
- subtask context
- file tree scope (repo path)
- constraints from Orion/Adam

Outputs:
- structured report (what changed, what to run, failures)

### 4.3 DevonAgent (Aider - Implementation)
Responsibilities:
- implement to make tests pass
- refactor

Inputs:
- tests produced by Tara
- subtask acceptance criteria

Outputs:
- structured report (what changed, how to run tests)

---

## 5) Aider Runner (Backend)
MVP approach:
- Backend launches `aider` as a child process.
- Capture stdout/stderr.
- Store output in `agent_runs`.

Constraints:
- Must avoid multiple agents editing same working directory concurrently.
- For MVP, enforce **single active run at a time**.

---

## 6) Git Operations (Backend)
Scope (MVP):
- create branch per subtask
- commit changes with message including IDs

Out of scope (MVP):
- merges (you do it)
- PR automation

Constraints:
- Git operations must run in the correct repo directory.
- Must record branch + commit hash in DB.

---

## 7) UI-First Screen Map

### Chat Screen
- chat history
- send message
- “Create plan from message” button

### Projects Screen
- list projects
- create project
- open project detail

### Workflow Screen
- project → feature → task → subtask list
- per-subtask action buttons
- last run output preview

### Config/Status Screen
- DB reachable
- DeepSeek key present
- Aider configured
- Git repo configured

---

## 8) Minimal Limitations for “Full SQL Access with Some Limitations”
Because Orion can evolve schema, MVP needs guardrails:
- Allow only a safe subset initially:
  - SELECT/INSERT/UPDATE/CREATE TABLE/ALTER TABLE
- Block or require explicit user confirmation for:
  - DROP DATABASE
  - DROP TABLE without backup
  - TRUNCATE
  - GRANT/REVOKE

(Exact policy can be refined during CDP.)
