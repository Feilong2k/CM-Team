# CM-TEAM — Feature-Based Roadmap (UI-First) v1.0

## Goal (MVP)
A non-programmer-friendly web app where you can:
- Chat with **Orion** to define a feature.
- See **Projects / Features / Tasks / Subtasks** in a dashboard.
- Manually trigger the workflow steps (Tara tests → Devon implement/refactor → Tara review).
- Persist all project data and chat messages in PostgreSQL.
- Have the backend perform git operations (branch + commit); you will do merges.

## Guiding Constraints
- **UI-first**: every backend capability exists because a UI screen/button needs it.
- **Manual control** for MVP: no automatic orchestration; you click buttons.
- **PostgreSQL is the SSOT**.
- Orion uses **DeepSeek**.
- Tara/Devon run **Aider** locally (no Aider API).

---

## Feature 0 — “MVP Home Shell” (Navigation + Layout)
**User outcome:** You can open the app and clearly see where to go.

UI deliverables:
- Top nav: **Chat**, **Projects**, **Workflow**
- Simple “current project” indicator

Backend deliverables:
- None (UI-only)

Done when:
- You can navigate between 3 screens.

---

## Feature 1 — Chat With Orion (Stored in DB)
**User outcome:** You can chat with Orion; every message is saved and reloads on refresh.

UI deliverables:
- Chat screen:
  - message list (history)
  - text input
  - send button
  - loading indicator

Backend deliverables:
- `POST /api/chat` (user message → Orion/DeepSeek → store both sides → return response)
- `GET /api/chat/history?limit=...` (fetch recent messages)

DB deliverables:
- `chat_threads` (optional for MVP, can start with one default thread)
- `chat_messages` (role=user|orion, content, timestamps)

Done when:
- Refreshing the page shows prior messages.
- A failed DeepSeek call yields a clear error message stored + displayed.

---

## Feature 2 — Projects Screen (Create + Select Project)
**User outcome:** You can create a project and select it as the active context.

UI deliverables:
- Projects list
- “Create project” form (name/description)
- “Select” button

Backend deliverables:
- `POST /api/projects`
- `GET /api/projects`
- `POST /api/projects/:id/select` (or store active project client-side for MVP)

DB deliverables:
- `projects`

Done when:
- You can create projects and see them listed.

---

## Feature 3 — Feature & Task Breakdown (Orion Creates Plan Objects)
**User outcome:** You can ask Orion to break a request into Features/Tasks/Subtasks and save them.

UI deliverables:
- In Chat, a “Create feature plan from this message” action
- Projects screen: view features under a project
- Feature details: list tasks and subtasks

Backend deliverables:
- `POST /api/projects/:id/plan` (input: goal text; output: structured plan)

DB deliverables:
- `features` (belongs to project)
- `tasks` (belongs to feature)
- `subtasks` (belongs to task)

Done when:
- Orion can generate and persist a structured plan you can view in UI.

---

## Feature 4 — Workflow Dashboard (Manual Control)
**User outcome:** You can see workflow status and manually trigger each step.

UI deliverables:
- Workflow screen showing:
  - selected project
  - list of tasks/subtasks
  - status badges
  - buttons:
    - “Run CDP (Orion)”
    - “Request Tests (Tara)”
    - “Request Implement (Devon)”
    - “Request Review (Tara)”

Backend deliverables:
- Endpoints to set status + trigger agent actions:
  - `POST /api/subtasks/:id/run-cdp`
  - `POST /api/subtasks/:id/request-tests`
  - `POST /api/subtasks/:id/request-implement`
  - `POST /api/subtasks/:id/request-review`

DB deliverables:
- status fields + timestamps on `subtasks`

Done when:
- Clicking a button changes the status and logs an event.

---

## Feature 5 — Agent Execution via Aider (Tara / Devon)
**User outcome:** You can trigger Tara/Devon steps; the backend runs Aider and stores results.

UI deliverables:
- Per-subtask “Result” panel (last agent output)
- Clear error display when Aider fails

Backend deliverables:
- Aider runner service (exec + capture stdout/stderr)
- Structured “agent report” ingestion endpoint (internal)

DB deliverables:
- `agent_runs` (who ran, input prompt, output, status, timestamps)

Done when:
- Aider can be invoked, and results are stored and visible.

---

## Feature 6 — Git Operations (Branch + Commit)
**User outcome:** Each agent run can create commits on a task branch; you merge manually.

UI deliverables:
- Show branch name + last commit hash per subtask
- Button: “Create branch for subtask”

Backend deliverables:
- Git service:
  - create branch
  - commit changes
  - log latest commit

DB deliverables:
- store git metadata on subtasks/agent_runs

Done when:
- Running Tara/Devon results in a commit (or a clear error).

---

## Feature 7 — Activity Log (Audit Trail)
**User outcome:** You can see what happened and when.

UI deliverables:
- Activity feed (filter by project/task/subtask)

Backend deliverables:
- `GET /api/activity?projectId=...`

DB deliverables:
- `activity_log`

Done when:
- Every button click + agent run produces a log entry.

---

## Feature 8 — Configuration Screen (MVP)
**User outcome:** You can verify required configuration is present.

UI deliverables:
- “System status” page:
  - DeepSeek key present?
  - Database reachable?
  - Aider available?
  - Git repo configured?

Backend deliverables:
- `GET /api/system/status`

Done when:
- You can see pass/fail checks with human-readable messages.
