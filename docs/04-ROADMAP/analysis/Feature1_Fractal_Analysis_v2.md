# FRACTAL ANALYSIS v2: Feature 1 (Foundation)

**Objective:** Re-audit Feature 1 using the updated FAP (v2) with Dependency Verification.
**Source:** `.Docs/Roadmap/Feature1_Implementation_Requirements_v1.0.md`

---

## 1. Analysis of Task 1-0: Migration Infrastructure

**Goal:** Execute SQL migrations.

*   **L1:** Run Migrations.
*   **L2:** Script reads SQL files.
*   **L3:** Script connects to DB.
*   **L4:** Atomic Op: `pg.Client.connect()`.
*   **L5 (Stop):** Primitive: `node-postgres` Connection.

### Dependency Audit (Task 1-0)

| Dependency | Status | Assumption / Detail | Verification Method | Result |
| :--- | :--- | :--- | :--- | :--- |
| **DB Config** | ASSUMED | `backend/config/db.js` exists | Check file existence | **PENDING** |
| **Env Vars** | ASSUMED | `DATABASE_URL` in `.env` | Check `.env.example` | **PENDING** |
| **Driver** | NEEDED | `pg` npm package | Check `package.json` | **PENDING** |

---

## 2. Analysis of Task 1-1: DB Schema Setup

**Goal:** Create Tables (`planning_docs`, `tasks`, `subtasks`).

*   **L1:** Create Tables.
*   **L2:** Define Columns.
*   **L3:** Atomic Op: `CREATE TABLE subtasks (...)`.
*   **L4 (Stop):** Primitive: PostgreSQL Table Definition.

### Dependency Audit (Task 1-1)

| Dependency | Status | Assumption / Detail | Verification Method | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Recursion** | ASSUMED | `parent_id` works for infinite nesting | Review Logic | **CONFIRMED** |
| **Rich Data** | HAVE | `basic_info`, `instruction` (JSONB) | Requirements v1.0 | **CONFIRMED** |
| **UI Fields** | ASSUMED | `expanded` boolean in UI | Check `featureData.json` | **VERIFY** |

**Finding:** The UI (`featureData.json`) has an `expanded` boolean field for UI state.
**Question:** Should this be in the DB?
**Resolution:** UI state (expanded/collapsed) is usually transient (client-side), but if we want it persistent, we need it in DB. *Decision: Keep it client-side for now.*

---

## 3. Analysis of Task 1-2: Plan Import Tool

**Goal:** Parse Markdown -> DB.

*   **L1:** Import Plan.
*   **L2:** Parse Markdown Structure.
*   **L3:** Extract Features, Tasks, Subtasks.
*   **L4 (Stop):** Primitive: Markdown Parsing Logic.

### Dependency Audit (Task 1-2)

| Dependency | Status | Assumption / Detail | Verification Method | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Syntax** | ASSUMED | Headers (`#`) map to Levels | Read Markdown File | **VERIFY** |
| **Parser** | NEEDED | `markdown-it` | Check `package.json` | **PENDING** |
| **Subtask** | ASSUMED | Checkbox `-[ ]` regex matches | Test Regex | **RISK** |

**Risk:** Subtasks in markdown might have extra text (`- [ ] Subtask: Description`). Simple regex might fail.
**Resolution:** Ensure Parser handles "Label + Description" separation if needed.

---

## 4. Analysis of Task 1-3: Plan Viewer UI

**Goal:** Render Tree in Vue.

*   **L1:** Show Tree.
*   **L2:** Component receives Data.
*   **L3:** Atomic Op: `v-for` loop on recursive children.
*   **L4 (Stop):** Primitive: Vue Component Props.

### Dependency Audit (Task 1-3)

| Dependency | Status | Assumption / Detail | Verification Method | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Data Shape** | ASSUMED | Prop matches `featureData.json` shape | Compare DB vs JSON | **VERIFY** |
| **Styling** | HAVE | Tailwind Config | Check `tailwind.config.js` | **CONFIRMED** |
| **Icons** | ASSUMED | Chevron Icons available | Check `lucide-vue` or similar | **PENDING** |

**Finding:** `featureData.json` uses `subtasks: []`. DB schema uses `parent_id`.
**Gap:** The API *must* convert `parent_id` (flat) -> `subtasks` (nested) before sending to UI, OR UI must handle flat list.
**Resolution:** Requirements Task 1-3-2 (`listToTree.js`) covers this transformation.

---

## 5. Consolidated Verification List

To close this FAP Audit, I need to run these verifications in the environment:

1.  **Check DB Config:** Does `backend/config/db.js` exist?
2.  **Check Env:** Does `.env.example` have `DATABASE_URL`?
3.  **Check Package:** Is `pg` installed?
4.  **Check Markdown:** Does our plan template use `- [ ]`?
5.  **Check Icons:** Do we have an icon library installed?

I will perform these checks now.
