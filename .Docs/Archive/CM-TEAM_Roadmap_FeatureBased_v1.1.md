# CM-TEAM — Feature-Based Roadmap (UI-First) v1.1

## Goal (MVP)
A non-programmer-friendly web app where you can:
- Chat with **Orion** to define a feature.
- See **Projects / Features / Tasks / Subtasks** in a dashboard.
- Manually trigger the workflow steps (Tara tests → Devon implement/refactor → Tara review).
- Persist all project data and chat messages in PostgreSQL.
- Have the backend perform git operations (branch + commit); you will do merges.

## v1.1 Change Summary
- The UI includes a **Project dropdown** from day one.
- MVP starts with **one project**, but all data access is **project-scoped** to support multiple projects later.
- v1.1 explicitly addresses previously identified “key gaps” by adding concrete MVP features/decisions for:
  - **Target repo path configuration** (where Aider + git operate)
  - **Aider configuration** (how it’s configured and validated)
  - **Agent report schema** (structured output for UI + DB)
  - **Single-run concurrency lock** (prevents repo corruption)
  - **Test runner responsibility** (where/how tests are executed and stored)

## Guiding Constraints
- **UI-first**: every backend capability exists because a UI screen/button needs it.
- **Manual control** for MVP: no automatic orchestration; you click buttons.
- **PostgreSQL is the SSOT**.
- Orion uses **DeepSeek**.
- Tara/Devon run **Aider** locally (no Aider API).

---

## Feature 0 — “MVP Home Shell” (Navigation + Project Dropdown)
**User outcome:** You can open the app, pick a project (only one for now), and clearly see where to go.

UI deliverables:
- Top nav: **Chat**, **Projects**, **Workflow**, **Config**
- **Project dropdown** in the header
  - Shows the active project
  - If only one exists, it is auto-selected
  - Future: switching changes the scope of Chat/Workflow views

Backend deliverables:
- `GET /api/projects` (populate dropdown)
- (Optional MVP) `GET /api/projects/:id`

Done when:
- You can navigate between screens and see/select an active project.

---

## Feature 1 — Chat With Orion (Stored in DB, Project-Scoped)
**User outcome:** You can chat with Orion; messages are saved; chat is tied to the selected project.

UI deliverables:
- Chat screen:
  - message list (history)
  - text input + send
  - loading indicator
  - shows active project in header

Backend deliverables:
- `POST /api/chat` (project-scoped)
- `GET /api/chat/history?projectId=...&limit=...`

DB deliverables:
- `chat_messages` includes `project_id` (directly or via thread)

Done when:
- Refreshing the page shows prior messages **for the selected project**.

---

## Feature 2 — Projects Screen (Create + Select Project)
**User outcome:** You can create a project, and selecting a project updates the dropdown and scopes other screens.

UI deliverables:
- Projects list
- “Create project” form
- “Select” button

Backend deliverables:
- `POST /api/projects`
- `GET /api/projects`

Done when:
- Switching projects changes what Chat/Workflow show (even if only one exists today).

---

## Feature 3 — Feature & Task Breakdown (Orion Creates Plan Objects, Project-Scoped)
**User outcome:** You can ask Orion to break a request into Features/Tasks/Subtasks under the active project.

UI deliverables:
- In Chat: “Create plan from this message” action
- In Projects: view features under selected project
- Feature details: list tasks and subtasks

Backend deliverables:
- `POST /api/projects/:id/plan`

DB deliverables:
- `features` (project_id)
- `tasks` (feature_id)
- `subtasks` (task_id)

Done when:
- Orion generates and persists a structured plan visible in UI.

---

## Feature 4 — Workflow Dashboard (Manual Control, Project-Scoped)
**User outcome:** You can see workflow status for the active project and manually trigger each step.

UI deliverables:
- Workflow screen:
  - active project context
  - list of features/tasks/subtasks
  - status badges
  - buttons:
    - “Run CDP (Orion)”
    - “Request Tests (Tara)”
    - “Request Implement (Devon)”
    - “Request Review (Tara)”

Backend deliverables:
- `GET /api/projects/:id/workflow`
- Trigger endpoints:
  - `POST /api/subtasks/:id/run-cdp`
  - `POST /api/subtasks/:id/request-tests`
  - `POST /api/subtasks/:id/request-implement`
  - `POST /api/subtasks/:id/request-review`

DB deliverables:
- status fields + timestamps on `subtasks`

Done when:
- Clicking a button changes status, and the UI shows it under the active project.

---

## Feature 5 — Agent Execution via Aider (Tara / Devon) + Structured Output
**User outcome:** You can trigger Tara/Devon steps; the backend runs Aider; results are stored and shown in the UI.

UI deliverables:
- Per-subtask “Last run result” panel:
  - status (success/error)
  - summary
  - raw logs (expandable)
  - files changed (if available)

Backend deliverables:
- Aider runner service (exec + capture stdout/stderr)
- **Agent report schema** (structured JSON saved to DB)

DB deliverables:
- `agent_runs` includes:
  - agent
  - action
  - output_text
  - output_json (structured report)

Done when:
- You can run an agent and see structured output + raw logs.

---

## Feature 6 — Git Operations (Branch + Commit)
**User outcome:** Each agent run can create commits on a subtask branch; you merge manually.

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

## Feature 7 — Activity Log (Audit Trail, Project-Scoped)
**User outcome:** You can see what happened and when for the selected project.

UI deliverables:
- Activity feed filtered by active project

Backend deliverables:
- `GET /api/activity?projectId=...`

DB deliverables:
- `activity_log` includes project_id

Done when:
- Every button click + agent run produces a log entry.

---

## Feature 8 — Configuration Screen (MVP)
**User outcome:** You can verify required configuration is present and set core paths/settings.

UI deliverables:
- System status page:
  - DeepSeek key present?
  - Database reachable?
  - Aider available?
  - Git repo configured?
- Config inputs (MVP):
  - **Target Repo Path** (the repo Tara/Devon modify)

Backend deliverables:
- `GET /api/system/status`
- `GET /api/system/config`
- `POST /api/system/config` (save target repo path)

Done when:
- You can set target repo path in UI and see status update.

---

## Feature 9 — Execution Safety (Single-Run Lock)
**User outcome:** You can’t accidentally run Tara and Devon at the same time and corrupt the repo.

UI deliverables:
- When an agent run is active:
  - workflow buttons are disabled
  - UI shows “Agent busy” with which agent/action is running

Backend deliverables:
- Concurrency lock around Aider + git operations

DB deliverables:
- A single lock row (or equivalent) to persist “busy” state

Done when:
- Two rapid clicks cannot start two overlapping runs.

---

## Feature 10 — Test Runner + Test Results Storage
**User outcome:** After Devon implements, you can run tests and see results stored per subtask.

UI deliverables:
- Button: “Run tests” per subtask
- Display last test run:
  - pass/fail
  - output

Backend deliverables:
- Test runner service (exec `npm test` / appropriate command in target repo)
- Store results linked to subtask

DB deliverables:
- store last test run output in `agent_runs` (action=test_run) or a dedicated table

Done when:
- Clicking “Run tests” stores and displays the output.
