# AI Filesystem Tools — RED v2 Analysis v1.0

## 1. Overview

**Goal:** An AI agent (Orion/Tara/Devon-like) can safely use filesystem tools to **read**, **write**, and **find** files in the project, in response to user requests.

**Assumed current truth (from you):**
- Chat UI works.
- LLM is wired up and responding.
- Context + prompts are already set up for general conversation.

This RED v2 analysis focuses on **adding filesystem capabilities** to that existing setup, with emphasis on:
- Safety (sandboxing, environment boundaries).
- Correctness (working directory, path policies).
- Observability (audit, rollback hooks).
- Hidden assumptions (especially around access, knowledge, and ops).

---

## 2. RED Breakdown — Expanded Tables

### 2.1. Level 1 → Level 2

**L1 System Goal:** "AI agent can perform filesystem operations (read/write/find) on project files when requested by the user."

| L1 Action (Parent)                                | L2 Action (Child)                                    | Resources Touched                  | Resources Required                                     | Output                                        | Primitive? |
|---------------------------------------------------|------------------------------------------------------|------------------------------------|--------------------------------------------------------|-----------------------------------------------|-----------:|
| User requests filesystem action via chat          | User types natural language instruction              | DOM, Browser Memory                | Browser, UI loaded                                     | User instruction text                         | ✓         |
|                                                   | User sends message                                   | DOM, Browser Event System          | Browser, UI loaded                                     | Send event                                    | ✓         |
| Chat backend receives user request                | Backend receives POST /api/chat                      | Node.js HTTP, Express              | Node.js, Express server running, API route defined     | Chat request payload                          | ✓         |
|                                                   | Backend stores chat message (optional)               | PostgreSQL, pg lib, Network        | DB running, connection, messages table                 | Persisted chat message (DB row)               | ✗ (👤)     |
| Agent decides if filesystem action is needed      | LLM interprets intent (FS vs normal answer)          | LLM API, Network                   | Prompt template/config, DeepSeek key/endpoint          | Intent classification                         | ✗ (👤)     |
|                                                   | Agent planner maps intent to FS operation type       | Node.js, Memory                    | Planning logic/module                                 | Operation plan (read/write/find)             | ✗          |
| Agent invokes filesystem tool                     | Agent constructs tool call arguments                 | Node.js, Memory                    | Operation plan, path policy, sandbox config            | Tool call request (op + path + options)       | ✗          |
|                                                   | Permission/path checks before execution              | Node.js, Config                    | Sandbox rules, allowed paths, environment policy       | Allow/deny decision                           | ✗ (👤)     |
|                                                   | Dispatch to specific FS tool (read/write/find)       | Node.js, FS API, Tool surface      | Implemented tool API, file system access               | FS operation invocation                       | ✓         |
| Filesystem tool performs operation                | Read file contents                                   | File System, Node.js               | Read permission, valid path                            | File contents                                 | ✓         |
|                                                   | Write file contents                                  | File System, Node.js               | Write permission, valid path                           | Modified file                                 | ✓         |
|                                                   | Search/find files                                    | File System, Node.js               | Directory access, search criteria                      | List of matching files                        | ✓         |
|                                                   | Record audit log (who/what/when/where)              | File System/DB, Node.js            | Audit sink (file or table)                             | Audit entry                                   | ✗ (👤)     |
| Return results back to agent and user             | Tool returns result/error to agent                   | Node.js, Memory                    | Structured result schema                               | FS result (success/error + data)             | ✓         |
|                                                   | Agent formats result into natural language           | LLM API (optional), Node.js        | Prompt template (for summarization)                    | Human-readable explanation                    | ✗ (👤)     |
|                                                   | Backend sends response to frontend                   | Node.js HTTP, Network              | Response schema, network access                        | HTTP response payload                         | ✓         |
|                                                   | Frontend updates chat UI with result                 | DOM, Browser Memory                | Browser, UI loaded                                     | UI update (chat + maybe diff/preview)        | ✓         |

---

### 2.2. Level 2 → Level 3 (Selected Deep Dives)

#### 2.2.1 Agent decides if filesystem action is needed

| L2 Action (Parent)                      | L3 Action (Child)                                  | Resources Touched      | Resources Required                                   | Output                         | Primitive? |
|----------------------------------------|----------------------------------------------------|------------------------|------------------------------------------------------|--------------------------------|-----------:|
| LLM interprets intent                  | Classify request as FS/non-FS                     | LLM API, Network       | Prompt with examples, intent labels                  | FS/non-FS decision             | ✗ (👤)     |
| Agent planner maps intent to FS op    | Parse path, operation kind, scope                 | Node.js, Memory        | Knowledge of path conventions, repo layout           | Parsed operation spec          | ✗ (👤)     |
|                                        | Validate operation against policy (allowed op?)   | Node.js, Config        | Policy config (allowed ops per role/environment)     | Allow/deny decision            | ✗ (👤)     |

#### 2.2.2 Permission/path checks before execution

| L2 Action (Parent)                     | L3 Action (Child)                                  | Resources Touched      | Resources Required                                   | Output                         | Primitive? |
|----------------------------------------|----------------------------------------------------|------------------------|------------------------------------------------------|--------------------------------|-----------:|
| Permission/path checks                 | Normalize path relative to sandbox root            | Node.js, Path module   | Sandbox root config, working directory convention    | Normalized path                | ✓         |
|                                        | Check path against allow/deny rules               | Node.js, Config        | Allowlist/denylist patterns                          | Pass/fail decision             | ✗ (👤)     |
|                                        | Check environment (dev/test/prod) policy           | Node.js, Env vars      | Environment flags, policy config                     | Pass/fail decision             | ✗ (👤)     |

#### 2.2.3 Record audit log

| L2 Action (Parent)                     | L3 Action (Child)                                  | Resources Touched      | Resources Required                                   | Output                         | Primitive? |
|----------------------------------------|----------------------------------------------------|------------------------|------------------------------------------------------|--------------------------------|-----------:|
| Record audit log                       | Build audit entry (who/what/when/where)           | Node.js, Memory        | User/session ID, tool call payload, timestamp        | Audit record in memory         | ✓         |
|                                        | Persist audit entry                                | File System/DB, Node.js| Audit storage (file or table), write permission      | Persisted audit entry          | ✓         |

---

### 2.3. Level 3 → Level 4 (If Needed)

Most L3 actions map directly to primitives (`fs.readFile`, `fs.writeFile`, `path.resolve`, DB inserts, etc.). Where they do not, RED v2 will push them into the **Tools/Inputs/Knowledge audits** below.

---

## 3. Tools, Inputs, Outputs & Knowledge Audits (RED v2)

### 3.1. Tools Audit (Resources Touched)

| Tool / Resource Touched        | Where Used (Action)                           | VERIFIED_HAVE / MISSING | Verification Method                        | ✓ Verified |
|--------------------------------|-----------------------------------------------|-------------------------|-------------------------------------------|-----------:|
| `fs` (Node.js filesystem)      | Read/write/search project files               | VERIFIED_HAVE           | Code review (Node.js standard lib)        | ✓          |
| `path` module                  | Normalize and join paths                      | VERIFIED_HAVE           | Code review (Node.js standard lib)        | ✓          |
| Project file system (disk)     | All FS operations                             | VERIFIED_HAVE           | Assumed (local dev environment)           |            |
| Express HTTP server            | /api/chat, tool invocation endpoints          | VERIFIED_HAVE           | Code review (existing backend)            | ✓          |
| LLM API (DeepSeek or similar)  | Intent classification, explanation, planning  | VERIFIED_HAVE           | Existing chat integration (assumed)       |            |
| Tooling surface (FS tools API) | `read_file`, `write_file`, `search_files`     | MISSING                 | No concrete tool layer yet                | ✓ (search) |
| Audit sink (file/DB)           | Persist filesystem audit logs                 | MISSING                 | No audit table/log file defined           | ✓ (search) |
| Environment flags              | dev/test/prod separation for FS ops           | MISSING                 | Not specified in code/docs                |            |

> **Note:** We assume Node.js standard libs exist, but the **custom FS tool surface** and **audit sink** are intentionally treated as **MISSING**, since they need to be designed/implemented.

---

### 3.2. Inputs Audit (Resources Required)

> **Key Principle:** Distinguish between what the **design requires** and what is **currently present and verified**. Anything design-required but not explicitly verified is **MISSING**.

| Input / Resource Required         | Where Used (Action)                           | Design Required? | Present Now? | VERIFIED_HAVE / MISSING | 👤 Architect Decision Needed | Verification Method                          | ✓ Verified |
|-----------------------------------|-----------------------------------------------|------------------|--------------|-------------------------|-----------------------------|---------------------------------------------|-----------:|
| Sandbox root path (project root) | Path normalization, safety checks             | Yes              | No           | MISSING                 | 👤                           | Not specified in current design/docs        |            |
| Path allowlist/denylist rules    | Permission/path checks                        | Yes              | No           | MISSING                 | 👤                           | No explicit FS policy config                |            |
| Environment policy (dev/test/prod)| Limit FS ops per environment                  | Yes              | No           | MISSING                 | 👤                           | No env-based FS policy specified            |            |
| Messages/audit tables            | Persist audit + FS-related events             | Yes              | No           | MISSING                 |                             | DB migrations & schema not defined          | ✓          |
| FS tool API contracts            | Agent → tool invocation                        | Yes              | No           | MISSING                 | 👤                           | No `read_file/write_file/search` spec       | ✓ (search) |
| Prompt template for FS intents   | LLM classification & explanation               | Yes              | No           | MISSING                 | 👤                           | No FS-specific prompt template found        | ✓ (search) |
| Project structure knowledge      | Map paths to meaningful locations              | Yes              | No           | MISSING                 | 👤                           | No explicit structure map or doc            |            |
| User/session identity            | Audit logging                                  | Yes              | Partial      | MISSING                 |                             | Depends on existing auth/session design     |            |
| Rollback strategy (git/backup)  | Undo harmful writes                            | Yes              | No           | MISSING                 | 👤                           | No rollback/backup workflow defined         |            |
| Concurrency policy for FS ops   | Avoid colliding writes                         | Yes              | No           | MISSING                 | 👤                           | Not specified in code/docs                   |            |

---

### 3.3. Outputs Audit (Artifacts/State)

| Output / Artifact Produced        | Produced by (Action)                        | Depended on by (Action)                         | Auto / Scheduled |
|-----------------------------------|---------------------------------------------|-------------------------------------------------|------------------|
| FS read result (file contents)    | `read_file` tool                            | LLM reasoning, response to user                 | Auto             |
| FS write result (modified file)   | `write_file` tool                           | Subsequent tests, git status, further edits     | Auto             |
| FS search result (matches)        | `search_files` tool                         | Agent selection of target files                 | Auto             |
| Audit entry (FS op log)           | Audit logger                                | Forensics, rollback, safety review              | Auto             |
| Error report (permission/path)    | Permission/path checks, tool errors         | User feedback, retry/fix prompts                | Auto             |

> Hidden risk: **Modified files without corresponding audit entries** → impossible to trace or roll back.

---

### 3.4. Knowledge Audit (New in RED v2.1)

| Knowledge Required                | Where Used (Action)                           | Knowledge Required? | Present Now? | VERIFIED_HAVE / MISSING | Verification Method                       | ✓ Verified | 👤 Architect Decision Needed |
|-----------------------------------|-----------------------------------------------|---------------------|--------------|-------------------------|------------------------------------------|-----------:|------------------------------|
| LLM prompt engineering for FS     | Intent classification, FS explanations       | Yes                 | Unknown      | MISSING                 | No FS-specific prompt examples in repo   |            | 👤                            |
| Project structure & conventions   | Mapping user intent to actual file paths     | Yes                 | No           | MISSING                 | No structure map / conventions doc       |            | 👤                            |
| Safe FS operation patterns        | Designing path/sandbox policies              | Yes                 | Partial      | MISSING                 | General experience, but no formalized SOP|            | 👤                            |
| Rollback & disaster recovery      | Handling bad writes                           | Yes                 | No           | MISSING                 | No documented rollback strategy          |            | 👤                            |
| Operational ownership             | Who approves/runs risky FS changes           | Yes                 | No           | MISSING                 | No Ops/Owner defined for FS tools        |            | 👤                            |

---

## 4. Missing Fundamentals (Design Required but Not Present)

From the audits above, the key **Missing Fundamentals** for “AI FS tools” are:

| Category         | Missing Fundamental                                      | Impact                                                | Resolution Task / Input Needed                      |
|------------------|----------------------------------------------------------|-------------------------------------------------------|-----------------------------------------------------|
| Tooling          | Explicit FS tool API surface (`read_file`, `write_file`, `search_files`) | Agent cannot perform controlled FS ops                | Design & implement FS tool layer with clear contracts |
| Policy           | Sandbox root + path allowlist/denylist rules            | Risk of reading/writing outside intended scope       | 👤 Define sandbox root and path policy              |
| Policy           | Environment-based FS policy (dev/test/prod)             | Risky ops in production                              | 👤 Define env-specific FS permissions               |
| Data Model       | Audit log storage (file or DB table)                    | No traceability of changes                           | Design & add audit sink (schema + write path)       |
| LLM Config       | FS-specific prompt template/config                       | Poor intent detection & explanations                 | 👤 Design FS prompt templates/examples              |
| Knowledge        | Project structure & conventions                          | Agent guesses paths blindly                          | 👤 Document project layout & path conventions       |
| Safety           | Rollback strategy for file writes                       | Hard/impossible to recover from bad edits            | 👤 Define rollback policy (git, backups, etc.)      |
| Concurrency      | Policy for concurrent FS operations                     | Race conditions & inconsistent state                 | 👤 Define concurrency rules for agent(s)            |
| Ops/Ownership    | Owner/approval flow for risky FS ops                    | No one accountable; unsafe changes slip through      | 👤 Assign operational ownership & approval rules    |

---

## 5. Dependency & Assumption Audit (Global)

| Category   | Status         | Detail                                        | Verification Method                  | ✓ Verified | Resolution Task                                 |
|------------|----------------|-----------------------------------------------|--------------------------------------|-----------:|------------------------------------------------|
| Tool       | VERIFIED_HAVE  | Node.js `fs`, `path`, Express, LLM API client | Code review, existing chat backend   | ✓          | —                                              |
| Tool       | MISSING        | FS tool abstraction layer + audit sink        | Code search (not found)              | ✓          | Design & implement tools + audit store         |
| Access     | MISSING        | DB/audit storage for FS logs                  | No specific table/file defined       |            | Add audit storage + migrations if needed       |
| Access     | MISSING        | Sandboxed FS access (root + rules)           | No explicit config                    |            | Define sandbox config & enforcement layer      |
| Knowledge  | MISSING        | FS-safe operation patterns & rollback SOP     | No SOP doc                            |            | Create FS safety/rollback guidelines           |
| Physics    | VERIFIED_HAVE  | Single-process, local disk for early phases   | Assumed dev environment               |            | Re-evaluate for multi-agent/concurrent future  |

---

## 6. Likely Hidden Assumption (Called Out)

The most likely **hidden assumption** RED exposes here is:

> **“Working directory and path semantics are obvious and safe by default.”**

In reality:
- The agent must know **exactly** which directory is the sandbox root.
- All paths must be resolved relative to that root, not the OS root or some arbitrary CWD.
- Without explicit policy, it’s easy to:
  - Read/write outside the repo.
  - Modify generated artifacts instead of source files.
  - Clash with other tools using the same working directory.

This must become an explicit **sandbox root + path policy decision** in the design.

---

## 7. Summary

Even with chat + LLM + prompts already working, a full RED v2 analysis for AI filesystem tools shows that:
- The core primitives (`fs.readFile`, etc.) exist, but the **tool surface, policies, and knowledge** around them are missing.
- The largest risks are **sandboxing, rollback, and operational ownership**, not the raw ability to read/write files.
- Turning these gaps into concrete tasks (tool contracts, policies, docs, SOPs) is critical before implementation, or the system will “work” in demos but fail on safety and reliability in real usage.
