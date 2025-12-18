# FRACTAL ANALYSIS v6 (Full Recursive Trace, Protocol-Hardened)

**Target:** Feature 1 (Orion Foundation)  
**Goal:** Exhaustive, depth-by-depth FAP with explicit CDP recursion, atomic actions, and stop conditions.

---

## Task 1-0: Database Migration Infrastructure

### CDP Level 1 (Atomic Actions)
- action: "Read migration files from directory"
- action: "Sort migration files by TIMESTAMP_"
- action: "Connect to database"
- action: "Execute SQL files in transaction"
- action: "Rollback transaction on error"

#### Drilldown: "Read migration files from directory"
- CDP Level 2:
  - action: "List directory contents"
    - Primitive: FS: list_directory
    - Tool Exists: Yes (Node.js fs.readdir)
    - Knowledge Exists: Yes (API known)
    - Access Exists: Yes (read permission)
    - Dependency Audit: OK
  - action: "Read file contents"
    - Primitive: FS: read_file
    - Tool Exists: Yes (Node.js fs.readFile)
    - Knowledge Exists: Yes
    - Access Exists: Yes
    - Dependency Audit: OK

#### Drilldown: "Sort migration files by TIMESTAMP_"
- CDP Level 2:
  - action: "Sort array of filenames"
    - Primitive: JS Array.sort
    - Tool Exists: Yes (JS runtime)
    - Knowledge Exists: Yes
    - Access Exists: Yes
    - Dependency Audit: OK

#### Drilldown: "Connect to database"
- CDP Level 2:
  - action: "Create pg client"
    - Primitive: DB: postgres_connection
    - Tool Exists: Yes (pg library)
    - Knowledge Exists: Yes
    - Access Exists: Yes (env config)
    - Dependency Audit: OK

#### Drilldown: "Execute SQL files in transaction"
- CDP Level 2:
  - action: "Begin transaction"
    - Primitive: DB: execute_sql
    - Tool Exists: Yes
    - Knowledge Exists: Yes
    - Access Exists: Yes
    - Dependency Audit: OK
  - action: "Run SQL statements"
    - Primitive: DB: execute_sql
    - Tool Exists: Yes
    - Knowledge Exists: Yes
    - Access Exists: Yes
    - Dependency Audit: OK
  - action: "Commit transaction"
    - Primitive: DB: execute_sql
    - Tool Exists: Yes
    - Knowledge Exists: Yes
    - Access Exists: Yes
    - Dependency Audit: OK

#### Drilldown: "Rollback transaction on error"
- CDP Level 2:
  - action: "Rollback transaction"
    - Primitive: DB: execute_sql
    - Tool Exists: Yes
    - Knowledge Exists: Yes
    - Access Exists: Yes
    - Dependency Audit: OK

---

## Task 1-1: Database Schema Setup

### CDP Level 1 (Atomic Actions)
- action: "Run migration SQL file"
- action: "Verify tables and columns"
- action: "Verify ON DELETE CASCADE constraints"

#### Drilldown: "Run migration SQL file"
- CDP Level 2:
  - action: "Connect to DB"
    - Primitive: DB: postgres_connection (see above)
  - action: "Execute SQL"
    - Primitive: DB: execute_sql (see above)

#### Drilldown: "Verify tables and columns"
- CDP Level 2:
  - action: "Query information_schema"
    - Primitive: DB: execute_sql
    - Tool Exists: Yes
    - Knowledge Exists: Yes
    - Access Exists: Yes
    - Dependency Audit: OK

#### Drilldown: "Verify ON DELETE CASCADE constraints"
- CDP Level 2:
  - action: "Query pg_constraint"
    - Primitive: DB: execute_sql
    - Tool Exists: Yes
    - Knowledge Exists: Yes
    - Access Exists: Yes
    - Dependency Audit: OK

---

## Task 1-2: Plan Import Tool

### CDP Level 1 (Atomic Actions)
- action: "Validate JSON input"
- action: "Parse Markdown input"
- action: "Insert features/tasks/subtasks"
- action: "Detect file extension"

#### Drilldown: "Validate JSON input"
- CDP Level 2:
  - action: "Check schema with zod"
    - Primitive: VALIDATION: json_schema
    - Tool Exists: Yes (zod)
    - Knowledge Exists: Yes
    - Access Exists: Yes
    - Dependency Audit: OK

#### Drilldown: "Parse Markdown input"
- CDP Level 2:
  - action: "Parse markdown with markdown-it"
    - Primitive: VALIDATION: markdown_parsing
    - Tool Exists: Yes (markdown-it)
    - Knowledge Exists: Yes
    - Access Exists: Yes
    - Dependency Audit: OK

#### Drilldown: "Insert features/tasks/subtasks"
- CDP Level 2:
  - action: "Connect to DB"
    - Primitive: DB: postgres_connection (see above)
  - action: "Insert row"
    - Primitive: DB: execute_sql
    - Tool Exists: Yes
    - Knowledge Exists: Yes
    - Access Exists: Yes
    - Dependency Audit: OK

#### Drilldown: "Detect file extension"
- CDP Level 2:
  - action: "Check file extension"
    - Primitive: CLI: execute_command
    - Tool Exists: Yes (Node.js path.extname)
    - Knowledge Exists: Yes
    - Access Exists: Yes
    - Dependency Audit: OK

---

## Task 1-3: Plan Viewer UI

### CDP Level 1 (Atomic Actions)
- action: "Fetch plan tree from backend"
- action: "Transform flat data to tree"
- action: "Render Vue components"
- action: "Render icons"
- action: "Apply Tailwind styling"

#### Drilldown: "Fetch plan tree from backend"
- CDP Level 2:
  - action: "HTTP GET request"
    - Primitive: HTTP: fetch_api
    - Tool Exists: Yes (fetch/axios)
    - Knowledge Exists: Yes
    - Access Exists: Yes
    - Dependency Audit: OK

#### Drilldown: "Transform flat data to tree"
- CDP Level 2:
  - action: "Run tree-building algorithm"
    - Primitive: JS logic (Array/Object manipulation)
    - Tool Exists: Yes (JS runtime)
    - Knowledge Exists: Yes
    - Access Exists: Yes
    - Dependency Audit: OK

#### Drilldown: "Render Vue components"
- CDP Level 2:
  - action: "Mount Vue component"
    - Primitive: UI: vue_component
    - Tool Exists: Yes (Vue 3)
    - Knowledge Exists: Yes
    - Access Exists: Yes
    - Dependency Audit: OK

#### Drilldown: "Render icons"
- CDP Level 2:
  - action: "Import and render icon"
    - Primitive: UI: icon_rendering
    - Tool Exists: Yes (lucide-vue-next)
    - Knowledge Exists: Yes
    - Access Exists: Yes
    - Dependency Audit: OK

#### Drilldown: "Apply Tailwind styling"
- CDP Level 2:
  - action: "Apply Tailwind class"
    - Primitive: UI: tailwind_styling
    - Tool Exists: Yes (Tailwind CSS)
    - Knowledge Exists: Yes
    - Access Exists: Yes
    - Dependency Audit: OK

---

## Summary

- All atomic actions for every task have been recursively drilled down to primitives.
- Every leaf node is mapped to a primitive in the registry, with explicit Tool/Knowledge/Access checks.
- No new missing fundamentals or protocol gaps were found.

**Feature 1 is fully decomposed and ready for implementation.**
