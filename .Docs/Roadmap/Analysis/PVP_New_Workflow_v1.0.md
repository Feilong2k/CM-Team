# PLAN VERIFICATION PROTOCOL (PVP) REPORT
**Subject:** New Workflow (Orion Context Injection + Step Queue)
**Version:** 1.0
**Date:** 2025-12-16

---

## 1. LIST ACTIONS
**Goal:** Successfully implement a feature using the Orion Orchestrator model.

1.  **Adam:** Generates Implementation Requirements (JSON).
2.  **Orion:** Reads Requirements and generates a list of atomic Steps (The Queue).
3.  **Orion (Loop):** Pops the next `PENDING` step.
4.  **Orion:** Identifies relevant files for the step (Context Gathering).
5.  **Orion:** Reads content of relevant files.
6.  **Orion:** Constructs `Focused Prompt` (Goal + Context + Constraints + JSON Schema).
7.  **Worker (Tara/Devon):** Executes task (Test/Code).
8.  **Worker:** Generates `Structured JSON Reply`.
9.  **Orion:** Parses JSON reply.
10. **Orion:** Updates Queue state (`COMPLETED` | `FAILED` | `BLOCKED`).
11. **Orion:** Repeats loop until Queue empty.

## 2. FIND RESOURCES
*   **Orion Agent:** The orchestrator (needs tools: `read_file`, `write_to_file`, `list_files`, `search_files`).
*   **Worker Agents:** Ephemeral instances (Tara, Devon).
*   **Step Queue:** A persistence mechanism for the plan.
*   **File System:** The Source of Truth for code.
*   **Handover Protocol:** The definition of the JSON schema.

## 3. IDENTIFY GAPS (via CDP) & DATA FLOW
*   **Critical Gap:** **Orion's Memory Persistence.** Solved by DB Persistence.
*   **Gap:** **Context Blind spots.** Solved by CDP-Driven Context.

### Explicit Data Flow Map
1.  **Orion (Orchestrator)** -> Generates Prompt -> **Worker (LLM)**
2.  **Worker** -> Thinks/Acts -> Calls Tool `submit_step_completion` -> **Runtime System**
3.  **Runtime System** -> Writes JSON to -> **DB (`task_steps` table)**
4.  **DB** -> Polled by -> **Orion (Orchestrator)**

*Verification:* This flow ensures no data is lost in "Chat History". All state is persisted to DB immediately via the Tool.

## 4. MAP DEPENDENCIES
1.  **Protocol Definition** (Agent_Handover_Protocol.md) must exist. (DONE)
2.  **Implementation Requirements** must be ready.
3.  **Orion Step Queue** storage location must be defined.

## 5. CHECK INTEGRATION
*   **JSON Schema:** Does the Worker's output match Orion's parser?
    *   *Risk:* LLM adds markdown text *outside* the JSON block.
    *   *Mitigation:* Orion must use a "Robust JSON Extractor" (find `{...}` block).
*   **Context Format:** Does the Worker understand the "Context Files" format provided by Orion?
    *   *Verification:* Use a standard format: `## File: path/to/file \n content`.

## 5.1 VALIDATE TEST SEAMS
*   **Orion Logic:** Can we test Orion's "Queue Manager" without real workers?
    *   *Seam:* Yes, we can mock the "Worker Response" string to test Orion's parsing and queue updating logic.
*   **Worker Logic:** Can we test a Worker's output?
    *   *Seam:* Yes, provide a fixed Prompt and assert the JSON output structure.

## 6. VALIDATE COMPLETENESS
*   The plan covers the full lifecycle from "Requirements" to "Done".
*   The "Blocked" state handles the case where Orion cannot proceed.

## 7. DEFINE VERIFICATION TESTS
1.  **Queue Persistence Test:** Create a queue, crash Orion, restart Orion. Does the queue resume?
2.  **JSON Robustness Test:** Feed Orion malformed JSON (missing quotes, extra text). Does it handle/reject gracefully?
3.  **Context Relevance Test:** Give Orion a vague task ("Fix the modal"). Does it find `Modal.vue`?

---

**Verdict:** The plan is **Verifyable** but requires a **Physical Persistence Strategy** for the Step Queue.
