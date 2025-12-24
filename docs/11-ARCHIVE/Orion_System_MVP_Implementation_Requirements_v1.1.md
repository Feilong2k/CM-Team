# Orion System — MVP Implementation Requirements v1.1

## 1. Overview
The MVP focuses on **Feature 1: The Orion Orchestration System**.
It builds the **Infrastructure (DB, Tooling, Core)** required to support the future "Self-Driving" workflow.
Crucially, it includes the **"Missing Fundamentals"** identified via Signal Trace & Fractal Analysis (Search Tools, Parsers, CDP Logic).

## 2. Feature Inventory (Tasks)

### Feature 1: Database Infrastructure Setup
**Goal:** Initialize PostgreSQL schema for the workflow.
**Tasks:**
- **Task 1.1:** Create `002_orion_workflow.sql`.
    - `planning_docs` (Drafts, Audits, Final Plans).
    - `tasks` (High-level units of work).
    - `subtasks` (Breakdown of tasks).
    - `task_steps` (Atomic agent instructions).
    - `cdp_resources` (Context files per subtask).
    - `agent_runs` (Execution logs).
- **Task 1.2:** Configure backend connection (`db.js`).

### Feature 2: Orion's "Eyes & Hands" (Tooling)
**Goal:** Equip Orion (and Agents) with the ability to See, Read, and Write.
**Tasks:**
- **Task 2.1:** Implement **Search Tools** (for Planning/CDP).
    - `tools/search_files.js` (recursive grep).
    - `tools/list_files.js` (file tree walker).
- **Task 2.2:** Implement **Context Tools** (for Agents).
    - `tools/retrieve_context.js` (Reads `cdp_resources` from DB).
- **Task 2.3:** Implement **Handover Tools** (for Reporting).
    - `tools/submit_step_completion.js` (Writes to `task_steps`).

### Feature 3: Orion Core Services (The Brain)
**Goal:** The logic that drives the loop.
**Tasks:**
- **Task 3.1:** Implement `OrionCore.js` (Polling Loop).
- **Task 3.2:** Implement `AgentRunner.js` (Aider/LLM Wrapper).
- **Task 3.3:** Implement **Plan Parser** Logic.
    - Logic to convert Markdown Plan -> `tasks`/`subtasks` rows.
- **Task 3.4:** Implement **CDP Discovery** Logic.
    - Logic for Orion to use `search_files` to populate `cdp_resources` before a task starts.

### Feature 4: Chat Integration (The Interface)
**Goal:** Connect the UI to the Brain.
**Tasks:**
- **Task 4.1:** Update `POST /api/chat` to store messages.
- **Task 4.2:** Implement Intent Handlers ("Create Plan", "Execute Plan").

### Feature 5: Verification (The Proof)
**Goal:** Prove the loop is closed.
**Tasks:**
- **Task 5.1:** `verify_orion.js` script.
    - Mocks a Plan -> Parsed to Tasks -> Discovered Context -> Executed Step -> Reported Success.

---

## 3. UI-First Deliverables (Checkpoints)

1.  **After Feature 1:** You can connect to the DB and see the empty tables.
2.  **After Feature 2:** You can run `node tools/search_files.js` and see a file list.
3.  **After Feature 4:** You can chat in the UI and see the message in the DB.
4.  **After Feature 5:** You can run the verification script and see a Green "Success" message.

---

## 4. Known Limitations (MVP)
- **Planning is Manual-Assist:** Orion helps draft, but User must approve.
- **CDP is Level 1:** Discovery is file-based (grep), not semantic.
- **Agents are CLI-Wrapped:** We are wrapping Aider via CLI, not API (as per constraints).
