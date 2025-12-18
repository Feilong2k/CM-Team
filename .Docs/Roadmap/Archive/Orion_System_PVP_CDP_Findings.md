# Orion System — PVP/CDP Findings v1

Source plan: `.Docs/Roadmap/Orion_System_Task_Inventory_Draft.md`  
Protocols applied: `PlanningWorkflow.md`, `Plan_Verification_Protocol.md` (PVP)  
Context: Orion orchestrates AI worker agents (Tara/Devon) via a DB-first architecture.

---
## 1. Goal & Scope Recap

**Goal:** Implement a “self-driving” software development loop where:
- User requests work via a local web UI (chat with Orion).
- Adam drafts a plan (features & tasks).
- Orion runs **PVP + CDP** audits on the plan and refines it.
- Orion breaks work into **Tasks → Subtasks → Atomic Steps** in PostgreSQL.
- Worker agents execute steps and report results back to the DB.
- User monitors progress via a dashboard.

**This findings file focuses on:**
- Verifying whether Adam’s current Feature/Task inventory can realistically achieve this loop.
- Identifying missing pieces, especially **UI-first** aspects and end-to-end data flow.
- Providing recommendations that will be reflected in a new UI-first implementation roadmap.

---
## 2. LIST ACTIONS (from current draft)

Here we normalize the current Features (1–6) into discrete high-level actions.

### Feature 1: Database Infrastructure Setup
1. Create a new DB migration `002_orion_workflow.sql` that defines:
   - `planning_docs` (id, project_id, title, type=['DRAFT','AUDIT','FINAL'], content_md, status)
   - `tasks` (id, project_id, title, status, linked_plan_id)
   - `subtasks` (id, task_id, title, status)
   - `task_steps` (id, subtask_id, agent_role, prompt, status, artifacts)
   - `cdp_resources` (id, subtask_id, resource_path, access_type)
   - `agent_runs` (id, step_id, agent_name, output_json, timestamp)
2. Run the migration and ensure these tables are available in the dev DB.
3. Update backend DB config (e.g. `db.js`) to expose access to the new tables.
4. (Implicit) Design basic indexes/constraints for performance and integrity.

### Feature 2: Agent Tooling Implementation
5. Implement `submit_step_completion.js` tool that writes step completion results into `task_steps` (and possibly `agent_runs`).
6. Implement `retrieve_context.js` tool that reads context references from `cdp_resources` and resolves them to actual files/resources.
7. Create JSON Tool Definition Schemas so LLM agents know how to call these tools.
8. Integrate these tools with Tara/Devon’s runtime so they MUST use them instead of ad-hoc file/DB writes.

### Feature 3: Aider / LLM Wrapper Service
9. Implement an `AgentRunner` service class (e.g. `AgentRunner.js`).
10. Implement `runAgent(role, contextFiles, prompt)` to:
    - Launch an LLM (or Aider) session for a specific agent role.
    - Provide context files + prompts.
    - Capture outputs and tool calls.
11. Implement stdout/stderr capture and a Tool Call parser (if not provided by the LLM library).
12. (Implicit) Wire AgentRunner to respect CDP-defined context (only see allowed files).

### Feature 4: Orion Core (Polling Loop)
13. Implement `OrionCore.js` as a long-running service.
14. Implement a polling loop that queries `task_steps` for `status = 'PENDING'`.
15. For each pending step, call `AgentRunner` with appropriate role + context.
16. Update `task_steps` (and possibly `agent_runs`) with the results.
17. Handle `BLOCKED` and `FAILED` states with retry/backoff policies.

### Feature 5: Chat API Integration & Planning Intents
18. Update `POST /api/chat` so chat messages are persisted to the DB.
19. Implement an **Intent Classifier** (rule-based or simple ML) to detect planning-related intents (e.g. “create plan”, “execute plan”).
20. Implement a **Create Plan Handler** that writes a plan into `planning_docs` (`type = 'DRAFT'`).
21. Implement an **Execute Plan Handler** that takes the approved plan and creates corresponding records in the `tasks` (and maybe `subtasks`) tables.

### Feature 6: "Hello World" Verification Flow
22. Create `scripts/verify_orion.js`.
23. Script behavior:
    - Insert a mock Task / Step into the DB.
    - Run the Core (polling loop).
    - Assert that the step is processed and output recorded as expected.

### Observed Omissions (from LIST ACTIONS)
24. No explicit actions for **UI views** of: plans, tasks, subtasks, steps, and agent runs.
25. No explicit actions for **PVP/CDP audit automation** (only manual mention in docs).
26. No actions for exposing OrionCore status / worker activity in the dashboard.
27. No actions for seeding or managing **CDP resources** (how `cdp_resources` entries are created/updated).

These gaps will surface strongly in the next PVP steps.

---
## 3. FIND RESOURCES (by action group)

Below is a simplified mapping of required resources for the action groups above.

### DB Infrastructure (Actions 1–4)
- **Resources Needed:**
  - Migration runner (existing backend migration system).
  - PostgreSQL instance & connection configs.
  - Access to current DB schema (to avoid conflicts).
- **Constraints (CDP):**
  - Must align with existing table naming and migration conventions.
  - Must be safe to run on dev environments repeatedly.

### Agent Tooling (Actions 5–8)
- **Resources Needed:**
  - Existing Aider/LLM integration (or chosen LLM client).
  - Node.js runtime for tooling scripts.
  - Access to DB layer (for writing to `task_steps`, `agent_runs`, `cdp_resources`).
- **Constraints (CDP):**
  - Tools must be side-effect-safe and idempotent where possible.
  - Tool definitions must be serializable to JSON for LLM context.

### Aider / LLM Wrapper (Actions 9–12)
- **Resources Needed:**
  - LLM API keys and configuration (e.g. DeepSeek, OpenAI, etc.).
  - File system access for context files.
  - Logging infrastructure.
- **Constraints (CDP):**
  - API rate limits and cost.
  - Need to enforce context limits (token budget).

### Orion Core (Actions 13–17)
- **Resources Needed:**
  - Running Node/JS process (service or worker).
  - DB connection pool.
  - Configuration for poll interval, concurrency, and retry policies.
- **Constraints (CDP):**
  - Must not overload DB (polling frequency & concurrency).
  - Must handle partial failures without corrupting task state.

### Chat API & Planning (Actions 18–21)
- **Resources Needed:**
  - Existing Express (or similar) backend.
  - Frontend chat UI (Vue components like `ChatPanel.vue`, `MessageInput.vue`).
  - ORM or query layer to persist chat and planning docs.
- **Constraints (CDP):**
  - Need a clear schema for how chat messages relate to `planning_docs`.
  - Intent classifier must be simple enough for MVP, but extensible.

### Hello World Verification (Actions 22–23)
- **Resources Needed:**
  - Test harness (node script or test runner like Jest/Vitest).
  - Access to OrionCore service.
- **Constraints (CDP):**
  - Must be runnable in isolation (no external APIs if possible, or mocked).

### Missing Resource Pathways
- **UI Resources:**
  - Vue pages/components for viewing planning docs, tasks, subtasks, steps, and agent runs.
  - Tailwind (already configured) for consistent styling.
- **PVP/CDP Automation:**
  - Scripts or services that actually run PVP/CDP on a given plan and write results to `planning_docs` or a separate findings table.
- **Monitoring/Reporting:**
  - Backend endpoints and UI components for status dashboards.

---
## 4. IDENTIFY GAPS & MAP DATA FLOW

### Intended Data Flow (High-Level)

1. **Planning:**
   - User chats with Orion → `POST /api/chat` → messages stored (TBD: which table) → Orion (LLM) generates **Plan Draft** → stored in `planning_docs (type='DRAFT')`.
2. **Audit & Consensus:**
   - Orion runs **PVP + CDP** on the draft → generates **Findings** and updated roadmap → stored as `planning_docs (type='AUDIT')` and eventually `type='FINAL'`.
3. **Task Breakdown:**
   - From final plan → populate `tasks` → `subtasks` → initial `task_steps`.
4. **Execution:**
   - OrionCore polls `task_steps` (`status='PENDING'`) → calls AgentRunner → agent runs work → writes results to `task_steps` / `agent_runs`.
5. **Monitoring:**
   - UI dashboard pulls from `planning_docs`, `tasks`, `subtasks`, `task_steps`, `agent_runs` and displays progress.

### Gaps in Current Draft

1. **No explicit PVP/CDP execution pipeline**
   - PVP/CDP are described in protocols but not implemented as code or tasks.
   - No table or field defined for storing PVP/CDP findings, except reusing `planning_docs.type=['DRAFT','AUDIT','FINAL']`.

2. **Missing UI actions for each phase**
   - No actions to:
     - Show the drafted plan in the UI.
     - Show PVP/CDP findings in UI.
     - Let the user approve a plan to become `FINAL`.
     - Show tasks/subtasks/steps and their statuses.
     - Show agent runs and logs.

3. **Unclear linkage between chat messages and planning_docs**
   - Tasks mention updating `/api/chat`, but:
     - Where are conversations stored?
     - How are they linked to a specific `planning_docs` record or `project_id`?

4. **No story for `cdp_resources` lifecycle**
   - Table exists in schema, but:
     - How and when are entries created?
     - Which UI (or backend) creates `resource_path` and `access_type` entries per subtask?

5. **No system of record for PVP/CDP state per task/subtask**
   - PVP/CDP is currently only at the plan level; there is no explicit representation of:
     - “This specific Task has passed PVP/CDP.”
     - “This Subtask has a complete set of CDP resources.”

6. **No explicit integration with existing CM-TEAM frontend**
   - Existing Vue components (`ChatPanel.vue`, `FeatureTree.vue`, etc.) are not referenced.
   - Without explicit tasks, implementation may diverge from the current UI style and patterns.

7. **Testing gaps**
   - Hello World verification script is backend-only.
   - No plan for UI tests (e.g. verifying the user can see plans, tasks, and status changes).

---
## 5. MAP DEPENDENCIES

A dependency-aware ordering (still backend-centric) from the draft:

1. **DB Schema (Feature 1)** must exist before anything that reads/writes the new tables.
2. **Agent Tooling (Feature 2)** depends on DB schema and DB access.
3. **AgentRunner (Feature 3)** depends on LLM/Aider configuration but not on `task_steps` schema per se.
4. **OrionCore (Feature 4)** depends on DB schema and AgentRunner.
5. **Chat API & Planning (Feature 5)** depends on DB schema and possibly on having a concept of planning docs.
6. **Hello World Flow (Feature 6)** depends on OrionCore + DB schema.

From a **UI-first** perspective, we want a different ordering:

1. Minimal DB + backend endpoints to support storing and retrieving a single Plan and its Tasks.
2. Simple UI to:
   - Ask Orion for a plan.
   - View and approve a plan.
3. Only after this is working, introduce:
   - Subtasks and atomic steps.
   - OrionCore polling.
   - Worker agents.

This will be reflected in the new roadmap.

---
## 6. CHECK INTEGRATION & TEST SEAMS

### Integration Points

- **Frontend ↔ Backend Chat:**
  - Must agree on payload structure for `/api/chat` (messages, roles, plan IDs).
- **Backend ↔ DB (planning_docs/tasks/etc.):**
  - Must have a clear mapping from domain concepts to tables.
- **OrionCore ↔ AgentRunner:**
  - Must define a stable interface: `runAgent(role, contextFiles, prompt)` and return shape.
- **Agent Tools ↔ DB:**
  - `submit_step_completion` / `retrieve_context` must use consistent schemas.

### Test Seams (per PVP 5.1)

- **Injection Seams:**
  - DB clients should be injectable into OrionCore and AgentRunner (dependency injection) for unit tests.
  - LLM client should be injectable / mockable.
- **Observation Seams:**
  - DB tables (`task_steps`, `agent_runs`) act as observation seams for agent behavior.
  - HTTP endpoints (`/api/chat`, future `/api/plans`, `/api/tasks`) are seams for integration tests.

**Gap:** No explicit plan to structure code for DI/observation seams, but this can be addressed during implementation by following existing backend patterns.

---
## 7. VALIDATE COMPLETENESS vs. Vision

Comparing the draft to the Vision Summary:

- **Planning Phase:** Partially covered (via `/api/chat` + plan creation), but:
  - Missing UI and flow for user to review/approve FINAL plan.
  - PVP/CDP audit is not implemented.

- **Task Breakdown Phase:**
  - Table structure exists, but there’s no explicit mechanism to:
    - Run Level 1 CDP per Task.
    - Generate Subtasks based on CDP.

- **Orchestration & Execution Phases:**
  - OrionCore + AgentRunner + tools are present at a high level.
  - No UI for monitoring or manual intervention.

- **Reporting & Monitoring:**
  - No UI/reporting tasks defined at all.

**Conclusion:**
- The draft defines a **solid backend foundation** for tables and worker orchestration.
- It is **not complete** as a plan for a non-programmer-friendly, UI-first self-driving platform.
- Key missing areas: PVP/CDP automation, lifecycle for CDP resources, and multiple UI surfaces.

---
## 8. DEFINE VERIFICATION TESTS (High-Level)

For each major phase, we define how success is verified.

### Planning
- **Test P1:** User can send a request to Orion (via chat UI) and see a plan appear in the UI.
- **Test P2:** Corresponding `planning_docs` row is created with `type='DRAFT'` and correct content.

### PVP/CDP Audit
- **Test A1:** Trigger audit (button or command) → PVP/CDP runs on selected plan → findings file / view is created.
- **Test A2:** `planning_docs` reflects an `AUDIT` variant or linked findings entry.

### Task Breakdown
- **Test T1:** From a FINAL plan, clicking “Execute Plan” populates `tasks` table.
- **Test T2:** UI shows tasks and their statuses (e.g., Pending, In Progress, Done).

### Subtasks & Atomic Steps
- **Test S1:** Selecting a Task shows Subtasks and associated `task_steps`.
- **Test S2:** CDP resources can be viewed for each Subtask (from `cdp_resources`).

### Execution Loop
- **Test E1 (Hello World):**
  - Insert mock step.
  - Run OrionCore.
  - Verify `task_steps.status` transitions from `PENDING` → `DONE` and `agent_runs` has an entry.
- **Test E2 (UI):**
  - Dashboard updates to show completed step and result.

These tests will be embedded in the new UI-first implementation roadmap as **user-checkable verification steps**.

---
## 9. Recommended Changes (Summary)

1. **Introduce a UI-first phased roadmap**
   - Start with minimal DB + planning UI → then expand to tasks/subtasks → then add agents and automation.

2. **Add explicit tasks for PVP/CDP execution**
   - Implement code that:
     - Runs PVP/CDP on a given `planning_docs` entry.
     - Writes findings to a dedicated file and/or DB row.
     - Surfaces findings in the UI.

3. **Add tasks for plan lifecycle in UI**
   - View Draft Plan, View Audit Findings, Approve to Final, and Execute Plan, all as concrete UI actions for you to click and verify.

4. **Define lifecycle for `cdp_resources`**
   - Add tasks that specify how resources are created/updated when Orion generates Subtasks.

5. **Add monitoring/dashboard features**
   - UI tasks for:
     - Viewing per-task and per-step status.
     - Viewing agent run logs.

6. **Align with existing Vue/Tailwind setup**
   - New tasks should reference and extend existing components (`ChatPanel.vue`, `FeatureTree.vue`, etc.), not reinvent them.

These recommendations are realized in the accompanying **UI-first Implementation Requirements Draft**, which reorganizes work to give you concrete, checkable milestones after each task or phase.
