# Feature 1 — Implementation Requirements (SSOT) v1.0

Owner: **Adam (Architect)**  
Scope: **Feature 1 — “Orion Foundation” (DB Schema, Import Tools, Plan Visualization)**  
Source: `.Docs/Roadmap/Orion_System_MVP_Implementation_Requirements_v1.2.md`

> This document is the **Single Source of Truth** for implementing the Data Foundation of the Orion System.

---

## 0) Feature Definition

### Outcome
A working backend infrastructure that can store Plans/Tasks/Subtasks in PostgreSQL, and a frontend UI that can visualize this hierarchy.
- **Backend:** PostgreSQL tables + Migration Runner + Import Script.
- **Frontend:** A hierarchical "Plan Viewer" component showing the Plan -> Feature -> Task -> Subtask tree.

### Non-goals (Feature 1)
- No Chat interface (Feature 2).
- No Agent Execution/Orchestration (Feature 3).
- No Editing of Plans (Read-Only for now).

### UI Design Rules (must-follow)
- Theme: Consistent with Feature 0 (Dark mode, Neon Blue accents).
- Visualization: Indented Tree view or Nested Cards.
- Status Indication: Badges for "Pending", "Draft", "Final".

---

## 1) Delivery Method: TDD Required
For every subtask below:
- **Tara must write failing tests first (Red)**
- **Devon implements to pass tests (Green)**
- **Devon may refactor while tests remain green (Refactor)**

---

## 2) Task Breakdown

---

## Task 1-0 — Database Migration Infrastructure
Purpose: Enable safe schema updates.

### Subtask 1-0-1 — Create Migration Runner Script
**Overview:** A Node.js script `scripts/migrate.js` that executes `.sql` files against the DB.

**Tara (Tests first):**
- Create a test `backend/src/scripts/migrate.spec.js`.
- Mock the `pg` client.
- Test 1: Should read a dummy SQL file and call `client.query`.
- Test 2: Should wrap execution in a transaction (BEGIN/COMMIT/ROLLBACK).

**Devon (Implementation):**
- Implement `backend/scripts/migrate.js`.
- Use `fs` to read files from `backend/migrations/`.
- Use `pg` pool to execute them.
- Ensure Transaction safety.

**Acceptance criteria:**
- Running `node scripts/migrate.js` executes SQL without errors.

---

### Subtask 1-0-2 — Migration Execution Ownership + Runbook (Orion Wiring)
**Overview:** Define the operational workflow for running migrations (dev/test/staging/prod) and assign explicit responsibility (Orion/CI/operator).

**Scope (must document explicitly):**
1. **Who triggers migrations** in each environment:
   - Dev: developer / Orion local workflow
   - CI/Test: CI job (Orion orchestrated)
   - Prod: release step with explicit approval
2. **When migrations run:**
   - Before integration tests
   - Before importing plan data
   - Before app start *only if explicitly chosen* (generally avoid auto-migrate on startup for prod)
3. **Where the target DB comes from:**
   - `DATABASE_URL` is the sole selector of environment
4. **Safety rules:**
   - Never point prod `DATABASE_URL` from local by accident (guardrails)

**Tara (Tests first):**
- Integration test that verifies migration can be run via documented npm scripts
- Test that verifies migration fails gracefully when `DATABASE_URL` is missing

**Devon (Implementation):**
- Add npm scripts to `backend/package.json`:
  - `db:migrate` (dev)
  - `db:migrate:test` (CI/test)
- Document migration execution workflow in `backend/README.md` or equivalent
- Ensure migration runner has clear error messages for missing environment variables

**Acceptance Criteria:**
- SSOT has a "Migration Execution Workflow" section with explicit owner/trigger per env
- `package.json` scripts exist for dev and test migrations
- CI (or Orion's orchestration doc) includes `migrate → tests` ordering
- Migration runner provides clear guidance when `DATABASE_URL` is missing

---

## Task 1-1 — Database Schema Setup
Purpose: Create the core tables for the Orion System.

### Subtask 1-1-1 — Create Orion Workflow SQL
**Overview:** Define the schema in `backend/migrations/002_orion_workflow.sql`.

**Tara (Tests first):**
- Integration Test: `backend/tests/schema_v2.spec.js`.
- Test 1: Connect to Test DB.
- Test 2: Run migration.
- Test 3: Query metadata to verify tables `planning_docs`, `tasks`, `subtasks`, `task_steps` exist.
- Test 4: Verify Foreign Key constraints (e.g., `tasks` links to `planning_docs`).

**Devon (Implementation):**
- Create `backend/migrations/002_orion_workflow.sql`.
- Define tables:
    - `planning_docs` (id, project_id, title, type, content_md, status)
    - `features` (id, project_id, title, status, created_at, updated_at)
        - JSONB Columns: `basic_info`, `instruction`, `cdp_analysis`, `activity_log`, `tests`, `implementations`, `review`
    - `tasks` (id, feature_id, title, status, linked_plan_id, created_at, updated_at)
        - JSONB Columns: `basic_info`, `instruction`, `cdp_analysis`, `activity_log`, `tests`, `implementations`, `review`
    - `subtasks` (id, task_id, title, status, parent_id [recursive], created_at, updated_at)
        - JSONB Columns: `basic_info`, `instruction`, `cdp_analysis`, `activity_log`, `tests`, `implementations`, `review`
    - `task_steps` (id, subtask_id, agent_role, prompt, status, created_at, updated_at)
    - **Constraint:** All FKs use `ON DELETE CASCADE`.

**Acceptance criteria:**
- Migration runs successfully. Tables exist with correct relationships.

---

## Task 1-2 — Plan Import Tool
Purpose: Ingest a Markdown Plan into the DB.

### Subtask 1-2-1 — Define JSON Plan Schema & Import Logic
**Overview:** Create a utility that imports a structured JSON Plan into the DB. This is the **Primary Import Method** to ensure data fidelity.

**Tara (Tests first):**
- Unit Test: `backend/src/utils/jsonImporter.spec.js`.
- Test 1: Input JSON with nested `features`, `tasks`, `subtasks` (including rich fields like `cdp_analysis`).
- Output Assertion: DB rows created with correct JSONB data.

**Devon (Implementation):**
- Install `zod` for validation.
- Implement `backend/src/utils/jsonImporter.js`.
- Logic:
    - Validate incoming JSON against a Zod schema.
    - Recursive insert of Features -> Tasks -> Subtasks.
- Ensure all JSONB fields (`basic_info`, `cdp_analysis`) are mapped correctly.

### Subtask 1-2-2 — Implement Markdown Parser (Legacy/Draft Support)
**Overview:** A utility to parse "Human Drafts" (Markdown) into the JSON Schema structure.

**Tara (Tests first):**
- Unit Test: `backend/src/utils/mdToJSON.spec.js`.
- Test 1: Input Markdown -> Output JSON structure matches Subtask 1-2-1 schema.

**Devon (Implementation):**
- Install `markdown-it`.
- Implement `backend/src/utils/mdToJSON.js`.
- Logic: Parse Headers/Lists -> Output JSON object.

### Subtask 1-2-3 — CLI Import Tool
**Overview:** A script that accepts `.json` or `.md` files.

**Devon (Implementation):**
- Create `backend/tools/import_plan.js`.
- Logic:
    - Detect file extension.
    - If `.md` -> Convert to JSON (Lossy).
    - If `.json` -> Import directly (Lossless).

**Acceptance criteria:**
- `node tools/import_plan.js plan.json` imports rich data.
- `node tools/import_plan.js plan.md` imports structure.

---

## Task 1-3 — Plan Viewer UI
Purpose: Visualize the Plan in the Frontend.

### Subtask 1-3-1 — Backend API for Plan Tree
**Overview:** Endpoint to fetch the plan hierarchy.

**Tara (Tests first):**
- API Test: `GET /api/plans/:id/tree`.
- Assertion: Returns JSON with nested `tasks` and `subtasks`.

**Devon (Implementation):**
- Update `backend/src/routes/plans.js`.
- Logic: Query DB. Use a utility to reconstruct the Tree from flat rows (or use JSON_AGG if Postgres 12+).

### Subtask 1-3-2 — Frontend Tree Utility & Store
**Overview:** Client-side logic to handle the Plan data.

**Tara (Tests first):**
- Unit Test: `frontend/src/utils/treeHelpers.spec.js`.
- Test: Convert Flat List -> Tree (if backend sends flat).

**Devon (Implementation):**
- Create `frontend/src/stores/planStore.js`.
- Action: `fetchPlan(id)`.

### Subtask 1-3-3 — PlanViewer Component
**Overview:** The Vue component to render the tree.

**Tara (Tests first):**
- Component Test: `frontend/src/components/PlanViewer.spec.js`.
- Test 1: Mount with mock Plan data.
- Assertion: Verify "Feature 1" text is visible. Verify "Task 1.1" is indented/nested.

**Devon (Implementation):**
- Create `frontend/src/components/PlanViewer.vue`.
- Use Recursive Component pattern (or `FeatureTree.vue` refactored) to render nested items.
- Style: Neon Blue headers, gray background for tasks.
- Use `lucide-vue-next` icons for expand/collapse or status indication.

**Acceptance criteria:**
- Visiting the Plan page shows the imported plan in a clean, hierarchical view.

---

## 3) Decisions Locked (from PVP/CDP/FAP)
1.  **Migration Tool:** We are building a custom `scripts/migrate.js` (lightweight) instead of using a heavy ORM CLI.
2.  **Import Format:** JSON-first for data fidelity, Markdown for human drafting.
3.  **Recursive Subtasks:** The DB schema supports `parent_id` on subtasks to allow infinite nesting (Fractal support).
4.  **SSOT:** The DB is the master; the Markdown/JSON file is just an import source.
5.  **Validation:** Use `zod` (or equivalent) for JSON schema validation to prevent silent data loss.
6.  **Deletion Policy:** All Foreign Keys use `ON DELETE CASCADE`.
7.  **Migration Ordering:** Migration files follow `TIMESTAMP_name.sql` convention.
8.  **Migration Transaction Scope:** Each migration file runs in its own transaction (BEGIN/COMMIT/ROLLBACK). If a migration fails, previous successful migrations remain committed. This is acceptable for MVP.
9.  **Database Client:** Using `pg.Client` (single connection) instead of `pg.Pool` for simplicity in MVP. This is sufficient for migration scripts.
10. **Exit Behavior:** Migration runner calls `process.exit(1)` on failure for CLI usage, but also returns error details for programmatic use via `runMigrations({ exitOnFailure: false })`.

---

## 4) Missing Fundamentals (from FAP v4)
These must be resolved before implementation:

| Category | Item | Status | Action |
| :--- | :--- | :--- | :--- |
| **Infra** | `backend/config/db.js` | MISSING | Create DB config file |
| **Env** | `DATABASE_URL` in `.env` | MISSING | Add to environment |
| **Lib** | `markdown-it` | MISSING | `npm install markdown-it` |
| **Lib** | `lucide-vue-next` | MISSING | `npm install lucide-vue-next` |
| **Lib** | `zod` | MISSING | `npm install zod` |
| **Logic** | Migration Naming Convention | UNDEFINED | Use `TIMESTAMP_` prefix |
| **Schema** | Deletion Policy | UNDEFINED | Add `ON DELETE CASCADE` |

---

## 5) Migration Execution Workflow (Subtask 1-0-2 Output)

### Overview
This section documents the operational workflow for running database migrations across different environments, as implemented in Subtask 1-0-2.

### NPM Scripts
- **`db:migrate`**: Development environment migration
- **`db:migrate:test`**: Test/CI environment migration (sets `NODE_ENV=test`)

### Environment-Specific Execution

#### Development (Local)
- **Who:** Developer / Orion local workflow
- **When:** Before running integration tests or starting application
- **Trigger:** Manual execution via `npm run db:migrate`
- **Safety:** `.env` file contains local DB credentials
- **Target DB:** Selected via `DATABASE_URL` in `.env`

#### CI/Test Environment
- **Who:** CI job (Orion orchestrated)
- **When:** Before integration tests in CI pipeline
- **Trigger:** Automated as part of CI workflow
- **Safety:** `DATABASE_URL` injected via CI secrets
- **Target DB:** Test database specified in CI environment

#### Production Environment
- **Who:** Release engineer / deployment pipeline
- **When:** During deployment, before application start
- **Trigger:** Manual approval or automated with safeguards
- **Safety:** Production `DATABASE_URL` never stored in code
- **Target DB:** Production database via deployment environment

### Safety Rules
1. **Environment Selection:** `DATABASE_URL` is the sole selector of environment
2. **Never Auto-migrate on Startup:** Avoid automatic migrations in production
3. **Transaction Safety:** Each migration runs in its own transaction
4. **Error Handling:** Failed migrations rollback and exit with non-zero code
5. **Missing Environment:** Script fails gracefully with clear error message

### Documentation
- **Location:** `backend/README.md`
- **Content:** Complete migration workflow, safety rules, troubleshooting
- **Purpose:** Single source of truth for migration operations

### Acceptance Criteria Met
- ✅ SSOT has "Migration Execution Workflow" section with explicit owner/trigger per env
- ✅ `package.json` scripts exist for dev and test migrations
- ✅ Documentation exists in `backend/README.md`
- ✅ Migration runner provides clear guidance when `DATABASE_URL` is missing

---

## 6) Process Violations & Escalations

### Violation 1: Devon Modified Test File (Subtask 1-0-1)
**Date:** 2025-12-17  
**Context:** During implementation of Subtask 1-0-1 (Migration Runner Script), Devon modified `backend/src/scripts/migrate.spec.js` to fix failing tests.

**What happened:**
1. Tara created failing tests as required
2. Devon implemented `backend/scripts/migrate.js`
3. Tests failed due to path calculation mismatch between test expectations and implementation
4. **VIOLATION:** Instead of escalating, Devon modified the test file to match implementation

**Root Cause:** Test expectations were incorrectly written by Tara - they expected `fs.readdirSync` to be called with `path.join(process.cwd(), 'backend', 'migrations')` but implementation used `__dirname` for path calculation.

**Correct Process:**
1. Devon should have documented the test error
2. Escalated to Tara to fix the test
3. Tara would update test expectations to match correct behavior OR adjust implementation to match test expectations

**Action Required:** Tara needs to review and fix `backend/src/scripts/migrate.spec.js` test expectations.

---

## 6) Definition of Done (Feature 1)
- [ ] DB Migrations run cleanly.
- [ ] `import_plan.js` script works on this very document.
- [ ] UI shows the plan correctly nested.
- [ ] All Missing Fundamentals are resolved.
- [ ] JSON import is validated against the agreed schema (zod).
- [ ] Plan Viewer renders icons and theme as per UI design rules.
