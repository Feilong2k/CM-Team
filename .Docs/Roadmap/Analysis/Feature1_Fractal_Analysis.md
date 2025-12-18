# FRACTAL ANALYSIS: Feature 1 (Foundation & Plan Visualization)

**Objective:** Drill down into Feature 1 tasks to identify "Atomic Constraints" and "Missing Fundamentals" before implementation.

**Source Plan:** `.Docs/Roadmap/Orion_System_MVP_Implementation_Requirements_v1.2.md`

---

## 1. Analysis of Task 1.1: Database Schema Setup

**Goal:** Create `planning_docs`, `tasks`, `subtasks`, `task_steps` tables.

*   **L1 (System):** "Create Tables."
*   **L2 (Operation):** "Run Migration."
*   **L3 (Mechanism):** "Backend executes SQL file."
*   **L4 (Execution):** `npm run migrate` or manual SQL execution.
    *   *Constraint:* Does the project have a migration runner?
    *   *Check:* `package.json` -> No standard `migrate` script visible in `c:\Coding\CM-TEAM`.
    *   *Result:* **Missing Fundamental.**
*   **L5 (Fundamental):** **Migration Tooling.**
    *   *Gap:* We need a way to run `.sql` files against the DB safely.
    *   *Resolution:* Add Task 1.0: Install/Configure `node-pg-migrate` or create a simple `scripts/migrate.js`.

**Fundamental Found:** `scripts/migrate.js` (Custom Migration Runner).

---

## 2. Analysis of Task 1.2: Plan Import Tool

**Goal:** Ingest a Markdown Plan into DB rows.

*   **L1 (System):** "Import Plan."
*   **L2 (Operation):** "Read & Parse Markdown File."
*   **L3 (Mechanism):** "Convert MD to structured Object (JSON)."
    *   *Constraint:* Markdown is unstructured text.
    *   *Gap:* How do we know which line is a "Task" vs "Subtask"?
    *   *Result:* **Missing Fundamental.**
*   **L4 (Execution):** `markdown-parser.parse()`.
    *   *Constraint:* Need a parser library.
    *   *Check:* `package.json` -> Likely missing `markdown-it` or `marked`.
*   **L5 (Fundamental):** **Strict Markdown Schema.**
    *   *Gap:* We can't parse *any* markdown. We need a specific format (e.g., `# Feature`, `## Task`, `- [ ] Subtask`).
    *   *Resolution:* Define the **"Orion Plan Schema"** (Markdown Syntax Spec).

**Fundamentals Found:**
1.  `npm install markdown-it` (Library).
2.  **Orion Plan Schema Definition** (Protocol).

---

## 3. Analysis of Task 1.3: Plan Viewer UI

**Goal:** Display the Plan Hierarchy in Vue.

*   **L1 (System):** "Show Plan Tree."
*   **L2 (Operation):** "Frontend fetches Plan structure."
*   **L3 (Mechanism):** `GET /api/plans/:id/tree`.
    *   *Constraint:* The DB stores flat rows (`tasks`, `subtasks`). The UI needs a Tree.
    *   *Gap:* Who does the conversion? Backend (SQL Recursive CTE) or Frontend (JS recursion)?
    *   *Risk:* Recursive CTEs are complex to maintain.
    *   *Resolution:* **Frontend Tree Builder.** Backend returns flat JSON, Frontend builds tree.
*   **L4 (Execution):** Render `PlanViewer.vue`.
    *   *Constraint:* Need a Tree Component.
    *   *Check:* We have `FeatureTree.vue`. Can we reuse it?
    *   *Gap:* `FeatureTree.vue` might be hardcoded to `featureData.json` (mock data).
*   **L5 (Fundamental):** **Component Refactor.**
    *   *Gap:* `FeatureTree.vue` needs to accept *props* for data, not import a JSON file.

**Fundamentals Found:**
1.  **Backend Endpoint:** `GET /api/plans/:id/items` (Flat list).
2.  **Frontend Utility:** `listToTree.js` (Converter).
3.  **Refactor:** Make `FeatureTree.vue` dumb (props-driven).

---

## 4. Summary of Missing Fundamentals

| Category | Missing Fundamental | Impact | Resolution Task |
| :--- | :--- | :--- | :--- |
| **Infra** | Migration Runner (`scripts/migrate.js`) | Cannot apply schema updates | **Task 1.0:** Create `scripts/migrate.js`. |
| **Protocol** | Orion Plan Schema (Markdown Spec) | Import Tool fails to parse | **Task 1.2a:** Define Schema doc. |
| **Lib** | `markdown-it` | Cannot parse plan | **Task 1.2b:** `npm install markdown-it`. |
| **Frontend** | `listToTree.js` | UI cannot display hierarchy | **Task 1.3a:** Implement Tree Utility. |
| **Refactor** | `FeatureTree.vue` Decoupling | UI tied to mock data | **Task 1.3b:** Refactor Component. |

---

## 5. Recommendation

Update **Feature 1 Implementation Requirements** to include these 5 new Tasks.
