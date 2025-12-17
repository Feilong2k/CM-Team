# AGENT HANDOVER PROTOCOL (Orion System)

## Overview

This protocol defines the communication standard between **Orion** (The Orchestrator) and **Worker Agents** (Tara, Devon).

Since Worker Agents act as "Tool Executors" with limited context windows, Orion must:
1.  **Decompose** tasks into atomic, context-rich steps.
2.  **Queue** these steps for execution.
3.  **Consume** structured outputs from Workers to update the Step Queue.

---

## 1. Orion Step Queue Architecture

Orion maintains a **Step Queue** for each Subtask.

### Queue States
*   **PENDING:** Step is generated but not yet assigned.
*   **IN_PROGRESS:** Assigned to a Worker (Tara/Devon).
*   **COMPLETED:** Worker returned `success`.
*   **BLOCKED:** Worker returned `blocked`. Orion must intervene.
*   **FAILED:** Worker returned `failure`. Logic needs fixing.

### Execution Logic
1.  Orion generates all steps for a subtask upfront (e.g., "Step 1: Write Test", "Step 2: Implement Component").
2.  Orion pops the first PENDING step.
3.  Orion gathers context (using tools) relevant to that step.
4.  Orion constructs a **Focused Prompt** for the Worker.
5.  Worker executes and returns a **Structured JSON Reply**.
6.  Orion updates the Queue:
    *   If `success`: Mark COMPLETED, pop next PENDING step.
    *   If `failure`: Mark FAILED, keep step in queue, request fix from Worker.
    *   If `blocked`: Mark BLOCKED, Orion investigates or asks User.

---

## 2. Focused Prompt Structure (Orion -> Worker)

Orion must provide a self-contained context package.

**Template:**
```text
ROLE: [Tara | Devon]
GOAL: [Specific Step Description]
CONTEXT FILES:
- [File A Path]: [Content...]
- [File B Path]: [Content...]

INSTRUCTIONS:
1. [Specific Action 1]
2. [Specific Action 2]

CONSTRAINTS:
- [Strict TDD Rules]
- [No Placeholders]

OUTPUT REQUIREMENT:
You must reply with a valid JSON block inside ```json``` tags.
```

---

## 3. Structured Reply Schema (Worker -> Orion)

Workers **MUST** return this JSON structure at the end of their response.

### JSON Schema

```json
{
  "task_id": "String (e.g., '0-4-1')",
  "step_index": "Number (e.g., 1)",
  "agent": "String ('Tara' or 'Devon')",
  "status": "String ('success', 'failure', 'blocked')",
  "artifacts": [
    "Array of Strings (File paths created/modified)"
  ],
  "summary": "String (Brief description of what was done)",
  "context_for_next_step": "String (Crucial info for the next agent, e.g., 'Modal is empty')",
  "blockers": [
    "Array of Strings (Description of what is blocking progress)"
  ]
}
```

### Examples

**Tara Success:**
```json
{
  "task_id": "0-4-1",
  "step_index": 1,
  "agent": "Tara",
  "status": "success",
  "artifacts": ["frontend/src/components/SubtaskModal.spec.js"],
  "summary": "Created failing test for modal open/close behavior.",
  "context_for_next_step": "Tests expect 'data-testid=subtask-modal' to exist.",
  "blockers": []
}
```

**Devon Blocked:**
```json
{
  "task_id": "0-4-1",
  "step_index": 2,
  "agent": "Devon",
  "status": "blocked",
  "artifacts": [],
  "summary": "Attempted to import Modal but file is missing.",
  "context_for_next_step": "",
  "blockers": ["Cannot find 'EntityModal.vue' in components folder."]
}
```

---

## 4. Handling Failures

*   **Logic Errors (Test Failure):**
    *   Worker returns `status: "failure"`.
    *   Orion sees `failure`, keeps step `IN_PROGRESS` or `FAILED`.
    *   Orion prompts Devon: "Test failed with error X. Fix implementation."
*   **Structural Blocks (Missing File):**
    *   Worker returns `status: "blocked"`.
    *   Orion pauses queue.
    *   Orion uses tools (`ls`, `find`) to locate missing resource or asks User.
