# JSON Plan Schema v1.0 — Design Specification

**Owner:** Adam (Architect)  
**Context:** Subtask 1-2-1 — Define JSON Plan Schema & Import Logic  
**Status:** Draft for Review  
**Last Updated:** 2025-12-17

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
Before implementation begins, the **RED (Recursive Execution Decomposition)** phase must:

1. **Produce a Decision Checklist** — numbered list of user decisions required
2. **Create a Stop Gate** — Orion halts and requests decisions before generating implementation steps

### Data Representation
For any executable entity (especially subtasks), we store:

- `status`: `pending | in_progress | done` (user-facing lifecycle)
- `workflow_stage`: orchestration state — **who has the ball** (see Section 5)

When Orion finishes RED and discovers missing decisions:
- `status = "pending"` (or stays `in_progress`)
- `workflow_stage = "Adam_Review"` (or appropriate stage)

This creates a **hard stop** and queryable signal.

---
NOTE: not what had in mind, whe doing RED, it is not possible to have status on a file. but we do know that if a certain stage will require input that's outside of coding, for example final plan, JSON schema, system prompt, etc these are outside input, which we need to keep track and be prepared for.


## 3. Version Tracking

### Two Distinct Version Concepts

| Concept | Field Name | Purpose | Example |
|---------|------------|---------|---------|
| **Schema Version** | `schemaVersion` | Controls how JSON is interpreted | `"1.0"` |
| **Plan Revision** | `revision` | User-level evolution of plan content | `1` |

**Benefit:** Plan titles remain stable (no "v1/v2" in titles).

### Storage
- `planning_docs` table gets:
  - `external_id` (string, unique)
  - `revision` (integer)

We can either:
- Keep only latest revision (overwrite on import)
- Support multiple revisions (unique constraint: `(external_id, revision)`)

NOTE: keep the latest revision, but if that's the case, there's no point in the revision number? let me know what you think

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
#NOte: Agreed

---

## 5. Subtask Workflow Stage + Status

### Why Both Fields?
- `status`: User-facing lifecycle (`pending | in_progress | done`)
- `workflow_stage`: Orchestration state machine

### Proposed `workflow_stage` Enum Values
```
planning
Orion_PCC
Tara_PCC
Tara_Tests
Devon_PCC
Devon_Impl
Devon_Refactor
Adam_Review
```
NOTE: Made some slight changes to the sages, added planning and Devon_PCC

### Database Implementation
Add column to `subtasks` table:
- `workflow_stage VARCHAR NOT NULL DEFAULT 'Orion_PCC'`
- Optional: CHECK constraint for allowed values

**Note:** Features and Tasks do NOT get `workflow_stage` in MVP (only Subtasks).

---

## 6. JSON Schema Definition

### Top-Level Structure
```jsonc
{
  "schemaVersion": "1.0",
  "plan": {
    "externalId": "plan_feature1_orion_foundation",
    "projectId": "CM-TEAM",
    "title": "Feature 1 — Orion Foundation",
    "type": "implementation_requirements",
    "status": "pending",
    "revision": 1,
    "contentMd": "...optional raw markdown...",
    "features": [ /* Feature[] */ ]
  }
}
NOTE: What's externaID? how is it named? Plan in my mind is the step above Features, which is the roadmap?, so why not just call it P1?
```

### Feature Object
```jsonc
{
  "externalId": "1-2",
  "title": "Plan Import Tool",
  "status": "pending",
  
  // JSONB columns
  "basic_info": { "owner": "Adam", "notes": "..." },
  "activity_log": [],
  "pcc": { "checks": [], "risks": [], "questions": [] },
  "cap": { "summary": "...", "risks": [], "questions": [] },
  "red": { "summary": "...", "decomposition": [] },
  
  "tasks": [ /* Task[] */ ]
}
NOTE: Feature's external ID should be something like F0001, 1-2 in my mind means Feature 1, task 2, unless the 1 here means plan 1?
```

### Task Object
```jsonc
{
  "externalId": "1-2-1",
  "title": "Define JSON Plan Schema & Import Logic",
  "status": "pending",
  "linked_plan_externalId": "plan_feature1_orion_foundation",
  
  // JSONB columns
  "basic_info": { "purpose": "..." },
  "activity_log": [],
  "pcc": { "checks": [], "risks": [], "questions": [] },
  "cap": { "summary": "...", "risks": [], "questions": [] },
  
  "subtasks": [ /* Subtask[] */ ]
}
NOTE: Same here 1-2-1, plan 1, Feature 2, task 1? if not then it should be 2-1, which mean Feature 2, task 1.
```

### Subtask Object (Recursive)
```jsonc
{
  "externalId": "1-2-1.a",
  "title": "Define Zod schema",
  "status": "pending",
  "workflow_stage": "Orion_PCC",
  
  // JSONB columns
  "basic_info": { "estimate": "S" },
  "instruction": { "steps": ["..."] },
  "activity_log": [],
  "pcc": { "checks": [], "risks": [], "questions": [] },
  "tests": { "tara": ["..."] },
  "implementations": { "devon": ["..."] },
  "review": { "notes": "..." },
  
  "subtasks": [ /* Subtask[] */ ]
}
NOTE: Subtask should not have .a, 1-2-1, is the subtask id. So let's make a rule P1 means project 1, so if you need to include project ID it would be P1-1-2-1, which means Project 1, feature 1, task 2, subtask 1
```

---

## 7. Validation Rules (Zod)

### Core Rules
1. **schemaVersion** required and must be supported (`"1.0"`)
2. **externalId** required for plan/features/tasks/subtasks
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
- `external_id` ← plan.externalId
- `project_id` ← plan.projectId
- `title` ← plan.title
- `type` ← plan.type
- `status` ← plan.status
- `revision` ← plan.revision
- `content_md` ← plan.contentMd (optional)

### features
- `external_id` ← feature.externalId
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
- `external_id` ← task.externalId
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
- `external_id` ← subtask.externalId
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

**Assumption:** `externalId` values are globally unique per entity type.

### Transaction Scope
- Full plan import runs in **one transaction** (all-or-nothing)
- If any insert fails, rollback everything

### Ordering
- Add `order_index` column to each table, OR
- Store ordering in JSONB.basic_info (e.g., `basic_info.order = 1`)
- **Recommendation:** Add `order_index` for cleaner UI sorting

---

## 10. Required Database Migrations

### Migration 004: External IDs + Column Renames + Workflow Stage
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
ALTER TABLE subtasks ADD COLUMN workflow_stage VARCHAR(50) NOT NULL DEFAULT 'Orion_PCC';

-- 5. Add order_index columns for UI sorting
ALTER TABLE features ADD COLUMN order_index INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN order_index INTEGER DEFAULT 0;
ALTER TABLE subtasks ADD COLUMN order_index INTEGER DEFAULT 0;
```

### Migration 005: Status Normalization (if needed)
```sql
-- Normalize 'in progress' to 'in_progress' in DB
UPDATE features SET status = 'in_progress' WHERE status = 'in progress';
UPDATE tasks SET status = 'in_progress' WHERE status = 'in progress';
UPDATE subtasks SET status = 'in_progress' WHERE status = 'in progress';
```

---

## 11. Implementation Notes for Orion/Tara/Devon Workflow

### Tara (Tests First)
1. **Zod Schema Validation Tests**
   - Test valid/invalid JSON against schema
   - Test recursion limits
   - Test enum values (status, workflow_stage)

2. **Import Logic Tests**
   - Test idempotent upsert behavior
   - Test transaction rollback on error
   - Test foreign key relationships preserved

3. **Database Migration Tests**
   - Verify new columns exist
   - Verify renamed columns work
   - Verify constraint integrity

### Devon (Implementation)
1. **Create Migration 004** (as above)
2. **Implement Zod Schemas** in `backend/src/schemas/`
3. **Implement JSON Importer** with:
   - Transaction wrapper
   - Upsert logic using external_id
   - Recursive insertion
4. **Update Existing Tests** to reflect new column names

### Orion (Orchestration)
1. **Update RED Protocol** to include "Decision Checklist" output
2. **Implement Workflow Stop** when `workflow_stage = "Adam_Review"`
3. **Update UI Bindings** to use new column names

---

## 12. Open Questions (Require Decision)

1. **Features/Tasks workflow_stage?**
   - Should Features and Tasks also have `workflow_stage`?
   - **Recommendation:** No, only Subtasks for MVP

2. **Status normalization in DB?**
   - Store `in_progress` (snake_case) vs `in progress` (with space)?
   - **Recommendation:** `in_progress` in DB, map in UI

3. **External ID uniqueness guarantee?**
   - Are IDs like `"1-2-1"` globally unique per entity type?
   - If yes, `UNIQUE(external_id)` per table works

4. **Ordering implementation?**
   - Add `order_index` columns vs store in JSONB?
   - **Recommendation:** Add `order_index` columns

---

## 13. Next Steps

1. **Review this document** and confirm decisions
2. **Create Migration 004** (Devon)
3. **Implement Zod schemas** (Devon)
4. **Write failing tests** (Tara)
5. **Implement JSON importer** (Devon)
6. **Update UI components** to use new field names

---

**Approval:**  
[ ] Adam (Architect)  
[ ] Product Owner  
[ ] Tara (QA)  
[ ] Devon (Implementation)
