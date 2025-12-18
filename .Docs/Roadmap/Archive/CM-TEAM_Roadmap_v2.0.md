# CM-TEAM — Roadmap v2.0 (Orion DB-First)

## Vision
A unified platform where **Orion (The Orchestrator)** actively manages **Tara (Test)** and **Devon (Code)** to build software.
The system is **DB-First**, **Stateful**, and **Automated**.

**Key Shift from v1.1:**
- v1.1 was "Manual Control" (User clicks "Run Tara").
- v2.0 is "Orchestrated" (Orion loops through a Step Queue in DB).

---

## Feature 1: The Orion Orchestration System (Infrastructure)
**Goal:** Build the engine that drives the project. This is the prerequisite for all future development.

**Scope:**
1.  **Database Infrastructure:**
    *   Schema for `tasks`, `task_steps`, `cdp_resources`, `agent_runs`.
    *   Setup PostgreSQL connection.
2.  **Tooling Runtime:**
    *   Implement `submit_step_completion` tool (writes to DB).
    *   Implement `retrieve_cdp_context` tool (reads from DB).
3.  **Orion Core (The Polling Agent):**
    *   A script/service that polls `task_steps` for `PENDING` items.
    *   Executes the "Context Injection" logic.
    *   Calls Worker Agents (Simulated or Real).
4.  **Integration:**
    *   Connect "Chat Interface" (from v1.1) to this backend.

**Deliverable:** A running `node` or `python` service that can take a "Step" from the DB, execute it via an Agent, and save the result.

---

## Feature 2: MVP Home Shell (Retrofit & Verification)
**Goal:** Verify the Orion System by having it complete/verify the existing "Feature 0" code.

**Scope:**
1.  **Ingestion:** Convert `Feature0_Requirements.md` into DB Tasks/Steps.
2.  **Execution:** Let Orion "Run" the steps (even if code exists, verify it passes tests).
3.  **UI Updates:** Ensure the Frontend (Vue) correctly displays the new DB-driven state.

---

## Feature 3: Chat with Orion (Project-Scoped)
**Goal:** The interface for the User to talk to the Orchestrator.

**Scope:**
1.  **Chat UI:** Vue component (Retained from v1.1).
2.  **API:** `POST /api/chat` -> Stores msg -> Triggers Orion analysis.
3.  **Context:** Chat is scoped to the active Project.

---

## Feature 4: Plan Breakdown & Visualization
**Goal:** Visualizing the Orion Step Queue.

**Scope:**
1.  **Dashboard:** View `features` -> `tasks` -> `task_steps`.
2.  **Live Updates:** Polling/Socket to show steps turning Green/Red in real-time.
3.  **Manual Overrides:** Buttons to "Retry Step" or "Edit Prompt" (Admin features).

---

## Feature 5: Git & Safety
**Goal:** Version control and concurrency.

**Scope:**
1.  **Git Ops:** Orion commits after every successful Step (or Task).
2.  **Locking:** DB-based concurrency lock (One Orion loop per Project).

---

## Feature 6: Test Runner Integration
**Goal:** Automated Verification.

**Scope:**
1.  **Tara's Test Runner:** A specific "Worker Type" that runs `npm test` and parses output.
2.  **Storage:** Store test results in `agent_runs` table.

---

## Migration Strategy
1.  **Freeze Current Dev:** Stop manual coding on Feature 0.
2.  **Build Feature 1 (Orion):** Manual implementation (User + Cline).
3.  **Resume:** Use Orion to finish the rest.
