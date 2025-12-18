# Orion System — MVP Implementation Requirements (Feature-Based, UI-First, Real Aider Integration)

Author: Orion  
For review by Adam and team

---

## Feature 1 — Features/Tasks/Subtasks in DB + UI

**Goal:**  
You can see all Features, Tasks, and Subtasks from your (manual) Final Plan, stored in the DB and fully accessible/manageable in the UI.

### Tasks

**Task 1-1: Define/Reuse Final Plan Markdown Format**
- Define or reuse a simple markdown format for Features/Tasks/Subtasks.
- Output: Example plan file and short doc for Adam.

**Task 1-2: Implement Plan Importer (Script or Endpoint)**
- Reads the plan.
- Writes Features, Tasks, and Subtasks into the DB.

**Task 1-3: Build/Extend Task Board / Tree UI**
- Use or extend `FeatureTree.vue` to show all Features/Tasks/Subtasks from the imported plan.
- Allow viewing and editing status/notes and “Ready/Blocked” on Subtasks.

**Task 1-4: Verification**
- Open Orion in the browser.
- Navigate to a “Tasks” view.
- See Features/Tasks/Subtasks that match your plan, and interact with them (status, notes, ready/blocked).

---

## Feature 2 — Working Orion Chat (DeepSeek/Aider-backed)

**Goal:**  
The chat panel talks to a real LLM (DeepSeek via Aider) and is ready to be used for planning and coordination.

### Tasks

**Task 2-1: Wire `/api/chat` to DeepSeek/Aider**
- Connect backend chat endpoint to DeepSeek/Aider.

**Task 2-2: Integrate ChatPanel.vue / MessageInput.vue**
- Ensure chat UI sends/receives messages from the backend.

**Task 2-3: (Optional) Log Messages to DB**
- Store chat history for future correlation with Tasks/Subtasks.

**Task 2-4: Verification**
- In the app, open the chat.
- Type: “Hi Orion, can you hear me?”
- See a real LLM response.

---

## Feature 3 — Orion ↔ Aider Orchestration for Steps

**Goal:**  
From a Ready Subtask in the UI, Orion can generate Steps, compute context, send them to Aider (Tara/Devon), and track `done/failed/blocked` with escalation.

### Tasks

**Task 3-1: Step Generation Logic**
- Orion breaks each Ready Subtask into a sequence of atomic Steps (following PVP/CDP protocols and `.Docs/Roadmap/Orion_System_PVP_CDP_Findings.md`).
- Each Step includes:
  - Agent role (Tara or Devon)
  - Prompt/instructions (clear, actionable, and context-aware)
  - Context files/resources (from CDP resource mapping)
  - Dependencies (if any)

**Task 3-2: Assignment & Execution**
- Orion assigns each Step to the appropriate Aider agent.
- Orion calls Aider for each Step with the prompt and context.
- Orion tracks the status of each Step (`pending`, `in-progress`, `done`, `failed`, `blocked`).
- If a Step fails or is blocked, Orion attempts to resolve or escalate to a human as needed.
- All results and status changes are written to `task_steps` + `agent_runs`.

**Task 3-3: Step Management UI**
- UI allows you to:
  - See the list of Steps for each Subtask, with their current status.
  - Drill down into Step details (prompt, context, agent, result, error if any).
  - See escalation and resolution paths for blocked/failed Steps.

**Task 3-4: Verification**
- Take a Task in the UI, finalize its Subtasks, mark one as Ready.
- See Steps appear for that Subtask, with all details (prompt, context, agent).
- Watch Steps transition to `done/failed/blocked` as Aider runs.
- See any blocking situations surfaced clearly for human intervention, and track their resolution.
- Run the Task end‑to‑end from first Subtask to last and verify Orion + Aider actually do the work, step by step.

---

## Feature 4 — Execution Summary Dashboard

**Goal:**  
Give you a single place to see where a Task stands from 1st to last Subtask.

### Tasks

**Task 4-1: Build Execution Summary Dashboard UI**
- For each Task, show:
  - Number of Subtasks and their statuses.
  - Number of Steps and their statuses.
- Allow drilldown to see which Steps are blocked/failed.

**Task 4-2: Verification**
- Give Orion a Task, walk through Subtask creation, let Steps run.
- Open the dashboard and see that the Task has progressed from start to finish.

---

## General Notes

- DB tables (`tasks`, `subtasks`, `task_steps`, `agent_runs`, etc.) are introduced incrementally as each Feature needs them.
- All Features are designed to be UI-first: you will always have something concrete to check in the browser after each Feature is implemented.
- No dummy agents: Aider/DeepSeek is used for real work from the start.
- Human-in-the-loop and escalation for blockers are core to the workflow.

---

## Next Steps

- Adam and team review this MVP spec.
- Mark up any changes, reorder Features if needed, or clarify requirements.
- Once agreed, this becomes the implementation contract for MVP.
