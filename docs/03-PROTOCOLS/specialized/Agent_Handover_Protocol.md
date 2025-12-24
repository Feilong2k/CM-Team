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
1.  Orion generates all steps for a subtask upfront and **stores them in the DB** (e.g., `task_steps` table).
2.  Orion queries the DB for the next `PENDING` step.
3.  **Context Gathering:** Orion queries the DB for **CDP Resources** linked to this task/subtask to determine which files to load.
4.  Orion constructs a **Focused Prompt** for the Worker.
5.  Worker executes and calls the **Completion Tool** (`submit_step_completion`).
6.  Orion (via DB updates) observes the Queue state change:
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
You must Call the Tool `submit_step_completion` with your JSON result. Do NOT output the JSON in text.
```

---

## 3. Tool Definition: `submit_step_completion`

Workers **MUST** use this tool to report status. This tool writes directly to the Database.

### Schema (JSON)

```json
{
  "name": "submit_step_completion",
  "description": "Submits the result of the assigned step. Updates the DB task_steps table.",
  "parameters": {
    "type": "object",
    "properties": {
      "task_id": { "type": "string", "description": "e.g., '0-4-1'" },
      "step_index": { "type": "number", "description": "e.g., 1" },
      "agent": { "type": "string", "enum": ["Tara", "Devon"] },
      "status": { "type": "string", "enum": ["success", "failure", "blocked"] },
      "artifacts": { 
        "type": "array", 
        "items": { "type": "string" },
        "description": "List of files created or modified"
      },
      "summary": { "type": "string", "description": "Brief description of what was done" },
      "context_for_next_step": { "type": "string", "description": "Info for the next agent" },
      "blockers": { 
        "type": "array", 
        "items": { "type": "string" },
        "description": "Reasons for being blocked"
      }
    },
    "required": ["task_id", "step_index", "agent", "status"]
  }
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
