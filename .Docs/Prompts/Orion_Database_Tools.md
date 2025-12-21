# Orion Database & Filesystem Tools Reference (Feature 2 – DB Surface v1.1)

## Overview

These are the **database** and **filesystem** tools available to Orion in TDD_TEAM. They follow a **semantic + safe-SQL + safe-FS** approach:

- **Semantic DB tools** for domain operations on:
  - Features
  - Tasks
  - Subtasks
- **Safe-SQL tool** for controlled read-only queries.
- **Filesystem tools** for reading/writing project files and exploring context.

This document is aligned with:
- `F2-T0-S7_Orion_DB_Surface_Spec_v1.1.md`
- Current implementation in `backend/tools/DatabaseTool.js` and `backend/tools/FileSystemTool.js`

Assumptions:
- Single active project for now (`P1`), with future support for multiple projects via explicit project context.

---
## Tool Calling Convention

Tools use OpenAI-style function calling. Each tool name follows the pattern:
- `DatabaseTool_{action}` for DB operations
- `FileSystemTool_{action}` for filesystem operations

Implementation note (F2-T1):
- At runtime, these function calls are routed through a thin **DatabaseToolAgentAdapter** layer.
- The adapter accepts the JSON arguments you provide (plus implicit `context`) and calls the underlying `DatabaseTool` methods with positional parameters.
- From Orion’s perspective, nothing changes: keep using the `DatabaseTool_*` function names and parameter shapes documented here.
- The adapter exists purely to reconcile LLM tool_call shapes with the existing F2-T0 DB surface; it does not alter semantics.

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

The `subtask_id` here uses shorthand (`"2-0-3"`) which the backend normalizes to a full ID (`P1-F2-T0-S3`) before querying.

---
## ID Resolution & Shorthand

### Dual IDs for Subtasks

Subtasks support two ID forms:

- `id` (integer, primary key) – internal database identifier
- `external_id` (string) – domain identifier, e.g. `P1-F2-T0-S3`

Tools that accept `subtask_id`, `task_id`, or `feature_id` may take either:
- A numeric id (e.g., `42`), or
- A string external id (full or shorthand).

### External ID Patterns

Full external IDs:
- Project: `P1`
- Feature: `P1-F2`
- Task: `P1-F2-T0`
- Subtask: `P1-F2-T0-S3`

**Shorthand forms** (for human / Orion convenience):
- `"2"`     → `P1-F2`             (Feature 2 of Project 1)
- `"2-1"`   → `P1-F2-T1`          (Feature 2, Task 1)
- `"2-1-3"` → `P1-F2-T1-S3`       (Feature 2, Task 1, Subtask 3)
- `"2-0-6"` → `P1-F2-T0-S6`       (Feature 2, Task 0, Subtask 6)
- `"F2"`    → `P1-F2`
- `"F2-T1"` → `P1-F2-T1`
- `"F2-T1-S3"` → `P1-F2-T1-S3`

Backend behavior (`DatabaseTool.normalizeId`):
- Normalizes shorthand to full `P{n}-F{n}-T{n}-S{n}` using the **current project context** (default `P1`).
- If project context is missing/ambiguous for shorthand, tools throw `MISSING_PROJECT_CONTEXT` instead of guessing.

**Tip for Orion:** You can safely use shorthand IDs (e.g., `"2-0-6"`, `"2-1-3"`) in tool calls. The backend will expand them.

---
## Semantic DB Tools (Context & Queries)

### 1. Get Subtask Full Context
**Tool**: `DatabaseTool_get_subtask_full_context`  
**Description**: Hydrate everything about a subtask in **one call** (status, workflow_stage, basic_info, instruction, PCC, tests, implementations, review, activity_log).

**Inputs:**
- `subtask_id` (string or number, required)
  - Numeric: internal `id` (e.g., `42`)
  - String: external id, full or shorthand (e.g., `"P1-F2-T0-S3"`, `"2-0-3"`)
- `project_id` (string, optional)
  - Defaults to `P1` when needed for shorthand normalization.

**Use Cases:**
- Before planning or modifying a subtask, load its full context once.

---

### 2. List Subtasks for a Task
**Tool**: `DatabaseTool_list_subtasks_for_task`  
**Description**: List all subtasks under a given task, optionally filtered by status, with optional full details.

**Inputs:**
- `task_id` (string or number, required)
  - `"P1-F2-T0"`, `"F2-T0"`, or `"2-0"` (normalized to full ID)
- `status` (string, optional)
  - `pending`, `in_progress`, `completed`, `blocked`
- `include_details` (boolean, optional, default `false`)
- `project_id` (string, optional)

**Use Cases:**
- "Show me all subtasks for Task 0 of Feature 2."
- Filter by `status` to see only pending or in-progress work.

---

### 3. Get Feature Overview
**Tool**: `DatabaseTool_get_feature_overview`  
**Description**: Get a summary for a feature, including its tasks and each task’s subtasks (names + statuses, plus basic_info for the feature).

**Inputs:**
- `feature_id` (string or number, required)
  - e.g., `"P1-F2"`, `"F2"`, or `"2"`
- `project_id` (string, optional)

**Use Cases:**
- Dashboards and planning: "What’s the state of Feature 2?"
- Quickly identify which subtasks are pending vs completed.

---

### 4. List Subtasks by Status (Global)
**Tool**: `DatabaseTool_list_subtasks_by_status`  
**Description**: List subtasks filtered by status across a project.

**Inputs:**
- `status` (string, required): `pending`, `in_progress`, `completed`, `blocked`
- `limit` (number, optional, default: 50)
- `project_id` (string, optional, default: `P1`)

**Use Cases:**
- "Show me all pending subtasks."
- "What subtasks are currently in progress?"

---

### 5. Search Subtasks by Keyword
**Tool**: `DatabaseTool_search_subtasks_by_keyword`  
**Description**: Search subtasks by keyword in `title` or `basic_info`.

**Inputs:**
- `keyword` (string, required)
- `limit` (number, optional, default: 20)
- `project_id` (string, optional, default: `P1`)

**Use Cases:**
- "Find all subtasks about database tools."
- When you know the topic but not the ID.

---
## Semantic DB Tools (Mutations)

All mutation tools:
- Normalize IDs (shorthand → full external_id).
- Run in a transaction.
- Append entries to the **unified activity log** (`unified_activity_logs`) and, where applicable, `subtask_activity_logs`.

### 6. Update Subtask Sections (Preferred)
**Tool**: `DatabaseTool_update_subtask_sections`  
**Description**: Atomically update multiple logical sections of a subtask and log the change.

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
- `implementation` (mapped to `implementations` column)
- `review`

**Behavior:**
- Normalizes `subtask_id` → full external_id if needed.
- Resolves to internal `id` (numeric) before update.
- Applies all changes in one transaction.
- Writes to `subtask_activity_logs` + unified `unified_activity_logs` (`type: bulk_update`).

---

### 7. Update Feature Sections
**Tool**: `DatabaseTool_update_feature_sections`  
**Description**: Atomically update logical sections of a feature.

**Inputs:**
- `feature_id` (string, required)
  - e.g., `"P1-F2"`, `"F2"`, or `"2"`
- `changes` (object, required): may include
  - `status`
  - `basic_info`
  - `pcc`
  - `pvp_analysis` (CAP)
  - `fap_analysis` (RED)
  - `activity_log`
- `reason` (string, optional)

**Behavior:**
- Normalizes/ resolves feature ID.
- Applies updates in one transaction.
- Appends a unified activity log entry (`type: bulk_update`).

---

### 8. Update Task Sections
**Tool**: `DatabaseTool_update_task_sections`  
**Description**: Atomically update logical sections of a task.

**Inputs:**
- `task_id` (string, required)
  - e.g., `"P1-F2-T0"`, `"F2-T0"`, or `"2-0"`
- `changes` (object, required): may include
  - `status`
  - `basic_info`
  - `pcc`
  - `pvp_analysis` (CAP)
  - `activity_log`
- `reason` (string, optional)

**Behavior:**
- Normalizes/ resolves task ID.
- Applies updates in one transaction.
- Appends a unified activity log entry (`type: bulk_update`).

---

### 9. Creation Tools (Feature / Task / Subtask)

These are **implemented** and log to unified activity logs (and subtask logs where applicable).

#### 9.1 `DatabaseTool_create_feature`
- Create a new feature under a project.
- **Inputs:**
  - `project_id` (string, required) – e.g., `"P1"`.
  - `external_id` (string, optional) – if omitted, auto-generates `P1-F{n}`.
  - `title` (string, required).
  - `status` (string, optional; default `pending`).
  - `basic_info` (object, optional).
  - `pcc` (object, optional).
  - `cap` (object, optional) → stored as `pvp_analysis`.
  - `red` (object, optional) → stored as `fap_analysis`.
  - `reason` (string, optional) – for activity log.
- **Behavior:**
  - Inserts into `features` with `project_id` and JSONB sections.
  - Logs a `creation` entry in unified activity log.

#### 9.2 `DatabaseTool_create_task`
- Create a new task under a feature.
- **Inputs:**
  - `feature_id` (string, required) – numeric, full, or shorthand.
  - `external_id` (string, optional) – if omitted, auto-generates `{feature_external_id}-T{n}`.
  - `title` (string, required).
  - `status` (string, optional; default `pending`).
  - `basic_info` (object, optional).
  - `pcc` (object, optional).
  - `cap` (object, optional) → stored as `pvp_analysis`.
  - `reason` (string, optional).
- **Behavior:**
  - Inserts into `tasks` under the resolved feature.
  - Logs a `creation` entry in unified activity log.

#### 9.3 `DatabaseTool_create_subtask`
- Create a new subtask under a task.
- **Inputs:**
  - `task_id` (string, required) – numeric, full, or shorthand.
  - `external_id` (string, optional) – if omitted, auto-generates `{task_external_id}-S{n}`.
  - `title` (string, required).
  - `status` (string, optional; default `pending`).
  - `workflow_stage` (string, optional; default `orion_planning`).
  - `basic_info` (object, optional).
  - `instruction` (object, optional).
  - `pcc` (object, optional).
  - `tests` (object, optional).
  - `implementation` (object, optional).
  - `review` (object, optional).
  - `reason` (string, optional).
- **Behavior:**
  - Inserts into `subtasks` with full workflow payload.
  - Writes a `creation` entry to `subtask_activity_logs` (best effort) **and** unified activity logs.

---
## Safe-SQL Tool (Controlled Queries)

### 10. Safe Query
**Tool**: `DatabaseTool_safe_query`  
**Description**: Execute a safe SQL query using `DatabaseTool.query()`.

**Inputs:**
- `sql` (string, required): query string (must pass safety checks).
- `params` (array of strings, optional): parameter values.

**Restrictions (enforced by `_checkSafety`)**:
- Blocked patterns:
  - `DROP TABLE`, `DROP DATABASE`, `DROP SCHEMA`, `DROP INDEX`
  - `TRUNCATE`
  - `DELETE FROM table` without `WHERE`
  - `ALTER TABLE ... DROP`
- Intended primarily for `SELECT` queries and safe analytics.

**Guidance:**
- Prefer semantic tools when possible.
- Use `safe_query` only when a specific ad‑hoc read is needed.

---
## Filesystem Tools (Context & Edits)

These tools are provided by `FileSystemTool` and are scoped to the project workspace (no path traversal outside repo root).

### 11. Read File
**Tool**: `FileSystemTool_read_file`  
**Description**: Read the contents of a text file.

**Inputs:**
- `path` (string, required):
  - Path relative to project root (e.g., `"backend/tools/DatabaseTool.js"`).

**Behavior & Safety:**
- Normalizes to an absolute path under `process.cwd()`.
- Rejects paths that escape the repo (prevents `..` traversal).

---

### 12. Write File
**Tool**: `FileSystemTool_write_to_file`  
**Description**: Create or overwrite a file. Parents are created automatically.

**Inputs:**
- `path` (string, required): file path relative to project root.
- `content` (string, required): full file content.

**Behavior & Safety:**
- Creates parent directories as needed.
- Overwrites existing file content.
- Restricted to paths under the repo root.

---

### 13. List Files
**Tool**: `FileSystemTool_list_files`  
**Description**: List contents of a directory.

**Inputs:**
- `path` (string, required): directory path relative to project root.
- `recursive` (boolean, optional): whether to traverse subdirectories.

**Use Cases:**
- Discover relevant source files before reading.
- Build a mental model of project structure.

---

### 14. Search Files
**Tool**: `FileSystemTool_search_files`  
**Description**: Search for a regex pattern across files in a directory tree.

**Inputs:**
- `path` (string, required): root directory (e.g., `"backend/src"`).
- `regex` (string, required): Rust-style regex pattern.
- `file_pattern` (string, optional): glob filter (e.g., `"*.js"`).

**Use Cases:**
- Find all occurrences of a function or symbol.
- Locate configuration entries or TODOs.

---
## Safety Features

### DB Safety
- Blocked operations:
  - `DROP TABLE`, `DROP DATABASE`, `DROP SCHEMA`, `DROP INDEX`
  - `TRUNCATE TABLE`
  - `DELETE FROM table` without `WHERE`
  - `ALTER TABLE ... DROP`
- Protected tables (mutations only via semantic tools):
  - `subtasks`, `subtask_state`, `subtask_logs`, `subtask_activity_logs`
  - `projects`, `tasks`, `features`
  - `_migrations`, `agents`, `tools`

### FS Safety
- All FS operations are constrained to paths under the project root (`process.cwd()`).
- Any attempt to read/write outside the repo root is rejected.

### Plan Mode Locking
- In **Plan mode**, the tool registry returns **no tools**. Planning happens without DB or FS mutations.
- In **Act mode**, tools are available per-role (`Orion`, `Tara`, `Devon`) as defined in `backend/tools/registry.js`.

---
## Error Handling

Common errors and hints:

| Error | Likely Cause | Suggested Action |
|-------|-------------|------------------|
| `Subtask with ID X not found` | Invalid subtask ID | Use `DatabaseTool_search_subtasks_by_keyword` or verify shorthand/project context |
| `normalizeId: MISSING_PROJECT_CONTEXT` | Shorthand ID used without a known project | Ensure active project is set (e.g., `P1`) and retry |
| `normalizeId: Unsupported ID format` | ID format doesn’t match shorthand rules | Use full external_id or supported shorthand (e.g., `2-0-6`) |
| `Blocked: Dangerous SQL pattern detected` | Unsafe SQL in `DatabaseTool_safe_query` | Use semantic DB tools instead |
| `Tool ... execution failed` | Underlying DB/FS error | Inspect `details` / `stack` from API response or logs |

---
## Best Practices for Orion

1. **Prefer semantic DB tools** (`get_subtask_full_context`, `list_subtasks_for_task`, `update_*_sections`, creation tools) over raw SQL.
2. **Use shorthand IDs** for convenience, but remember they always map to full project-scoped IDs.
3. **Log important actions** implicitly via `update_*_sections` and creation tools (which already log to activity tables). Only reach for low-level logging if a future dedicated tool is added.
4. **Use filesystem tools to ground reasoning in real code**:
   - `FileSystemTool_list_files` → discover relevant files.
   - `FileSystemTool_read_file` → inspect implementations/specs.
   - `FileSystemTool_search_files` → locate usages.
5. **Respect status / workflow flow** (`pending → in_progress → completed`, with `blocked` as a side path) and reflect changes via `update_*_sections`.
6. **Use `DatabaseTool_safe_query` sparingly** for analytics or debugging; avoid schema changes or unsafe mutations.
7. **In Plan mode**, think and plan only. Save DB/FS mutations for Act mode where these tools are actually available.

---
*Last updated: 2025-12-20 (Orion DB Surface v1.1 + FileSystem v1.0)*  
*Aligned with F2-T0-S7_Orion_DB_Surface_Spec_v1.1.md and current implementation in DatabaseTool/FileSystemTool.*
