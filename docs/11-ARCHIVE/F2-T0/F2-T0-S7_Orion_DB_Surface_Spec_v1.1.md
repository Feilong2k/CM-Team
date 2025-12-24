# F2-T0-S7 – Orion DB Surface v1.1 Specification

## 0. Version Note

This is **v1.1** of the Orion DB Surface spec. It is based on:
- `F2-T0-S7_Orion_DB_Surface_Spec_v1.0.md`

and extends it with:
- Explicit **creation tools** for Feature/Task/Subtask (already introduced in v1.0 later revisions).
- A formal **ID normalization & shorthand** model so humans/Orion can use short forms like `2-0-6`, while the backend always works with full project-scoped IDs like `P1-F2-T0-S6`.

---
## 1. Overview

This spec defines **Orion’s database access surface** – the small, high‑value set of tools that make it feel like Orion "lives in the database" while preserving safety, testability, and maintainability.

The goals are:
- Minimize the number of tool calls per **logical action** (e.g., "start work on subtask X").
- Expose only domain‑safe, well‑typed mutations for **Features, Tasks, and Subtasks**.
- Keep reads ergonomic for planning (project/feature/task/subtask views) without over-fetching.
- Ensure every change is **transactional** and **logged** in a structured way.
- Allow **human-friendly shorthand IDs** while keeping the database strictly project-scoped.

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

6. **Central ID normalization**
   - Tools accept **shorthand IDs** (e.g., `2-0-6`) but always normalize them to full `P{n}-F{n}-T{n}-S{n}` using project context before touching the DB.

---
## 4. Tool Set – Reads (Context Loading)

### 4.1 `DatabaseTool_get_subtask_full_context`

**Purpose:** Hydrate everything Orion needs to work on a single subtask in **one call**.

**Input:**
```json
{
  "subtask_id": "P1-F2-T0-S3"  // or shorthand like "2-0-3" or numeric id
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
  "task_id": "P1-F2-T0",   // or shorthand like "2-0" or numeric
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
  "feature_id": "P1-F2"  // or shorthand like "2" or numeric
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
  "feature_id": "P1-F2",             // or shorthand like "2"
  "include_subtask_details": true,
  "status": "in_progress"            // optional filter
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
  "subtask_id": "P1-F2-T0-S3",   // or shorthand like "2-0-3"
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
1. Normalize/resolve `subtask_id` via ID normalizer + dual‑ID helper.
2. In a single transaction:
   - Apply the allowed changes.
   - Append an `activity_log` entry.
3. Return updated subtask (or at least the changed sections) in the response.

---

### 5.2 `DatabaseTool_update_feature_sections`

**Purpose:** Atomically update multiple logical sections of a **feature**.

**Input:**
```json
{
  "feature_id": "P1-F2",   // or shorthand "2"
  "changes": {
    "status": "in_progress",
    "basic_info": {
      "title": "Feature 2 – Chat & Context MVP"
    },
    "pcc": { /* ... */ },
    "red": { /* ... */ },
    "cap": { /* ... */ }
  },
  "reason": "update_after_decision_lock"
}
```

Allowed keys and behavior mirror `update_subtask_sections` (single transaction, logging, etc.).

---

### 5.3 `DatabaseTool_update_task_sections`

**Purpose:** Atomically update multiple logical sections of a **task**.

**Input:**
```json
{
  "task_id": "P1-F2-T0",  // or shorthand "2-0"
  "changes": {
    "status": "completed",
    "basic_info": { /* ... */ },
    "pcc": { /* ... */ },
    "cap": { /* ... */ }
  },
  "reason": "close_task_after_subtasks_done"
}
```

Same transactional + logging behavior.

---
## 6. Interaction Examples

### 6.1 "Start Tara PCC on subtask 2-0-6" (shorthand)

User: _"Orion, let’s start work on **2-0-6** in Tara PCC, and update Tara/Devon instructions to reflect the gitignore/context decisions."_

Orion → tool call:
```json
{
  "subtask_id": "2-0-6",
  "changes": {
    "workflow_stage": "tara_pcc",
    "status": "in_progress",
    "instruction": {
      "tara": "Run PCC against F2-T0-S6 gitignore/context decisions.",
      "devon": "Prepare to implement gitignore-aware context tools after Tara completes PCC."
    }
  },
  "reason": "start_tara_pcc"
}
```

ID normalizer + context (project = `P1`) → `P1-F2-T0-S6`, then mutation proceeds transactionally with logging.

### 6.2 "Review 2-1 and plan it out"

User: _"Orion, review **2-1** and let’s plan it out."_

- `2-1` is normalized to `P1-F2-T1` (Feature 2, Task 1 in Project 1).
- Orion calls `DatabaseTool_get_subtask_full_context` for the relevant subtasks, or `DatabaseTool_get_feature_overview` + filters, depending on how you route the intent.

---
## 7. Acceptance Criteria (Summary)

Same as v1.0, plus:
- All tools that accept `*_id` parameters must:
  - Use the **ID normalizer** to handle shorthand forms like `2`, `2-1`, `2-0-6`.
  - Refuse to guess project if `current_project_id` is missing for shorthand IDs (return a clear `MISSING_PROJECT_CONTEXT` error).
- Creation and mutation tools must **never** create or mutate entities in the wrong project when multiple projects exist.

(For full details on tools, creation flows, and non-goals, see v1.0 + the v1.0 creation tools; v1.1’s primary addition is the shorthand normalization behavior.)

---
## 8. Integration & Update Checklist (for Devon / Orion)

Implementing this spec requires coordinated updates across code and prompt documentation so that:
- The **runtime behavior** (DatabaseTool + registry) matches the spec.
- Orion’s **system prompts and tool references** accurately describe the available tools and shorthand behavior.

### 8.1 Backend Code Integration

The following files/modules must be updated when implementing F2-T0-S7:

1. `backend/tools/DatabaseTool.js`
   - Add implementations for all new tools defined in this spec:
     - `get_subtask_full_context`
     - `list_subtasks_for_task`
     - `get_feature_overview`
     - (optional) `get_feature_full_context`
     - `update_subtask_sections`
     - `update_feature_sections`
     - `update_task_sections`
     - Creation tools (if included in S7 scope):
       - `create_feature`
       - `create_task`
       - `create_subtask`
   - Introduce an **ID normalization helper**, used by all tools that accept IDs:
     - Accepts full IDs (`P1-F2-T0-S6`), mid-level (`F2-T0-S6`), or shorthand (`2-0-6`).
     - Uses the **current project context** (e.g., `P1`) to construct full IDs.
     - Throws a clear error (e.g., `MISSING_PROJECT_CONTEXT`) if shorthand is used without project context.
   - Ensure all mutating tools:
     - Run in a **transaction**.
     - Append appropriate `activity_log` entries.

2. `backend/tools/functionDefinitions.js`
   - Register each new DatabaseTool_* function with accurate:
     - `name` (e.g., `DatabaseTool_get_subtask_full_context`).
     - `parameters` schema (including support for shorthand string IDs).
     - Description fields explaining behavior and shorthand forms.

3. `backend/tools/registry.js`
   - Ensure the new DatabaseTool_* functions are included in the tool registry so Orion can actually call them.

4. Any **test helpers** referencing DatabaseTool
   - Update or add Jest tests around the new methods to validate:
     - ID normalization behavior (full, F2-T0-S6, 2-0-6 forms).
     - Dual-ID support (numeric vs external_id).
     - Transactional semantics and logging.

### 8.2 Prompt & Documentation Integration

1. `.Docs/Prompts/Orion_Database_Tools.md`
   - Update this reference to:
     - List all new tools with their inputs/outputs:
       - `DatabaseTool_get_subtask_full_context`
       - `DatabaseTool_list_subtasks_for_task`
       - `DatabaseTool_get_feature_overview`
       - (optional) `DatabaseTool_get_feature_full_context`
       - `DatabaseTool_update_subtask_sections`
       - `DatabaseTool_update_feature_sections`
       - `DatabaseTool_update_task_sections`
       - `DatabaseTool_create_feature` / `DatabaseTool_create_task` / `DatabaseTool_create_subtask` (if in scope).
     - Explain the **ID normalization and shorthand rules**:
       - Examples: `"2" → P1-F2`, `"2-1" → P1-F2-T1`, `"2-0-6" → P1-F2-T0-S6`.
       - Emphasize that the DB always uses full IDs; shorthand is just input sugar.
     - Call out that `external_id` is **optional** on creation; if omitted, it is auto-generated following the established pattern.

2. `.Docs/Prompts/SystemPrompt_Orion.md`
   - Ensure Orion’s system prompt:
     - Mentions the new DB tools explicitly in the "Available Tools" section.
     - Describes, at a high level, how to:
       - Load full subtask context.
       - List subtasks for a task.
       - Get feature overview.
       - Perform multi-section updates via `update_*_sections`.
     - Clearly states the **shorthand ID convention** and that Orion may use human-friendly forms like `2-0-6` which are normalized by the backend.

3. (Optional) `.Docs/Prompts/OrionPrompts.md`
   - If Orion’s higher-level behavior prompt mentions DB interactions, update to:
     - Encourage use of the **coarse-grained tools** rather than composing low-level primitives.
     - Mention that IDs can be provided in shorthand, but Orion should still think in terms of the full hierarchy (Project → Feature → Task → Subtask).

---
### 8.3 Implementation Notes for Devon

- Treat this spec (v1.1) as the **source of truth** for:
  - Which DatabaseTool methods must exist.
  - What inputs/outputs they support.
  - How IDs are normalized.
- When wiring up tools in `functionDefinitions.js` and `registry.js`, ensure names match exactly (e.g., `DatabaseTool_get_subtask_full_context`).
- Keep `.Docs/Prompts/Orion_Database_Tools.md` and `.Docs/Prompts/SystemPrompt_Orion.md` in sync with the implemented tool set so Orion is never "surprised" by missing or differently-shaped tools.

---
### 8.4 Implementation Notes for Tara

- Add test coverage to:
  - Verify ID normalization logic for a range of inputs (`"P1-F2-T0-S6"`, `"F2-T0-S6"`, `"2-0-6"`).
  - Assert that shorthand forms **fail safely** without project context in a multi-project scenario (once you add that capability).
  - Confirm all `update_*_sections` and creation tools:
    - Run in a single transaction (no partial updates).
    - Append structured `activity_log` entries.
    - Enforce section whitelists (reject unknown keys in `changes`).

Once these code and prompt updates are complete, Orion will:
- Have a clean, ergonomic DB surface.
- Understand exactly which tools exist and how to use shorthand IDs.
- Avoid the pitfalls you’ve experienced with slow, error-prone, multi-step DB operations.
