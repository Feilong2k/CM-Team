# FRACTAL ANALYSIS v4 (Complete Recursive Audit)

**Target:** Feature 1 (Orion Foundation)
**Goal:** Exhaustive Deep Dive using the Recursive Queue Algorithm.

---

## 1. Task 1-0: Database Migration Infrastructure

*   **Queue Item:** "Run Migration Script"
*   **Mechanism:** `node scripts/migrate.js` reads `.sql` and runs via `pg`.
*   **Drill Down:**
    *   **Action:** Read SQL Files. -> **Primitive (FS).**
    *   **Action:** Connect to DB. -> **Primitive (PG Client).**
        *   **Dependency Audit:**
            *   `pg` lib: **INSTALLED** (Verified v3).
            *   `backend/config/db.js`: **MISSING** (Found v2).
            *   `DATABASE_URL`: **MISSING** in `.env.example` (Found v2).
    *   **Action:** Transaction Management (`BEGIN/COMMIT`). -> **Primitive.**

**New Findings (Task 1-0):**
*   **Assumption:** We assume the script handles *ordering* of migrations (e.g., timestamps).
*   **Verification:** Do we have a naming convention?
*   **Gap:** We need to define the naming standard `TIMESTAMP_name.sql` in the requirement.

---

## 2. Task 1-1: Database Schema Setup

*   **Queue Item:** "Create Orion Schema"
*   **Mechanism:** execute `002_orion_workflow.sql`.
*   **Drill Down:**
    *   **Action:** Create Table `subtasks`.
    *   **Mechanism:** SQL DDL. -> **Primitive.**
        *   **Dependency Audit:**
            *   `JSONB` support: **NEEDED**. (Does PG version support it? Assume Yes).
            *   `parent_id` recursion: **ASSUMED** working.
            *   `on delete cascade`: **ASSUMED**. (Do we delete tasks? Or soft delete?)
            *   **Verification:** Requirement doesn't specify deletion policy.
            *   **Gap:** Missing `deleted_at` or Cascade rules.

**New Findings (Task 1-1):**
*   **Gap:** Schema needs `deleted_at` (Soft Delete) or `ON DELETE CASCADE` to prevent orphans.

---

## 3. Task 1-2: Plan Import Tool (JSON First)

*   **Queue Item:** "Import JSON Plan"
*   **Mechanism:** Read `.json`, Insert Rows.
*   **Drill Down:**
    *   **Action:** Validate JSON Schema.
    *   **Mechanism:** `if (obj.features)`. -> **Primitive.**
        *   **Dependency Audit:**
            *   Schema Definition: **ASSUMED** matches DB.
            *   **Gap:** If JSON has `feature.desc` but DB has `feature.description`, import fails.
            *   **Resolution:** Validation Library (e.g., `zod` or `ajv`) recommended but not strict requirement.
    *   **Action:** Recursive Insert.
    *   **Mechanism:** `insert(feature) -> get ID -> insert(task)`. -> **Primitive.**

*   **Queue Item:** "Import Markdown Plan" (Legacy)
*   **Mechanism:** Parse MD -> JSON -> Import.
*   **Drill Down:**
    *   **Action:** Parse Headers. -> **Primitive (markdown-it).**
        *   **Dependency Audit:** `markdown-it`: **MISSING**. (Found v2).

**New Findings (Task 1-2):**
*   **Gap:** Need rigorous field mapping (Validation) to prevent silent data loss during JSON import.

---

## 4. Task 1-3: Plan Viewer UI

*   **Queue Item:** "Render Plan Tree"
*   **Mechanism:** Vue Component + Store.
*   **Drill Down:**
    *   **Action:** Fetch Data. -> **Primitive (Axios/Fetch).**
    *   **Action:** Transform Flat -> Tree. -> **Primitive (JS Logic).**
    *   **Action:** Render Recursive Component.
        *   **Mechanism:** `<PlanItem v-for="child in children">`. -> **Primitive (Vue).**
        *   **Dependency Audit:**
            *   `FeatureTree.vue`: **EXISTS**.
            *   `lucide-vue-next`: **MISSING** (Found v2).
            *   **Tailwind:** **INSTALLED**.
            *   **Theme Tokens:** **ASSUMED** (Neon Blue).
            *   **Verification:** Check `tailwind.config.cjs`.

**New Findings (Task 1-3):**
*   **Verification:** `tailwind.config.cjs` needs to be checked for "Neon Blue" definition.

---

## 5. Consolidated Missing Fundamentals (All Versions)

| ID | Category | Item | Status | Action |
| :--- | :--- | :--- | :--- | :--- |
| **F1** | Infra | `backend/config/db.js` | **MISSING** | Create File |
| **F2** | Env | `DATABASE_URL` | **MISSING** | Add to `.env` |
| **F3** | Lib | `markdown-it` | **MISSING** | `npm install` |
| **F4** | Lib | `lucide-vue-next` | **MISSING** | `npm install` |
| **F5** | Logic | Migration Ordering | **UNDEFINED** | Define `TIMESTAMP_` convention |
| **F6** | Schema | Deletion Policy | **UNDEFINED** | Add `ON DELETE CASCADE` |
| **F7** | UI | Theme Colors | **UNVERIFIED** | Check Tailwind Config |

---

## 6. Final Verification (Live Environment)

I will now execute the final verification for **F7 (Tailwind Colors)**.
