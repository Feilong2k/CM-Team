# CM-TEAM — Supporting Technical Details v1.1 (MVP)

This document supports the **feature-based roadmap v1.1**.

## v1.1 Change Summary
- Project dropdown + project-scoped data model.
- Explicit MVP decisions added for gaps:
  - Target repo path configuration
  - Aider configuration checks
  - Agent report schema
  - Single-run concurrency lock
  - Test runner + test result storage

---

## 1) System Overview (MVP)

**Frontend (Vue)**
- Screens: Chat, Projects, Workflow, Config/Status
- Global header includes **Project dropdown**.
- Stores `activeProjectId` in client state (persisted locally).

**Backend (Express)**
- Hosts APIs.
- Calls DeepSeek for Orion.
- Runs Aider CLI for Tara/Devon.
- Runs git commands for branch/commit.
- Runs test commands in the **target repo**.
- Reads/writes all state to PostgreSQL.

**Database (PostgreSQL on VM)**
- SSOT for:
  - projects/features/tasks/subtasks
  - chat messages (scoped to project)
  - agent runs (including test runs)
  - activity log
  - runtime lock state (single-run)

---

## 2) Key MVP Decisions (resolving prior gaps)

### 2.1 Target Repo Path (where git + Aider operate)
Decision:
- The system must store exactly one **TARGET_REPO_PATH** for MVP.
- It is configured via the **Config screen**.

Rules:
- Backend validates the path exists and is a git repo.
- All Aider + git + test commands run with working directory = TARGET_REPO_PATH.

### 2.2 Aider Configuration
Decision:
- MVP uses a single Aider configuration on the machine.
- Config screen must verify that:
  - `aider` is available on PATH
  - Aider can start (basic smoke check)

### 2.3 Agent Report Schema (structured output)
Decision:
- Each agent run stores:
  - `output_text` (raw logs)
  - `output_json` (structured summary)

Minimum fields for `output_json`:
- summary
- files_changed (optional)
- commands_to_run (optional)
- notes

UI rendering:
- Always show summary.
- Allow expanding raw logs.

### 2.4 Single-Run Concurrency Lock
Decision:
- MVP enforces **one active run at a time** across Tara/Devon/test runner.

Lock behavior:
- If locked: workflow buttons disabled + UI shows “Agent busy”.
- Lock must be persisted in DB to survive restarts.

### 2.5 Test Runner + Test Result Storage
Decision:
- Tests are executed by backend in the target repo.
- Results are stored as an `agent_runs` row with action = `test_run`.

---

## 3) Data Model (Initial Schema)

### 3.1 projects
- id, name, description, created_at

### 3.2 features
- id, project_id, title, description, status, created_at

### 3.3 tasks
- id, feature_id, title, description, status, created_at

### 3.4 subtasks
- id, task_id, title, description
- status
- current_owner
- branch_name, last_commit_hash
- updated_at

### 3.5 chat_messages (project-scoped)
Recommended MVP approach:
- store `project_id` directly on each message.

Fields:
- id
- project_id
- role
- content
- metadata_json
- created_at

### 3.6 agent_runs (includes tests)
- id
- subtask_id
- agent (orion|tara|devon|system)
- action (cdp|tests|implement|refactor|review|test_run)
- input_prompt
- output_text
- output_json (jsonb)
- status
- started_at, finished_at

### 3.7 activity_log
- project_id
- event_type
- message
- metadata_json
- created_at

### 3.8 system_config
Purpose: store runtime configuration in DB.
- key
- value

Store:
- TARGET_REPO_PATH

### 3.9 runtime_locks
Purpose: store single-run lock.
- name (e.g., "agent_run")
- locked_by
- locked_at

---

## 4) Backend API Contracts (MVP, Project-Scoped)

### 4.1 Projects
- GET /api/projects
- POST /api/projects

### 4.2 Chat
- POST /api/chat  (requires projectId)
- GET /api/chat/history (requires projectId)

### 4.3 Workflow
- GET /api/projects/:id/workflow
- POST /api/subtasks/:id/request-tests
- POST /api/subtasks/:id/request-implement
- POST /api/subtasks/:id/request-review
- POST /api/subtasks/:id/run-tests

### 4.4 Config / Status
- GET /api/system/status
- GET /api/system/config
- POST /api/system/config

---

## 5) Integration Notes
- All operations must carry `projectId` explicitly.
- All repo-changing operations must use TARGET_REPO_PATH.
- Concurrency lock must wrap: aider runs, git operations, test runs.
