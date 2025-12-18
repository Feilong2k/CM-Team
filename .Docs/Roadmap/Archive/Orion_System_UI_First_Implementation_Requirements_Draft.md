# Orion System — UI-First Implementation Requirements (Draft)

Author: Orion (based on Adam’s draft + PVP/CDP Findings v1)  
Related docs:
- `.Docs/Roadmap/Orion_System_Task_Inventory_Draft.md` (Adam’s original feature inventory)
- `.Docs/Roadmap/Orion_System_PVP_CDP_Findings.md` (PVP/CDP audit)
- `.Docs/Protocols/PlanningWorkflow.md`
- `.Docs/Protocols/Plan_Verification_Protocol.md`

## 0. Purpose & Audience

This document is for **non-programmer stakeholders** and the **engineering team**. It:
- Reorganizes the Orion roadmap into **UI-first, user-visible phases**.
- Ensures that **after each task/phase**, there is a **concrete thing you can see or click** to verify success.
- Stays at the **Task level** (not tiny subtasks) per `PlanningWorkflow.md`.
- Is expected to be refined into `Implementation_Requirements_Final.md` after consensus.

Each task includes:
- **What** (description)
- **Dependencies** (what must exist first)
- **Resources** (files, services, tables)
- **Verification (What you will check in the UI / behavior)**

### MVP Scope (v1)

For the initial MVP:

- The **planning phases (Adam drafting the spec, Orion running PVP/CDP)** will be done **manually**, outside the product UI.
- We assume a **Final Implementation Plan with Tasks (and, optionally, Subtasks)** already exists in markdown.
- Orion’s primary responsibility in MVP is to **take that final plan, persist Tasks/Subtasks/Steps in the DB, and orchestrate/monitor their execution**.
- Automated plan generation and audit (chat-driven planning, auto PVP/CDP) are considered **post-MVP enhancements**.

We also assume:

- The core **UI scaffolding** (chat panel, message input, basic layout) already exists.
- We already have a **good conceptual model for Tasks and Subtasks**; this document focuses on wiring those into a working Orion loop.

---
## Phase 1 — Orion Planning Chat & Plan Viewer (MVP UI)

> Goal: A user can open the Orion UI, chat with Orion, and see a **Draft Plan** rendered in the UI.

### Task 1.1 — Expose Orion Planning Chat in UI

- **What:**
  - Connect the existing frontend chat (Vue) to a backend `/api/chat` endpoint that talks to Orion.
  - Ensure Orion responds and messages are displayed in the chat panel.
- **Dependencies:**
  - Existing Vue app bootstrapped (`frontend/src/main.js`, `App.vue`).
  - Chat UI components: `ChatPanel.vue`, `MessageInput.vue`.
- **Resources:**
  - Frontend: `ChatPanel.vue`, `MessageInput.vue`, `App.vue`.
  - Backend: Express server (`backend/src/server.js` or equivalent), route for `/api/chat`.
- **Verification (UI check):**
  1. Open the app in your browser.
  2. Type a simple message like: “Hi Orion, can you hear me?”
  3. You should see Orion respond in the chat window.

### Task 1.2 — Persist Chat Messages to DB

- **What:**
  - Update `/api/chat` so that each user and Orion message is stored in the DB.
  - Link messages to a `project_id` or "session" so future features can tie chats to plans.
- **Dependencies:**
  - Task 1.1 completed (chat endpoint and UI work end-to-end).
  - DB connection configured in backend.
- **Resources:**
  - Backend DB module.
  - A `chat_messages` table (or equivalent) – can be new or reused.
- **Verification (data + behavior):**
  1. Send a message in the UI.
  2. Use a DB viewer or a simple backend debug endpoint to confirm your message and Orion’s reply are stored.
  3. When you refresh the page and load the same session/project, messages should still be accessible (even if not yet re-rendered in UI).

### Task 1.3 — Implement “Create Plan” Intent in Backend

- **What:**
  - Add simple intent detection so when the user asks for a plan (e.g. “Create an implementation plan for Orion”), the backend:
    - Recognizes this as a **Create Plan** intent.
    - Calls Orion/Adam logic to draft a plan.
    - Writes that plan to the new `planning_docs` table as `type='DRAFT'`.
- **Dependencies:**
  - Phase 1 DB migration for `planning_docs` completed (see Phase 2.1/2.2, which may be interleaved).
  - Task 1.2 (chat persistence) so intents can be linked to a conversation.
- **Resources:**
  - Table: `planning_docs` (id, project_id, title, type, content_md, status).
  - Backend logic for intent classification (can be simple regex for MVP).
- **Verification (non-technical):**
  1. In the UI chat, say: “Orion, please create a technical implementation plan for the Orion system.”
  2. Orion responds with something that looks like a structured plan.
  3. Confirm (via a simple admin view or developer help) that a row exists in `planning_docs` with:
     - `type = 'DRAFT'`
     - `content_md` containing the text of the plan.

### Task 1.4 — Add Plan Viewer UI for Draft Plans

- **What:**
  - Add a simple **Plan Viewer** in the UI that lists existing plans and shows the selected plan’s markdown content.
- **Dependencies:**
  - Task 1.3 (planning_docs are being created).
- **Resources:**
  - New Vue component, e.g. `PlanViewer.vue`.
  - Backend endpoint: `GET /api/plans` and `GET /api/plans/:id`.
- **Verification (UI check):**
  1. Open the Orion UI.
  2. Navigate to a “Plans” or “Roadmaps” section.
  3. You should see your Draft Plan listed.
  4. Click it and see the markdown content rendered (even if plain for now).

---
## Phase 2 — Plan Audit (PVP/CDP) & Approval Flow

> Goal: A user can run PVP/CDP on a plan, inspect findings in the UI, and approve a **Final** plan.

### Task 2.1 — Implement Backend PVP/CDP Execution for a Plan

- **What:**
  - Implement a backend function (service or script) that:
    - Takes a given `planning_docs` row (Draft).
    - Runs **PVP + CDP** logic (can initially be rule-based or partially manual).
    - Writes findings to a new `planning_docs` entry with `type='AUDIT'` or to a dedicated findings table/file.
- **Dependencies:**
  - Task 1.3 (Draft Plan creation working).
  - PVP/CDP protocols understood (`Plan_Verification_Protocol.md`).
- **Resources:**
  - `.Docs/Roadmap/Orion_System_PVP_CDP_Findings.md` as a reference template.
  - Backend service module, e.g. `OrionPlanner.js`.
- **Verification (data-level):**
  1. Trigger PVP/CDP for a known Draft Plan (can be via CLI, temporary endpoint, or UI button from developers initially).
  2. Confirm a new `planning_docs` entry exists with type `AUDIT` containing findings.

### Task 2.2 — Add “Run Audit” Button in UI

- **What:**
  - In the Plan Viewer UI, add a button: **“Run PVP/CDP Audit”** for a Draft Plan.
  - Clicking the button calls an endpoint, e.g. `POST /api/plans/:id/audit`.
- **Dependencies:**
  - Task 2.1 (backend PVP/CDP execution exists).
- **Resources:**
  - Plan Viewer UI.
  - Backend route `POST /api/plans/:id/audit`.
- **Verification (UI check):**
  1. Open a Draft Plan in the UI.
  2. Click “Run PVP/CDP Audit”.
  3. After a short delay, you should see either:
     - An **Audit** version in a list (e.g. “Plan v1 — AUDIT”), or
     - A section in the same view showing findings (e.g. “Gaps & Risks”).

### Task 2.3 — Display Audit Findings Clearly (Non-Technical View)

- **What:**
  - Provide a human-friendly view of audit findings:
    - Gaps
    - Risks
    - Recommended changes
  - Grouped by categories (e.g. UI gaps, backend gaps, testing gaps).
- **Dependencies:**
  - Task 2.1 & 2.2.
- **Resources:**
  - Vue component (e.g. `AuditFindings.vue`).
- **Verification (UI check):**
  1. Open an audited plan.
  2. You should see a clear list: e.g. “UI-first gap: no plan viewer for steps.”
  3. You can scroll through and understand the issues without reading raw markdown.

### Task 2.4 — Approve Final Plan (Plan Lifecycle)

- **What:**
  - Add a UI control to “Approve as Final Plan”.
  - When clicked, backend:
    - Copies the Draft or Audit plan into a `type='FINAL'` entry, or
    - Updates status fields to mark which entry is authoritative.
- **Dependencies:**
  - Display of Draft and Audit versions (Tasks 1.4, 2.3).
- **Resources:**
  - Backend endpoint: `POST /api/plans/:id/approve`.
- **Verification (UI check):**
  1. In the plan view, after reviewing findings, click “Approve as Final Plan”.
  2. You should see that plan now labeled as **Final**.
  3. Future actions (like execution) should clearly indicate they operate on the Final plan.

---
## Phase 3 — Tasks & Basic Task Board (Derived from Final Plan)

> Goal: From a **Final Plan**, automatically create Tasks in the DB and show them in a simple task board UI.

### Task 3.1 — Implement “Execute Plan” Handler (Populate Tasks)

- **What:**
  - Backend handler that:
    - Takes a Final Plan.
    - Parses it into a set of high-level **Tasks** (not subtasks yet).
    - Writes them into the `tasks` table with `status='pending'`.
- **Dependencies:**
  - Task 2.4 (Final Plan exists).
  - DB: `tasks` table from original schema.
- **Resources:**
  - Backend module to parse plan content (e.g. YAML/markdown sections).
- **Verification (data-level + UI):**
  1. Click “Execute Plan” from the Final Plan UI.
  2. Confirm (via DB or simple admin list) that `tasks` table now has records linked to that plan.

### Task 3.2 — Implement Task Board UI

- **What:**
  - UI view that shows the list of Tasks with key fields:
    - Title
    - Status (pending / in progress / done)
  - Can reuse or adapt `FeatureTree.vue` or other components.
- **Dependencies:**
  - Task 3.1 (tasks being created in DB).
- **Resources:**
  - Vue components for lists (e.g. `FeatureTree.vue` as reference).
  - Backend endpoints: `GET /api/plans/:id/tasks`, `PATCH /api/tasks/:id` for status changes.
- **Verification (UI check):**
  1. After executing a plan, navigate to the Task Board.
  2. You should see tasks corresponding to the Final Plan.
  3. You can change a task’s status in the UI and see it updated.

### Task 3.3 — Store and Expose Basic Task Metadata

- **What:**
  - Ensure each Task records:
    - `project_id`
    - `linked_plan_id`
    - Optional owner/assignee (future use)
- **Dependencies:**
  - Task 3.1.
- **Resources:**
  - `tasks` schema, migration if needed.
- **Verification:**
  1. Inspect a Task in the UI (or via a detail view) and confirm you can see which plan it belongs to.

---
## Phase 4 — Subtasks, CDP Resources & Step Overview

> Goal: Before execution, a user can drill into a Task, see Subtasks and associated “Atomic Steps”, plus the resources used (CDP).

### Task 4.1 — Implement CDP (Constraint Discovery) for a Task

- **What:**
  - For a given Task, run CDP logic that:
    - Identifies required resources (files, APIs, env vars).
    - Proposes **Subtasks** to address constraints.
  - Output populates `subtasks` and `cdp_resources` tables.
- **Dependencies:**
  - Task 3.1–3.3 (tasks exist).
  - CDP protocol defined (separate doc or combined with PVP).
- **Resources:**
  - Tables: `subtasks`, `cdp_resources`.
  - Backend service (e.g. `ConstraintDiscoveryService.js`).
- **Verification (data-level):**
  1. Trigger CDP for a Task (button or backend call).
  2. Confirm that `subtasks` and `cdp_resources` now contain entries linked to that Task.

### Task 4.2 — Subtask & Resource Viewer UI

- **What:**
  - UI view where clicking a Task shows:
    - List of Subtasks (title, status).
    - For each Subtask, a list of CDP Resources (paths, access types).
- **Dependencies:**
  - Task 4.1.
- **Resources:**
  - Possibly adapt/extend `FeatureTree.vue` or create a new `TaskDetail.vue`.
- **Verification (UI check):**
  1. In the Task Board, click a Task.
  2. You should see its Subtasks and the resources each will use.

### Task 4.3 — Seed Initial Task Steps (Atomic Steps)

- **What:**
  - When a Subtask is ready to start (no blocking issues), Orion:
    - Reviews the Subtask and its CDP resources.
    - Generates initial `task_steps` entries that represent the atomic steps for agents (e.g. "Write test", "Implement code").
    - Assigns each Step to Tara or Devon based on role.
  - If a blocking issue is detected for a Subtask, Orion first attempts to resolve it (or escalate to a human) **before** generating steps.
- **Dependencies:**
  - Task 4.1 (subtasks exist).
  - Table: `task_steps` from initial schema.
- **Resources:**
  - Backend step-generation logic (`OrionCore` planning side or a separate planner module).
- **Verification (data-level + UI):**
  1. For a given Task, after running CDP and step generation, confirm there are `task_steps` entries linked to its subtasks.
  2. Optionally show a simple step list in the UI (even read-only at first).

---
## Phase 5 — OrionCore Execution Loop & Hello World End-to-End

> Goal: Achieve a complete, minimal loop where a pending Step is picked up by OrionCore, handled by an agent, and the result is visible in the UI.

### Task 5.1 — Implement OrionCore Polling Loop (Backend)

- **What:**
  - Implement `OrionCore.js` that:
    - Periodically queries `task_steps` for `status='PENDING'`.
    - Calls `AgentRunner.runAgent(...)` for each step.
    - Updates `task_steps.status` and writes logs to `agent_runs`.
- **Dependencies:**
  - Task 4.3 (task_steps exist).
  - A basic `AgentRunner` skeleton (Task 5.2).
- **Resources:**
  - Node process (worker or background service).
  - Tables: `task_steps`, `agent_runs`.
- **Verification (backend-level):**
  1. Insert a dummy `task_steps` row marked `PENDING`.
  2. Start OrionCore.
  3. Verify the step moves to `DONE` (or `FAILED`) and `agent_runs` has an entry.

### Task 5.2 — Implement Minimal AgentRunner (Hello World)

- **What:**
  - Implement a very simple `AgentRunner` that does not yet call real Aider/LLMs—just simulates work (e.g. echoing a message or writing a log).
- **Dependencies:**
  - None beyond DB + Node runtime.
- **Resources:**
  - `AgentRunner.js`.
- **Verification:**
  1. When OrionCore calls AgentRunner for a dummy step, AgentRunner writes a known string to `agent_runs.output_json`.

### Task 5.3 — Hello World Script Integration

- **What:**
  - Implement `scripts/verify_orion.js` that:
    - Creates a mock Task, Subtask, and Step.
    - Starts OrionCore (or triggers a cycle).
    - Asserts that the step status transitions and `agent_runs` contains the expected output.
- **Dependencies:**
  - Tasks 5.1 and 5.2.
- **Resources:**
  - Node script + test runner.
- **Verification:**
  1. Run the script from the command line.
  2. It should exit with success and optionally print a human-readable confirmation.

### Task 5.4 — Show Execution Status in UI (Minimal Dashboard)

- **What:**
  - Add a simple **Execution Dashboard** UI where you can see:
    - List of Tasks and whether they are “Not Started / In Progress / Complete”.
    - For a selected Task, a summary of how many steps are done vs pending.
- **Dependencies:**
  - OrionCore + task_steps transitions (Task 5.1).
- **Resources:**
  - Vue component, e.g. `ExecutionDashboard.vue`.
  - Backend endpoints: `GET /api/tasks/:id/summary`, etc.
- **Verification (UI check):**
  1. Trigger the Hello World flow.
  2. Open the dashboard.
  3. You should see counts reflecting the executed step(s).

---
## Phase 6 — Real Agents (Tara/Devon) & CDP-Driven Context

> Goal: Replace the dummy AgentRunner with real agents (Tara/Devon), using CDP resources to drive context, while keeping the UI verifiable.

### Task 6.1 — Integrate Real LLM/Aider into AgentRunner

- **What:**
  - Modify `AgentRunner` so that it can:
    - Launch a real LLM or Aider session for Tara/Devon.
    - Pass `prompt` and `cdp_resources`-based context files.
    - Parse tool calls (`submit_step_completion`, `retrieve_context`).
- **Dependencies:**
  - Phase 5 complete (OrionCore & dummy AgentRunner working).
  - Agent tooling implemented (submit/retrieve).
- **Resources:**
  - Aider/LLM client configuration.
  - Tool schemas for LLM.
- **Verification (controlled run):**
  1. Create a small real step (e.g. “Write a comment to a file”).
  2. Ensure an agent run actually uses the LLM and writes expected output, observable in `agent_runs`.

### Task 6.2 — Enforce CDP-Driven Context Access

- **What:**
  - Ensure AgentRunner only passes files/resources described in `cdp_resources` for a given Subtask.
- **Dependencies:**
  - Task 4.1 and 4.3 (cdp_resources populated and linked to task_steps).
- **Resources:**
  - DB lookup logic in AgentRunner.
- **Verification:**
  1. For a test where CDP only allows 1–2 files, confirm via logs that the agent only sees those files.

### Task 6.3 — UI Enhancements for Transparency

- **What:**
  - In the Task/Step detail view, show:
    - Which Agent ran the step.
    - Which resources were used.
    - A summary of the output.
- **Dependencies:**
  - Real AgentRunner integration.
- **Verification (UI check):**
  1. Drill down into a completed step.
  2. You can see:
     - Agent name (Tara/Devon).
     - List of resource paths.
     - Short output summary.

---
## 7. Summary of Concrete Checkpoints (for You)

Here is a concise list of things **you** can check, phase by phase:

- **Phase 1:**
  - You can chat with Orion and see replies.
  - You can ask for a plan and later open a Plan Viewer and read the Draft Plan.

- **Phase 2:**
  - You can click “Run PVP/CDP Audit” and see clear, human-readable findings.
  - You can click “Approve as Final Plan” and see which plan is Final.

- **Phase 3:**
  - You can click “Execute Plan” and then open a Task Board and see tasks created from the plan.

- **Phase 4:**
  - When you click a Task, you see its Subtasks and their required resources.

- **Phase 5:**
  - You can run a Hello World flow and see Task/Step status updates in a simple dashboard.

- **Phase 6:**
  - You can inspect a real step and see which agent ran it, which files it used, and what it produced.

This UI-first roadmap is intended to be refined into `Implementation_Requirements_Final.md` after you and Adam review the tasks and confirm they are complete and properly ordered.
