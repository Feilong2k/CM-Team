# FRACTAL ANALYSIS v3 (Deep Recursive CDP)

**Target:** Task 1-2: Plan Import Tool
**Goal:** Ingest a Markdown Plan into DB rows.

---

## Recursive CDP Execution

### [Depth 0] Goal: Import Plan
**CDP Level 1 (Atomic Actions):**
1.  Read File from Disk.
2.  Parse Content.
3.  Validate Structure.
4.  Write to DB.

---

### [Depth 1] Action 1: Read File from Disk
**CDP Level 1 (Sub-Actions):**
1.  Resolve File Path.
2.  Open File Stream.
3.  Handle Encoding (UTF-8).

**Drill Down:**
*   **Resolve Path:** Primitive (Node `path.resolve`). -> **Constraint:** Is the path absolute or relative? -> **Assumption:** CLI argument is relative to CWD.
*   **Open Stream:** Primitive (Node `fs.readFile`). -> **Constraint:** Permissions? -> **Assumption:** User has read access.
*   **Encoding:** Primitive.

**Status:** **CLEARED** (Standard Primitives).

---

### [Depth 1] Action 2: Parse Content
**CDP Level 1 (Sub-Actions):**
1.  Tokenize Markdown.
2.  Build AST (Abstract Syntax Tree).
3.  Traverse AST to extract Hierarchy.

**Drill Down:**
*   **Tokenize/Build AST:** Not a Primitive. -> **Constraint:** Need a library. -> **Action:** `npm install markdown-it`. -> **CHECK:** `package.json`. (**GAP FOUND**)
*   **Traverse AST:**
    *   **Sub-Action 2a:** Identify "Feature" (H1).
    *   **Sub-Action 2b:** Identify "Task" (H2).
    *   **Sub-Action 2c:** Identify "Subtask" (List Item).

**Drill Down (Traverse):**
*   **Identify Feature:** Regex/Token Check `type === 'heading_open' && tag === 'h1'`. -> **Primitive.**
*   **Identify Subtask:** Token Check `type === 'inline'`. -> **Constraint:** Does the content match `- [ ]`? -> **Risk:** What if user types `* [ ]`? -> **Requirement:** Define **Strict Syntax Spec**. (**GAP FOUND**)

---

### [Depth 1] Action 3: Validate Structure
**CDP Level 1 (Sub-Actions):**
1.  Check for Orphans (Tasks without Features).
2.  Check for Duplicates (IDs).

**Drill Down:**
*   **Orphans:** Logic check. `if (!currentFeature) throw Error`. -> **Primitive.**
*   **Duplicates:** Logic check. `Set<ID>.has(id)`. -> **Primitive.**

**Status:** **CLEARED**.

---

### [Depth 1] Action 4: Write to DB
**CDP Level 1 (Sub-Actions):**
1.  Connect to DB.
2.  Start Transaction.
3.  Insert `planning_docs`.
4.  Insert `tasks` (Foreign Key -> planning_doc).
5.  Insert `subtasks` (Foreign Key -> task).
6.  Commit/Rollback.

**Drill Down:**
*   **Connect:** Primitive (`pg.Client`). -> **Dependency:** `db.js` config. -> **CHECK:** File exists? (**GAP FOUND**: `backend/config/db.js` missing).
*   **Transaction:** Primitive (`BEGIN`).
*   **Insert Subtasks:**
    *   **Constraint:** Subtask has `jsonb` fields (`basic_info`, etc.).
    *   **Source:** Where does `basic_info` come from in the Markdown?
    *   **Analysis:** The Markdown just says `- [ ] Do X`. It doesn't have the JSON data.
    *   **Gap (CRITICAL):** The Import Tool *cannot* populate the rich JSONB fields because the source format (Markdown) doesn't support them.
    *   **Resolution:** We need a **JSON Import** option OR a **Rich Markdown** spec (Frontmatter?). Or we accept that Import only populates `title`. -> **Assumption Locked:** Import only populates Titles.

---

## Summary of Findings (The Leaf Nodes)

| Scope | Primitive | Status | Action Required |
| :--- | :--- | :--- | :--- |
| **Parsing** | `markdown-it` Lib | **MISSING** | `npm install markdown-it` |
| **Parsing** | Syntax Regex | **UNDEFINED** | Create **Markdown Syntax Spec** (e.g., must use `- [ ]`) |
| **DB** | `db.js` | **MISSING** | Create DB Config file |
| **Data** | `subtask.basic_info` | **UNSOURCEABLE** | **Decision:** Import only populates Title/Status. UI used for enrichment. |

---

## Verdict
This Deep Recursive Analysis found a **Logical Gap** (Data Enrichment) that the shallow analysis missed. We now know that "Importing" is lossy (Rich Data vs Plain Text), and we have a mitigation strategy (UI Enrichment).
