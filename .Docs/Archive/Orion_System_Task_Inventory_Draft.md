# Orion System — Feature Inventory Draft (Adam)

## 1. Vision Summary
**Goal:** Create a "Self-Driving" Software Development Platform where AI Agents (Tara & Devon) are orchestrated by a central system (Orion) via a Database-First architecture.

**The Final Product:**
A local web application where:
1.  **Planning Phase:** User chats with **Orion**. Orion invokes **Adam** (Architect) to draft a plan containing **Features** and **Tasks**. Orion performs a PVP/CDP **Audit** (Level 3). User reviews and approves the **Final Plan**.
2.  **Task Breakdown Phase:** Before starting a specific Task, Orion performs a **CDP (Level 1)** analysis on that Task to identify resources and constraints. Based on this, Orion generates **Subtasks**.
3.  **Orchestration Phase:** Orion takes each **Subtask** from the step above and breaks it down into atomic **Steps** (e.g., "Write Test", "Implement Code", "Refactor") stored in PostgreSQL.
4.  **Execution Phase:** **Orion Core** (background service) picks up these atomic **Steps** and launches **Worker Agents** (Tara/Devon) with specific Context (CDP-driven).
5.  **Reporting Phase:** **Worker Agents** (powered by Aider/LLMs) execute the work and report back via Tool Calls directly to the DB.
6.  **Monitoring:** User watches progress live on a dashboard.

**Core Philosophy:**
- **Stateful:** The DB is the Single Source of Truth.
- **Just-in-Time Planning:** Detailed breakdowns happen just before execution.
- **Context-Aware:** Agents only see the files they need (CDP-Driven).

---

## 2. Feature Inventory

### Feature 1: Database Infrastructure Setup
**Description:** Initialize the PostgreSQL schema to support the new workflow.
**Tasks:**
- **Task 1.1:** Create `002_orion_workflow.sql` migration file containing:
    - `planning_docs` (id, project_id, title, type=['DRAFT','AUDIT','FINAL'], content_md, status)
    - `tasks` (id, project_id, title, status, linked_plan_id)
    - `subtasks` (id, task_id, title, status)
    - `task_steps` (id, subtask_id, agent_role, prompt, status, artifacts)
    - `cdp_resources` (id, subtask_id, resource_path, access_type)
    - `agent_runs` (id, step_id, agent_name, output_json, timestamp)
- **Task 1.2:** Update backend `db.js` config to load new schemas.

### Feature 2: Agent Tooling Implementation
**Description:** Create the "Standard Library" of tools that Agents MUST use to communicate with Orion.
**Tasks:**
- **Task 2.1:** Implement `submit_step_completion.js` (Writes result to `task_steps`).
- **Task 2.2:** Implement `retrieve_context.js` (Reads from `cdp_resources`).
- **Task 2.3:** Create Tool Definition Schemas (JSON) for LLM injection.

### Feature 3: Aider / LLM Wrapper Service
**Description:** The "Body" for the Agents. A service that can instantiate an LLM session (or Aider process).
**Tasks:**
- **Task 3.1:** Create `AgentRunner.js` service class.
- **Task 3.2:** Implement `runAgent(role, contextFiles, prompt)` method.
- **Task 3.3:** Implement stdout/stderr capture and Tool Call parser (if not native).

### Feature 4: Orion Core (The Polling Loop)
**Description:** The "Brain" that moves the needle. A continuously running service.
**Tasks:**
- **Task 4.1:** Create `OrionCore.js` service.
- **Task 4.2:** Implement the Polling Loop (`SELECT * FROM task_steps WHERE status = 'PENDING'`).
- **Task 4.3:** Connect Poller to `AgentRunner`.
- **Task 4.4:** Handle "Blocked" and "Failed" states (retry logic).

### Feature 5: Chat API Integration & Planning Intents
**Description:** Connect Frontend to DB and handle the "Planning Workflow" intents.
**Tasks:**
- **Task 5.1:** Update `POST /api/chat` to save messages to DB.
- **Task 5.2:** Implement Intent Classifier (Mocked or simple Regex for MVP).
- **Task 5.3:** Implement "Create Plan" Handler (Drafts `planning_docs`).
- **Task 5.4:** Implement "Execute Plan" Handler (Populates `tasks` table from Final Plan).

### Feature 6: "Hello World" Verification Flow
**Description:** A hardcoded test case to prove the loop works without real AI intelligence.
**Tasks:**
- **Task 6.1:** Create `scripts/verify_orion.js`.
- **Task 6.2:** Script logic: Insert Mock Task -> Insert Mock Step -> Run Core -> Assert Output.

---

## 3. Next Steps (Orion Audit)
1.  **PVP Check:** Verify data flow between `tasks`, `subtasks`, and `steps`.
2.  **CDP Check:** Identify resources for each Feature.
3.  **Refinement:** Finalize this list into `Feature1_Implementation_Requirements.md`.
