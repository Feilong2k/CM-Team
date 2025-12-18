# CONSTRAINT DISCOVERY PROTOCOL (CDP) REPORT - LEVEL 3
**Subject:** New Workflow (Orion Context Injection + Step Queue)
**Version:** 1.0
**Date:** 2025-12-16

---

## PART 1: ATOMIC ACTIONS
1.  **Orion:** `generate_steps(requirements)` -> Returns List[Step]
2.  **Orion:** `persist_queue(queue)` -> Writes to DB (`task_steps`)
3.  **Orion:** `retrieve_cdp_resources(task_id)` -> Returns List[ResourcePath]
4.  **Orion:** `read_context(resource_paths)` -> Returns List[FileContent]
5.  **Orion:** `construct_prompt(step, context, schema)` -> Returns String
6.  **Worker:** `execute_task(prompt)` -> Returns String (JSON)
6.  **Orion:** `parse_output(worker_response)` -> Returns Dict
7.  **Orion:** `update_queue(status, artifacts)` -> Writes to File/DB

## PART 2: RESOURCES TOUCHED
*   **Step Queue Storage:**
    *   *Action:* Read/Write (High Frequency)
    *   *Note:* Single Source of Truth for progress.
*   **Codebase (File System):**
    *   *Action:* Read (Orion Gathering), Write (Worker Execution)
    *   *Note:* The "World State" that workers modify.
*   **LLM Context Window:**
    *   *Action:* Consumption
    *   *Note:* Limited resource. Orion's "Gathering" must be efficient.

## PART 3: PHYSICAL CONSTRAINTS & MITIGATIONS

### A. Context Window Overflow
*   **Constraint:** Orion cannot dump the *entire* file system into the Worker's prompt.
*   **Risk:** Worker lacks necessary context (e.g., imports, types) and hallucinates.
*   **Mitigation:**
    *   Orion uses `grep` / `find` to locate dependencies.
    *   Orion includes "Skeleton" (headers only) of large dependency files if needed.
    *   **Fallback:** If Worker fails with "Undefined X", Orion adds "X" to context and retries.

### B. Queue Volatility (Memory)
*   **Constraint:** LLM sessions are ephemeral. In-memory variables die with the session.
*   **Risk:** Orion completes Step 1, session crashes, Orion forgets Step 2 exists.
*   **Mitigation:** **Database Queue Persistence.**
    *   Orion writes steps to the `task_steps` table in the DB.
    *   On startup, Orion queries `SELECT * FROM task_steps WHERE status = 'PENDING'`.

### D. Context Blindness
*   **Constraint:** Heuristic searching (`grep`) is unreliable.
*   **Mitigation:** **CDP-Driven Context.**
    *   Orion strictly uses the **Resources Touched** list from the CDP analysis (stored in DB) to define the context.

### C. Tool Availability & Compliance
*   **Constraint:** The runtime must support the `submit_step_completion` tool.
*   **Risk:** Worker tries to "chat" the JSON instead of calling the tool.
*   **Mitigation:**
    *   **System Prompt:** "You MUST use the `submit_step_completion` tool. Do not output JSON text."
    *   **Orion Check:** If Worker returns text but no tool call, Orion rejects the turn and re-prompts: "Please use the tool."

## PART 6: GAP ANALYSIS (Critical)

| Gap | Possible Interpretations | Answer / Resolution |
| :--- | :--- | :--- |
| **How does Orion know what files are relevant?** | A: Magic / B: Heuristics / C: Manual User Input | **Resolution B:** Orion uses keywords from the Step + `grep`. If that fails, it asks the User (Fallback C). |
| **What if a step is too complex for one prompt?** | A: Fail / B: Auto-split | **Resolution A -> B:** Worker returns `blocked`. Orion splits the step into two smaller steps and pushes them to head of Queue. |
| **Global Refactors?** | A: Not supported / B: Supported risky | **Resolution B:** Global refactors are risky in this model. Recommend breaking them into per-file subtasks manually first. |

## PART 7: CONDITIONAL VERDICT

*   **IF** Orion implements **Database Queue Persistence**,
*   **AND** Orion uses **CDP-Driven Context Gathering**,
*   **THEN** the workflow is **SAFE**, **ROBUST**, and **DETERMINISTIC**.

*   **ELSE** (In-memory queue), it is **UNSAFE** (High risk of progress loss).
