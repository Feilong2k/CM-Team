# JSON Plan Schema v1.1 — Design Specification

**Owner:** Adam (Architect)  
**Context:** Subtask 1-2-1 — Define JSON Plan Schema & Import Logic  
**Status:** Final for Implementation  
**Last Updated:** 2025-12-17  
**Based on:** v1.0 with user feedback incorporated

---

## 1. Overview

This document defines the **primary (lossless) JSON import format** for the Orion System. It is designed to:

- Map cleanly to the current DB tables (`planning_docs`, `features`, `tasks`, `subtasks`)
- Preserve all "rich" JSONB fields (PCC, CAP, RED, etc.)
- Support recursive subtasks (`parent_id`)
- Enable idempotent imports via `external_id` columns
- Be straightforward to validate with **Zod**

---

## 2. Workflow Context: RED Must Surface "Non-Coding Inputs"

### Process Change
During the **RED (Recursive Execution Decomposition)** phase, Orion must:

1. **Identify Non-Coding Inputs** — external dependencies like final plan approval, JSON schema decisions, system prompts, etc.
2. **Create a Decision Tracker** — list of external decisions required before implementation can proceed
3. **Set Workflow Stage Appropriately** — when external input is needed, set `workflow_stage` to indicate who needs to act

### Clarification on Status vs Workflow Stage
- **Status** (`pending | in_progress | done`): Tracks completion lifecycle
- **Workflow Stage**: Tracks **who has the ball** in the orchestration workflow
- **Non-Coding Inputs**: These are tracked in the RED analysis output, not as a status on the file itself

### Example RED Output Should Include:
- "External decisions needed: [ ] Final JSON schema approval, [ ] System prompt review"
- "Blocking stages: Adam_Review (for schema), Product_Owner (for requirements)"

---

## 3. Version Tracking

### Two Distinct Version Concepts

| Concept | Field Name | Purpose | Example |
|---------|------------|---------|---------|
| **Schema Version** | `schemaVersion` | Controls how JSON is interpreted | `"1.1"` |
| **Plan Revision** | `revision` | User-level evolution of plan content | `1` |

**Benefit:** Plan titles remain stable (no "v1/v2" in titles).

### Storage Strategy
- `planning_docs` table gets:
  - `external_id` (string, unique)
  - `revision` (integer, defaults to 1)

**Decision:** Keep only latest revision (overwrite on import). The `revision` field is still useful for:
1. Tracking changes between imports (increment on each import)
2. Version display in UI (e.g., "v3")
3. Debugging (knowing which version is currently stored)

---

## 4. Naming Convention: CAP / PCC / RED Everywhere

### Alignment Across All Layers
- **CAP** = Constraint-Aware Planning (was PVP)
- **PCC** = Preflight Constraint Check (was CDP)  
- **RED** = Recursive Execution Decomposition (was FAP)

### Database Column Names (Requires Migration)
Current → Proposed:
- `features.pvp_analysis` → `features.cap`
- `features.fap_analysis` → `features.red`
- `tasks.pvp_analysis` → `tasks.cap`

**JSON keys match DB column names exactly.**

---

## 5. Subtask Workflow Stage + Status

### Why Both Fields?
- `status`: User-facing lifecycle (`pending | in_progress | done`)
- `workflow_stage`: Orchestration state machine

### Final `workflow_stage` Enum Values
```
Planning
Orion_PCC
Tara_PCC
Tara_Tests
Devon_PCC
Devon_Impl
Devon_Refactor
Adam_Review
```

**Changes from v1.0:**
- Added `planning` stage (initial state before any PCC)
- Added `Devon_PCC` stage (Devon's preflight check before implementation)

### Database Implementation
Add column to `subtasks` table:
- `workflow_stage VARCHAR NOT NULL DEFAULT 'planning'`
- Optional: CHECK constraint for allowed values

**Note:** Features and Tasks do NOT get `workflow_stage` in MVP (only Subtasks).

---

## 6. JSON Schema Definition

### External ID Naming Convention
**Hierarchical ID Structure:** `P{project}-F{feature}-T{task}-S{subtask}`

Examples:
- `P1-F2-T1-S1`: Project 1, Feature 2, Task 1, Subtask 1
- `P1-F1`: Project 1, Feature 1 (no task/subtask specified)
- `P1-F2-T3`: Project 1, Feature 2, Task 3 (no subtask)

**Rules:**
1. All IDs start with project prefix `P{number}-`
2. Feature IDs: `P1-F1`, `P1-F2`, etc.
3. Task IDs: `P1-F1-T1`, `P1-F1-T2`, etc.
4. Subtask IDs: `P1-F1-T1-S1`, `P1-F1-T1-S2`, etc.
5. Recursive subtasks: `P1-F1-T1-S1-S1` (subtask of subtask) - though we recommend flat structure

### Top-Level Structure
```jsonc
{
  "schemaVersion": "1.1",
  "plan": {
    "externalId": "P1",  // Project 1
    "projectId": "CM-TEAM",
    "title": "Feature 1 — Orion Foundation",
    "type": "implementation_requirements",
    "status": "pending",
    "revision": 1,
    "contentMd": "...optional raw markdown...",
    "features": [ /* Feature[] */ ]
  }
}
```

### Feature Object
```jsonc
{
  "externalId": "P1-F2",  // Project 1, Feature 2
  "title": "Plan Import Tool",
  "status": "pending",
  
  // JSONB columns
  "basic_info": { "owner": "Adam", "notes": "..." },
  "activity_log": [],
  "pcc": { "checks": [], "risks": [], "questions": [] },
  "cap": { "summary": "...", "risks": [], "questions": [] },
  "red": { "summary": "...", "decomposition": [], "external_decisions": [] },
  
  "tasks": [ /* Task[] */ ]
}
```

### Task Object
```jsonc
{
  "externalId": "P1-F2-T1",  // Project 1, Feature 2, Task 1
  "title": "Define JSON Plan Schema & Import Logic",
  "status": "pending",
  "linked_plan_externalId": "P1",
  
  // JSONB columns
  "basic_info": { "purpose": "..." },
  "activity_log": [],
  "pcc": { "checks": [], "risks": [], "questions": [] },
  "cap": { "summary": "...", "risks": [], "questions": [] },
  
  "subtasks": [ /* Subtask[] */ ]
}
```

### Subtask Object (Recursive)
```jsonc
{
  "externalId": "P1-F2-T1-S1",  // Project 1, Feature 2, Task 1, Subtask 1
  "title": "Define Zod schema",
  "status": "pending",
  "workflow_stage": "planning",
  
  // JSONB columns
  "basic_info": { "estimate": "S" },
  "instruction": { "steps": ["..."] },
  "activity_log": [],
  "pcc": { "checks": [], "risks": [], "questions": [] },
  "tests": { "tara": ["..."] },
  "implementations": { "devon": ["..."] },
  "review": { "notes": "..." },
  
  "subtasks": [ /* Subtask[] */ ]  // For recursive subtasks
}
```

**Note:** For recursive subtasks, the externalId would be `P1-F2-T1-S1-S1` (subtask of subtask), but we recommend keeping subtasks flat under tasks for simplicity.

---

## 7. Validation Rules (Zod)

### Core Rules
1. **schemaVersion** required and must be supported (`"1.1"`)
2. **externalId** required for plan/features/tasks/subtasks
   - Must match pattern: `/^P\d+(-F\d+(-T\d+(-S\d+)?)?)?$/`
3. **status** must be one of: `pending | in_progress | done`
4. **workflow_stage** (subtasks only): must match enum values
5. JSONB payloads (`basic_info`, `pcc`, etc.):
   - Initially `z.record(z.any())` (MVP flexible)
   - With recommended shapes for consistency in tests
6. Subtask recursion:
   - `subtasks: z.array(SubtaskSchema).default([])`
   - Guard against pathological recursion (max depth: 50)

### Status Normalization
- DB stores: `pending`, `in_progress`, `done`
- UI can display: `pending`, `in progress`, `done`

---

## 8. Database Mapping

### planning_docs
- `external_id` ← plan.externalId (e.g., "P1")
- `project_id` ← plan.projectId
- `title` ← plan.title
- `type` ← plan.type
- `status` ← plan.status
- `revision` ← plan.revision
- `content_md` ← plan.contentMd (optional)

### features
- `external_id` ← feature.externalId (e.g., "P1-F2")
- `project_id` ← plan.projectId
- `title` ← feature.title
- `status` ← feature.status
- JSONB columns:
  - `basic_info` ← feature.basic_info
  - `activity_log` ← feature.activity_log
  - `pcc` ← feature.pcc
  - `cap` ← feature.cap
  - `red` ← feature.red

### tasks
- `external_id` ← task.externalId (e.g., "P1-F2-T1")
- `feature_id` ← parent feature DB id
- `title` ← task.title
- `status` ← task.status
- `linked_plan_id` ← lookup planning_docs.id by plan.externalId (optional)
- JSONB columns:
  - `basic_info` ← task.basic_info
  - `activity_log` ← task.activity_log
  - `pcc` ← task.pcc
  - `cap` ← task.cap

### subtasks
- `external_id` ← subtask.externalId (e.g., "P1-F2-T1-S1")
- `task_id` ← parent task DB id
- `parent_id` ← parent subtask DB id (null for top-level)
- `title` ← subtask.title
- `status` ← subtask.status
- `workflow_stage` ← subtask.workflow_stage
- JSONB columns:
  - `basic_info` ← subtask.basic_info
  - `instruction` ← subtask.instruction
  - `pcc` ← subtask.pcc
  - `activity_log` ← subtask.activity_log
  - `tests` ← subtask.tests
  - `implementations` ← subtask.implementations
  - `review` ← subtask.review

---

## 9. Import Behavior (Option 2: External ID + Upsert)

### Idempotent Import
- Importing same JSON twice **updates** existing rows (no duplicates)
- Implemented via: `INSERT ... ON CONFLICT (external_id) DO UPDATE ...`

### External ID Strategy
Add columns to all tables:
- `planning_docs.external_id` (UNIQUE)
- `features.external_id` (UNIQUE)
- `tasks.external_id` (UNIQUE)
- `subtasks.external_id` (UNIQUE)

**Assumption:** `externalId` values follow the hierarchical naming convention and are globally unique.

### Transaction Scope
- Full plan import runs in **one transaction** (all-or-nothing)
- If any insert fails, rollback everything

### Ordering
- Add `order_index` column to each table
- Sort by `order_index` in UI queries

---

## 10. Required Database Migrations

### Migration 004: External IDs + Column Renames + Workflow Stage + Order Index
```sql
-- 1. Add external_id columns
ALTER TABLE planning_docs ADD COLUMN external_id VARCHAR(255) UNIQUE;
ALTER TABLE features ADD COLUMN external_id VARCHAR(255) UNIQUE;
ALTER TABLE tasks ADD COLUMN external_id VARCHAR(255) UNIQUE;
ALTER TABLE subtasks ADD COLUMN external_id VARCHAR(255) UNIQUE;

-- 2. Add revision to planning_docs
ALTER TABLE planning_docs ADD COLUMN revision INTEGER DEFAULT 1;

-- 3. Rename columns to new protocol names
ALTER TABLE features RENAME COLUMN pvp_analysis TO cap;
ALTER TABLE features RENAME COLUMN fap_analysis TO red;
ALTER TABLE tasks RENAME COLUMN pvp_analysis TO cap;

-- 4. Add workflow_stage to subtasks
ALTER TABLE subtasks ADD COLUMN workflow_stage VARCHAR(50) NOT NULL DEFAULT 'planning';

-- 5. Add order_index columns for UI sorting
ALTER TABLE features ADD COLUMN order_index INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN order_index INTEGER DEFAULT 0;
ALTER TABLE subtasks ADD COLUMN order_index INTEGER DEFAULT 0;

-- 6. Add CHECK constraint for workflow_stage (optional but recommended)
ALTER TABLE subtasks ADD CONSTRAINT valid_workflow_stage 
CHECK (workflow_stage IN (
  'planning',
  'Orion_PCC',
  'Tara_PCC', 
  'Tara_Tests',
  'Devon_PCC',
  'Devon_Impl',
  'Devon_Refactor',
  'Adam_Review'
));
```

### Migration 005: Status Normalization
```sql
-- Normalize 'in progress' to 'in_progress' in DB
UPDATE features SET status = 'in_progress' WHERE status = 'in progress';
UPDATE tasks SET status = 'in_progress' WHERE status = 'in progress';
UPDATE subtasks SET status = 'in_progress' WHERE status = 'in progress';

-- Optional: Add CHECK constraint for status
ALTER TABLE features ADD CONSTRAINT valid_status 
CHECK (status IN ('pending', 'in_progress', 'done'));

ALTER TABLE tasks ADD CONSTRAINT valid_status 
CHECK (status IN ('pending', 'in_progress', 'done'));

ALTER TABLE subtasks ADD CONSTRAINT valid_status 
CHECK (status IN ('pending', 'in_progress', 'done'));
```

---

## 11. Implementation Notes for Orion/Tara/Devon Workflow

### Tara (Tests First)
1. **Zod Schema Validation Tests**
   - Test valid/invalid JSON against schema
   - Test externalId pattern validation
   - Test recursion limits
   - Test enum values (status, workflow_stage)

2. **Import Logic Tests**
   - Test idempotent upsert behavior
   - Test transaction rollback on error
   - Test foreign key relationships preserved
   - Test hierarchical externalId parsing

3. **Database Migration Tests**
   - Verify new columns exist
   - Verify renamed columns work
   - Verify constraint integrity

### Devon (Implementation)
1. **Create Migration 004 & 005** (as above)
2. **Implement Zod Schemas** in `backend/src/schemas/`
   - Include regex validation for externalId patterns
   - Define all enum constraints
3. **Implement JSON Importer** with:
   - Transaction wrapper
   - Upsert logic using external_id
   - Recursive insertion with parent-child relationship building
   - ExternalId parsing to determine hierarchy
4. **Update Existing Tests** to reflect new column names

### Orion (Orchestration)
1. **Update RED Protocol** to include "External Decisions" tracking in RED output
2. **Implement Workflow Stop** when `workflow_stage` requires external input
3. **Update UI Bindings** to use new column names
4. **Generate Proper ExternalIds** using the P1-F1-T1-S1 convention

---

## 12. Resolved Decisions

1. **Features/Tasks workflow_stage?**
   - **Decision:** No, only Subtasks get `workflow_stage` in MVP

2. **Status normalization in DB?**
   - **Decision:** Store `in_progress` (snake_case) in DB, map to "in progress" in UI

3. **External ID uniqueness guarantee?**
   - **Decision:** Use hierarchical naming convention `P1-F1-T1-S1`
   - `UNIQUE(external_id)` per table works with this convention

4. **Ordering implementation?**
   - **Decision:** Add `order_index` columns for cleaner UI sorting

5. **Revision tracking strategy?**
   - **Decision:** Keep `revision` field, increment on each import
   - Overwrite previous revision (keep only latest)

6. **RED non-coding inputs tracking?**
   - **Decision:** Track in RED analysis output (`red.external_decisions`)
   - Use `workflow_stage` to indicate blocking stages

---

## 13. Next Steps

1. **✅ Review this document** and confirm decisions (DONE)
2. **Create Migration 004 & 005** (Devon)
3. **Implement Zod schemas** with externalId pattern validation (Devon)
4. **Write failing tests** for schema validation and import logic (Tara)
5. **Implement JSON importer** with hierarchical ID support (Devon)
6. **Update UI components** to use new field names and workflow stages

---

**Approval:**  
[✅] Adam (Architect) - v1.1 incorporates all feedback  
[ ] Product Owner  
[ ] Tara (QA)  
[ ] Devon (Implementation)

**File History:**
- v1.0 (2025-12-17): Initial draft
- v1.1 (2025-12-17): Incorporated user feedback on:
  - RED non-coding inputs clarification
  - External ID naming convention (P1-F1-T
