# Orion Database Tools Reference (Feature 2 – DB Surface v1.1)

## Overview

These are the database tools available (or planned) for Orion in TDD_TEAM. They follow a **semantic + safe-SQL** approach:

- **Semantic tools** for common domain operations on:
  - Features
  - Tasks
  - Subtasks
- **Safe-SQL tools** for controlled schema evolution and ad‑hoc reads.

This document is aligned with:
- `F2-T0-S7_Orion_DB_Surface_Spec_v1.1.md`

and assumes:
- A single active project for now (`P1`), with future support for multiple projects via explicit project context.

---
## Tool Calling Convention

Tools are called using the OpenAI function calling format. Each tool name follows the pattern: `DatabaseTool_{action}`.

Example tool call in JSON:
```json
{
  "type": "function",
  "function": {
    "name": "DatabaseTool_get_subtask_full_context",
    "arguments": "{\"subtask_id\": \"2-0-3\"}"
  }
}
```

The **`subtask_id`** here uses shorthand (`"2-0-3"`) which the backend normalizes to a full ID (`P1-F2-T0-S3`) before querying.

---
## ID Resolution & Shorthand

### Dual IDs for Subtasks

Subtasks support two ID forms:

- `id` (integer, primary key) – internal database identifier
- `external_id` (string) – domain identifier, e.g. `P1-F2-T0-S3`

Tools that accept `subtask_id` may take either:
- A numeric id (e.g., `42`), or
- A string external id (full or shorthand).

### External ID Patterns

Full external IDs:
- Project: `P1`
- Feature: `P1-F2`
- Task: `P1-F2-T0`
- Subtask: `P1-F2-T0-S3`

**Shorthand forms** (for human / Orion convenience):
- `"2"` → `P1-F2` (Feature 2 of Project 1)
- `"2-1"` → `P1-F2-T1` (Feature 2, Task 1)
- `"2-0-6"` → `P1-F2-T0-S6` (Feature 2, Task 0, Subtask 6)

Backend behavior:
- Always normalizes shorthand to a full `P{n}-F{n}-T{n}-S{n}` ID using the **current project context**.
- If project context is missing or ambiguous for shorthand, tools must return a clear error (e.g., `MISSING_PROJECT_CONTEXT`) instead of guessing.

**Tip for Orion:** You can safely use shorthand IDs (e.g., `"2-0-6"`) in tool calls. The backend will expand them.

---
## Semantic Tools (Context & Queries)

### 1. Get Subtask by ID (Primitive)
**Tool**: `DatabaseTool_get_subtask_by_id`  
**Description**: Get a specific subtask by its ID.

**Inputs:**
- `subtask_id` (string or number, required)
  - Numeric: internal `id` (e.g., `42`)
  - String: external id, full or shorthand (e.g., `"P1-F2-T0-S3"`, `"2-0-3"`)

**When to use**: Low-level access; prefer `get_subtask_full_context` for orchestration.

---

### 2. Get Subtask Full Context
**Tool**: `DatabaseTool_get_subtask_full_context`  
**Description**: Hydrate everything about a subtask in **one call** (status, workflow_stage, instructions, PCC, tests, implementation, review, activity_log).

**Inputs:**
- `subtask_id` (string or number, required)

**Use Cases:**
- Before planning or modifying a subtask, load its full context once.

---

### 3. List Subtasks for a Task
**Tool**: `DatabaseTool_list_subtasks_for_task`  
**Description**: List all subtasks under a given task, optionally filtered by status.

**Inputs:**
- `task_id` (string or number, required)
  - `"P1-F2-T0"`, `"F2-T0"`, or `"2-0"` (normalized to full ID)
- `status` (string, optional): e.g., `pending`, `in_progress`, `completed`, `blocked`
- `include_details` (boolean, optional, default `false`)

**Use Cases:**
- "Show me all subtasks for Task 0 of Feature 2."
- Filter by `status` to see only pending or in-progress work.

---

### 4. Get Feature Overview
**Tool**: `DatabaseTool_get_feature_overview`  
**Description**: Get a summary for a feature, including tasks and each task’s subtasks (names + statuses only).

**Inputs:**
- `feature_id` (string or number, required)
  - e.g., `"P1-F2"`, `"F2"`, or `"2"`

**Use Cases:**
- Dashboards and planning: "What’s the state of Feature 2?"
- Quickly identify which subtasks are pending vs completed.

---

### 5. Get Feature Full Context (Heavier, Optional)
**Tool**: `DatabaseTool_get_feature_full_context`  
**Description**: Full detail view for a feature, including detailed subtask sections when explicitly requested.

**Inputs:**
- `feature_id` (string or number, required)
- `include_subtask_details` (boolean, optional, default `false`)
- `status` (string, optional): filter subtasks by status

**Use Cases:**
- Deep audits, pre-mortems, or exporting full planning context.

---

### 6. List Subtasks by Status (Global)
**Tool**: `DatabaseTool_list_subtasks_by_status`  
**Description**: List subtasks filtered by status across the project.

**Inputs:**
- `status` (string, required): `pending`, `in_progress`, `completed`, `blocked`
- `limit` (number, optional, default: 50)

**Use Cases:**
- "Show me all pending subtasks."
- "What subtasks are currently in progress?"

---

### 7. Search Subtasks by Keyword
**Tool**: `DatabaseTool_search_subtasks_by_keyword`  
**Description**: Search subtasks by keyword in title or description.

**Inputs:**
- `keyword` (string, required)
- `limit` (number, optional, default: 20)

**Use Cases:**
- "Find all subtasks about database tools."
- When you know the topic but not the ID.

---
## Semantic Tools (Mutations)

### 8. Update Subtask Status (Primitive)
**Tool**: `DatabaseTool_update_subtask_status`  
**Description**: Update a subtask’s status (e.g., from `pending` to `in_progress`).

**Inputs:**
- `subtask_id` (string, required)
- `new_status` (string, required): `pending`, `in_progress`, `completed`, `blocked`

**Note:** For richer updates (status + workflow_stage + instructions), prefer `DatabaseTool_update_subtask_sections`.

---

### 9. Update Subtask Sections (Preferred)
**Tool**: `DatabaseTool_update_subtask_sections`  
**Description**: Atomically update multiple logical sections of a subtask and auto‑log the change.

**Inputs (shape):**
```json
{
  "subtask_id": "2-0-6",  // shorthand ok
  "changes": {
    "workflow_stage": "tara_pcc",
    "status": "in_progress",
    "basic_info": { "summary": "Tara PCC for gitignore/context tools" },
    "instruction": {
      "tara": "Run PCC on gitignore/context tools ...",
      "devon": "Prepare implementation ..."
    },
    "pcc": { "latest": { /* ... */ } }
  },
  "reason": "start_tara_pcc"
}
```

**Allowed keys in `changes`:**
- `workflow_stage`
- `status`
- `basic_info`
- `instruction`
- `pcc`
- `tests`
- `implementation`
- `review`

**Behavior:**
- Normalizes ID → full external_id.
- Applies all changes in one transaction.
- Appends a structured `activity_log` entry (type `bulk_update`).

---

### 10. Update Feature Sections
**Tool**: `DatabaseTool_update_feature_sections`  
**Description**: Atomically update logical sections of a feature.

**Inputs:**
- `feature_id` (string, required)
- `changes` (object): may include `status`, `basic_info`, `pcc`, `red`, `cap`
- `reason` (string, optional)

**Use Cases:**
- After locking decisions for a feature, update PCC/RED/CAP and status.

---

### 11. Update Task Sections
**Tool**: `DatabaseTool_update_task_sections`  
**Description**: Atomically update logical sections of a task.

**Inputs:**
- `task_id` (string, required)
- `changes` (object): may include `status`, `basic_info`, `pcc`, `cap`
- `reason` (string, optional)

**Use Cases:**
- Close a task when all subtasks are done; update PCC/CAP at task level.

---

### 12. Append Subtask Log
**Tool**: `DatabaseTool_append_subtask_log`  
**Description**: Add a log entry to a subtask (audit trail / context).

**Inputs:**
- `subtask_id` (string, required)
- `actor` (string, required): `Orion`, `Tara`, `Devon`, `system`, `user`
- `kind` (string, required): `status_change`, `creation`, `note`, `error`, etc.
- `content` (string, required)
- `meta` (string, optional, JSON-encoded)

**Use Cases:**
- Recording decisions, errors, or status changes in detail.

---

### 13. Update Instructions
**Tool**: `DatabaseTool_update_instructions`  
**Description**: Update `instruction` JSON for a subtask (left panel content).

**Inputs:**
- `subtask_id` (string, required)
- `instructions` (object, required):
  - e.g., `{ "orion": "...", "tara": "...", "devon": "..." }`
- `updated_by` (string, optional): `orion`, `tara`, `devon`, `user` (default `orion`)

**Use Cases:**
- Refine what each agent should do next for a subtask.

---

### 14. Creation Tools (Feature / Task / Subtask)

> **NOTE:** Depending on implementation status, these may be part of F2-T0-S7 or a follow-up subtask.

#### 14.1 `DatabaseTool_create_feature`
- Create a new feature under a project with optional auto-generated `external_id`.

#### 14.2 `DatabaseTool_create_task`
- Create a new task under a feature, with optional auto-generated `external_id`.

#### 14.3 `DatabaseTool_create_subtask`
- Create a new subtask under a task, with optional auto-generated `external_id`.

Common behavior:
- Validate parent existence (project/feature/task).
- Auto-generate `external_id` if omitted, following `P{n}-F{n}-T{n}-S{n}` pattern.
- Append a `creation` entry to `activity_log`.

---
## Structured Storage Tools (Status: Some NOT IMPLEMENTED)

These tools describe *intended* structured storage behavior. As of now, some may not yet be implemented in `DatabaseTool.js` and will throw errors if called.

### 15. Store CDP Analysis
**Tool**: `DatabaseTool_store_cdp_analysis`  
**Status**: **May be unimplemented** – check `DatabaseTool.js` comments.

### 16. Store Test Results
**Tool**: `DatabaseTool_store_test_results`  
**Status**: **May be unimplemented**.

### 17. Store Implementation Details
**Tool**: `DatabaseTool_store_implementation_details`  
**Status**: **May be unimplemented**.

### 18. Store Review Results
**Tool**: `DatabaseTool_store_review`  
**Status**: **May be unimplemented**.

### 19. Get Subtask Analyses
**Tool**: `DatabaseTool_get_subtask_analyses`  
**Status**: Depends on whether `subtask_analyses` table is present.

**Guidance:**
- Prefer using the TDD v2 JSONB fields (`pcc`, `tests`, `implementation`, `review`) where available.
- Treat these tools as **optional** until F2-T0-S7 (or related work) fully wires them in.

---
## Safe-SQL Tools (Controlled Schema Evolution)

### 20. Add Column to Table
**Tool**: `DatabaseTool_add_column_to_table`  
**Description**: Safely add a new column to an existing table.

**Restrictions:**
- Cannot modify protected tables (subtasks, subtask_state, subtask_logs, etc.).
- Cannot remove or modify existing columns.
- Blocked patterns: `DROP`, `TRUNCATE`, `DELETE` without `WHERE`, `ALTER ... DROP`.

---

### 21. Create Table from Migration
**Tool**: `DatabaseTool_create_table_from_migration`  
**Description**: Create a new table from a migration SQL file (`CREATE TABLE` only).

**Restrictions:**
- Only `CREATE TABLE` allowed; no `DROP`/`ALTER`.
- The file must exist and pass safety checks.

---

### 22. List Tables
**Tool**: `DatabaseTool_list_tables`  
**Description**: List all tables in the database.

---

### 23. Safe Query
**Tool**: `DatabaseTool_safe_query`  
**Description**: Execute a safe `SELECT` query.

**Restrictions:**
- Must start with `SELECT`.
- Same blocked patterns as above.

---
## Safety Features

### Blocked Operations
The following operations are completely blocked:
- `DROP TABLE`, `DROP DATABASE`, `DROP SCHEMA`, `DROP INDEX`
- `TRUNCATE TABLE`
- `DELETE FROM table` (without `WHERE` clause)
- `ALTER TABLE ... DROP`

### Protected Tables
Read-only unless using specific semantic tools:
- `subtasks`, `subtask_state`, `subtask_logs`
- `projects`, `tasks`, `features`
- `_migrations`, `agents`, `tools`

### Plan Mode Locking
In Plan mode, no database tools are available. Planning happens without DB mutations.

---
## Error Handling

Common errors and hints:

| Error | Likely Cause | Suggested Action |
|-------|-------------|------------------|
| `Subtask with ID X not found` | Invalid subtask ID | Use `DatabaseTool_search_subtasks_by_keyword` or verify shorthand/project context |
| `Blocked: Dangerous SQL pattern` | Unsafe SQL in `safe_query`/`query` | Use semantic tools instead |
| `Table "X" is protected` | Attempt to modify protected table via raw SQL | Use specific semantic tools (e.g., `update_*_sections`) |
| `Only SELECT queries are allowed` | Tried non-SELECT in `safe_query` | Switch to read-only query or semantic tool |
| `MISSING_PROJECT_CONTEXT` | Shorthand ID used without a known project | Ensure active project is set and retry |

---
## Best Practices for Orion

1. **Prefer semantic tools** (`get_subtask_full_context`, `update_*_sections`, etc.) over raw SQL.
2. **Use shorthand IDs** for convenience, but remember they always map to full project-scoped IDs.
3. **Log important actions** with `DatabaseTool_append_subtask_log` or via `update_*_sections` (which auto-log).
4. **Respect status/ workflow flow** (`pending → in_progress → completed`, with `blocked` as a side path).
5. **Use safe-SQL tools only for schema evolution or special analytics**, not for routine data changes.
6. **Avoid tools flagged as unimplemented** until they’re wired in (see Structured Storage section).

---
*Last updated: 2025-12-19 (Orion DB Surface v1.1)*  
*Aligned with F2-T0-S7_Orion_DB_Surface_Spec_v1.1.md*
