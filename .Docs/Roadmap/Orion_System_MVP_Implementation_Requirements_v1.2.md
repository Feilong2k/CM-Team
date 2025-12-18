# Orion System — MVP Implementation Requirements v1.2 (Role-Centric)

## 1. Vision Summary
Build the Orion System layer-by-layer, starting with the **Data Foundation**, then enabling the **Planning Interface**, and finally activating the **Worker Roles** (Tara then Devon).

**Core Philosophy:**
- **UI-First:** Every feature results in a visible UI update.
- **Role-Centric:** We build the "Brain" and "Hands" for each agent specifically.
- **Stateful:** The DB is the Single Source of Truth.

---

## 2. Feature Inventory

### Feature 1: Foundation & Plan Visualization (The SSOT)
**Goal:** We have a DB that stores the Plan, and a UI that displays it.
**Tasks:**
- **Task 1.0 (New):** Database Migration Infrastructure.
    - Create `scripts/migrate.js` to execute SQL files against the DB.
- **Task 1.1:** Database Schema Setup.
    - Create `002_orion_workflow.sql`.
    - Tables: `planning_docs`, `tasks`, `subtasks` (with recursive parent_id), `task_steps`.
- **Task 1.2:** Plan Import Tool.
    - **Subtask 1.2a:** Define "Orion Plan Schema" (Markdown Spec).
    - **Subtask 1.2b:** Install `markdown-it`.
    - Implement script to ingest a Markdown Plan -> DB Rows.
- **Task 1.3:** Plan Viewer UI.
    - **Subtask 1.3a:** Implement `listToTree.js` utility (Flat DB rows -> Tree).
    - **Subtask 1.3b:** Refactor `FeatureTree.vue` to accept `props` instead of importing mock JSON.
    - Component (`PlanViewer.vue`) to visualize the hierarchy.
    - Status badges (Pending/Done).

### Feature 2: Orion Chat & Context (The Planner)
**Goal:** We can talk to Orion, and he has the context to understand the project.
**Tasks:**
- **Task 2.1:** Chat API & Persistence.
    - `POST /api/chat`: Save message, link to Project.
- **Task 2.2:** Context System (The "Eyes").
    - Implement `search_files` and `list_files` tools.
    - Build `ContextBuilder` service that gathers file content for the LLM.
- **Task 2.3:** "Plan This" Intent.
    - Orion can take a user request, use Context Tools to see the code, and generate a Draft Plan entry in DB.

### Feature 3: The Orchestrator & Tara (The Tester)
**Goal:** Orion can break down work and direct Tara to verify it.
**Tasks:**
- **Task 3.1:** Step Generator (Orion Core).
    - Logic to break a `subtask` into atomic `steps` (e.g., "Create Test File").
- **Task 3.2:** Tara's Toolbox.
    - `run_test(path)`: Wraps `npm test`.
    - `read_file(path)`: Read only.
    - `create_file(path)`: For creating test files.
- **Task 3.3:** Agent Runner (Tara Profile).
    - Service to launch Tara with the "Tester" System Prompt + Toolbox.
- **Task 3.4:** Handover Protocol.
    - Implement `submit_step_completion` tool for Tara to report results to DB.

### Feature 4: Devon Integration (The Coder)
**Goal:** Orion can direct Devon to implement solutions.
**Tasks:**
- **Task 4.1:** Devon's Toolbox.
    - `edit_file(path, diff)`: The core coding tool.
    - `delete_file(path)`.
- **Task 4.2:** Agent Runner (Devon Profile).
    - Service to launch Devon with "Implementer" System Prompt + Toolbox.
- **Task 4.3:** Loop Closure.
    - Orion logic: If Tara fails (Red), trigger Devon (Green), then trigger Tara (Refactor/Verify).

### Feature 5: Automation & Safety (The Pipeline)
**Goal:** Professionalize the workflow.
**Tasks:**
- **Task 5.1:** Git Automation.
    - Orion commits to git after every successful Task completion.
- **Task 5.2:** Concurrency Locks.
    - Prevent Tara and Devon from running on the same file simultaneously.

---

## 3. UI Checkpoints

1.  **Feature 1:** Open "Plan" tab -> See the Roadmap tree.
2.  **Feature 2:** Open "Chat" tab -> Ask "What is in src/?" -> Orion lists files.
3.  **Feature 3:** Click "Run Test" on a Subtask -> See Tara wake up, run a test, and the Step turn Green/Red.
4.  **Feature 4:** Click "Implement" -> See Devon edit code -> See Tara run regression.

---

## 4. Fundamental Requirements (Pre-requisites)
- **DeepSeek API Key** (for Orion/Agents).
- **PostgreSQL Database**.
- **Node.js Environment** (for Runner).
