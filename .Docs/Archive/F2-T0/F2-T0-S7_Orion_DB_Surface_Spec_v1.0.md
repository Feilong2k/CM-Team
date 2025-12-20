# F2-T0-S7 – Orion DB Surface v1.0 Specification

## 1. Overview

This spec defines **Orion’s database access surface** – the small, high‑value set of tools that make it feel like Orion "lives in the database" while preserving safety, testability, and maintainability.

The goals are:
- Minimize the number of tool calls per **logical action** (e.g., "start work on subtask X").
- Expose only domain‑safe, well‑typed mutations for **Features, Tasks, and Subtasks**.
- Keep reads ergonomic for planning (project/feature/task/subtask views) without over-fetching.
- Ensure every change is **transactional** and **logged** in a structured way.

This spec is intended to be implemented as a new subtask (e.g., **F2-T0-S7**), after review.

---
## 2. Domain Model – What’s Mutable

### 2.1 Features & Tasks – Mutable Sections
For **Features** and **Tasks**, Orion may mutate only these logical sections:

- `status` – workflow status (e.g., `pending | in_progress | completed | blocked`).
- `basic_info` – title, short description, optional tags/labels.
- `activity_log` – append‑only, never edited directly; mutations should auto‑log.
- `pcc` – PCC / CDP analysis section.
- `red` – RED analysis section (**features only**).
- `cap` – CAP analysis/plan section.

All other aspects (IDs, relationships like project/feature linkage) are **immutable via Orion**.

### 2.2 Subtasks – Mutable Sections
For **Subtasks**, Orion may mutate only these logical sections:

- `workflow_stage` – high‑level stage (e.g., `orion_planning`, `tara_pcc`, `tara_tests`, `devon_implement`, `devon_refactor`, `tara_review`).
- `status` – `pending | in_progress | completed | blocked`.
- `basic_info` – short summary/title/notes.
- `instruction` – per‑agent instructions (orion/tara/devon) shown in left panel.
- `activity_log` – append‑only, auto‑maintained by tools.
- `pcc` – PCC / CDP analysis for the subtask.
- `tests` – testing plans/results metadata.
- `implementation` – implementation notes/summary.
- `review` – review outcomes and scores.

Again, IDs and structural relationships are **not** mutable via these tools.

---
## 3. High-Level Design Principles

1. **Coarse‑grained tools for common workflows**
   - One tool call should handle multi‑field updates like: update `workflow_stage`, `status`, and `instruction` together.

2. **Strong, small JSON contracts**
   - Each tool receives and returns compact, predictable JSON.
   - Only whitelisted sections can be mutated; no arbitrary field names.

3. **Transactional, logged mutations**
   - Each mutating tool executes in **one DB transaction**.
   - Each successful mutation **appends a structured `activity_log` entry**.

4. **Dual‑ID support**
   - All ID parameters accept either **internal `id`** (integer) or **domain `external_id`** (e.g., `P1-F2-T0-S3`).

5. **Read tools separate from write tools**
   - Read operations never mutate; mutating tools are explicit and auditable.

---
## 4. Tool Set – Reads (Context Loading)

### 4.1 `DatabaseTool_get_subtask_full_context`

**Purpose:** Hydrate everything Orion needs to work on a single subtask in **one call**.

**Input:**
```json
{
  "subtask_id": "P1-F2-T0-S3"  // or numeric id
}
```

**Output (shape example):
```json
{
  "ok": true,
  "subtask": {
    "id": 42,
    "external_id": "P1-F2-T0-S3",
    "title": "Update F2-T0-S3 instructions for .gitignore support and TDD",
    "status": "in_progress",
    "workflow_stage": "tara_pcc",
    "task_id": 7,
    "feature_id": 3,
    "basic_info": { /* ... */ },
    "instruction": {
      "orion": "...",
      "tara": "...",
      "devon": "..."
    },
    "pcc": { /* ... */ },
    "tests": { /* ... */ },
    "implementation": { /* ... */ },
    "review": { /* ... */ },
    "activity_log": [ /* array of structured entries */ ],
    "created_at": "2025-12-18T23:00:00.000Z",
    "updated_at": "2025-12-19T09:00:00.000Z"
  }
}
```

**Error output:**
```json
{
  "ok": false,
  "error": {
    "code": "SUBTASK_NOT_FOUND",
    "message": "Subtask with id/external_id 'P1-F2-T0-S3' not found."
  }
}
```

---

### 4.2 `DatabaseTool_list_subtasks_for_task`

**Purpose:** List all subtasks under a given task, optionally filtered by status.

**Input:**
```json
{
  "task_id": "P1-F2-T0",   // or numeric
  "status": "in_progress", // optional
  "include_details": false  // default false
}
```

**Output (default, `include_details = false`):**
```json
{
  "ok": true,
  "task": {
    "id": 7,
    "external_id": "P1-F2-T0",
    "title": "Task 0 – Foundations"
  },
  "subtasks": [
    {
      "id": 41,
      "external_id": "P1-F2-T0-S1",
      "title": "Chat messages schema",
      "status": "completed",
      "workflow_stage": "done"
    },
    {
      "id": 42,
      "external_id": "P1-F2-T0-S3",
      "title": "Context gitignore support",
      "status": "in_progress",
      "workflow_stage": "tara_pcc"
    }
  ]
}
```

If `include_details = true`, each subtask object **may additionally** include `basic_info` and a small `instruction`/`pcc` summary, but should remain relatively light‑weight.

---

### 4.3 `DatabaseTool_get_feature_overview`

**Purpose:** Lightweight dashboard view for a feature: tasks and subtasks with names + statuses.

**Input:**
```json
{
  "feature_id": "P1-F2"  // or numeric
}
```

**Output:**
```json
{
  "ok": true,
  "feature": {
    "id": 3,
    "external_id": "P1-F2",
    "title": "Feature 2 – Chat & Context",
    "status": "in_progress"
  },
  "tasks": [
    {
      "id": 7,
      "external_id": "P1-F2-T0",
      "title": "Task 0 – Foundations",
      "status": "in_progress",
      "subtasks": [
        {
          "id": 41,
          "external_id": "P1-F2-T0-S1",
          "title": "Chat messages schema",
          "status": "completed"
        },
        {
          "id": 42,
          "external_id": "P1-F2-T0-S3",
          "title": "Context gitignore support",
          "status": "in_progress"
        }
      ]
    }
  ]
}
```

This is intentionally summary‑level. For full details on any subtask, Orion should call `get_subtask_full_context`.

---

### 4.4 `DatabaseTool_get_feature_full_context` (optional, heavier)

**Purpose:** When Orion explicitly needs all details for a feature (e.g., pre‑mortem, audit).

**Input:**
```json
{
  "feature_id": "P1-F2",
  "include_subtask_details": true,
  "status": "in_progress"   // optional filter
}
```

**Output:**
- Same structure as `get_feature_overview`, but if `include_subtask_details = true`, each subtask may include sections like `instruction`, `pcc`, etc.
- This tool is **not** expected to be used frequently; it’s heavy and should be clearly marked as such in docs.

---
## 5. Tool Set – Writes (Mutations)

### 5.1 `DatabaseTool_update_subtask_sections`

**Purpose:** Allow Orion to update multiple logical sections of a subtask in one atomic operation (e.g., status + workflow_stage + instructions), and auto‑log the change.

**Input:**
```json
{
  "subtask_id": "P1-F2-T0-S3",
  "changes": {
    "workflow_stage": "tara_pcc",
    "status": "in_progress",
    "basic_info": {
      "summary": "Tara PCC for gitignore/context tools decisions"
    },
    "instruction": {
      "tara": "Run PCC on gitignore/context tools based on decision record F2-T0-S3.",
      "devon": "Prepare implementation for gitignore-aware context tools after Tara’s PCC."
    },
    "pcc": {
      "latest": { /* optional PCC payload */ }
    }
  },
  "reason": "start_tara_pcc"
}
```

**Allowed keys in `changes` for subtasks:**
- `workflow_stage` (string, from a constrained set)
- `status` (string: `pending | in_progress | completed | blocked`)
- `basic_info` (object)
- `instruction` (object with `orion`/`tara`/`devon` keys)
- `pcc` (object)
- `tests` (object)
- `implementation` (object)
- `review` (object)

Any other keys must be rejected with a structured error.

**Behavior:**
1. Resolve `subtask_id` via dual‑ID helper.
2. In a single transaction:
   - Apply the allowed changes.
   - Append an `activity_log` entry:
     ```json
     {
       "id": "log-<timestamp>",
       "type": "bulk_update",
       "agent": "Orion",
       "content": "Updated workflow_stage to tara_pcc, status to in_progress, instructions, and PCC.",
       "status": "closed",
       "timestamp": "<ISO>",
       "meta": {
         "reason": "start_tara_pcc",
         "changed_sections": ["workflow_stage", "status", "instruction", "pcc"]
       }
     }
     ```
3. Return updated subtask (or at least the changed sections) in the response.

**Output (success):**
```json
{
  "ok": true,
  "subtask": { /* updated subtask or partial */ }
}
```

**Output (error):**
```json
{
  "ok": false,
  "error": {
    "code": "INVALID_CHANGE_KEY",
