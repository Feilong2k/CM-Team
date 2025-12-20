# Feature 2: Orion Chat & Context — RED (Recursive Execution Decomposition) Analysis

## 1. Overview

This document presents a full RED (Recursive Execution Decomposition, formerly FAP) analysis for Feature 2: Orion Chat & Context. Each task is recursively decomposed into atomic actions, with all parent→child relationships fully expanded. For each mapping, resources touched, resources required, output, and primitive status are shown.

---

## 2. RED Breakdown — Expanded Tables

### 2.1. Level 1 → Level 2

| L1 Action (Parent)                  | L2 Action (Child)                        | Resources Touched                | Resources Required                                 | Output                                 | Primitive? |
|-------------------------------------|------------------------------------------|----------------------------------|----------------------------------------------------|----------------------------------------|------------|
| User sends message via Chat UI      | User types message in input field        | DOM, Browser Memory              | Browser, UI loaded                                 | User message (input)                   | ✓          |
| User sends message via Chat UI      | User clicks "Send" button                | DOM, Browser Event System        | Browser, UI loaded                                 | Send event                             | ✓          |
| User sends message via Chat UI      | UI validates input                       | JS Engine, Browser Memory        | Browser, JS runtime                                | Validated input                        | ✓          |
| User sends message via Chat UI      | UI sends POST /api/chat                  | Browser Fetch/XHR, Network       | Browser, Network access, API endpoint available    | HTTP request (user message)            | ✓          |
| Backend receives and stores message | Express route receives POST /api/chat    | Node.js HTTP, Express            | Node.js, Express server running, API route defined | HTTP request received                  | ✓          |
| Backend receives and stores message | Middleware validates request body        | Node.js, Express                 | Node.js, Express, validation logic                 | Validated request                      | ✓          |
| Backend receives and stores message | Controller calls service to persist msg  | Node.js, Express                 | Node.js, Express, service module                   | Service call (message data)            | ✓          |
| Backend receives and stores message | Service inserts message into DB          | PostgreSQL, pg lib, Network      | PostgreSQL running, DB connection, pg lib, table   | Persisted chat message (DB row)        | ✓          |
| ContextBuilder gathers context      | Service determines context scope         | Node.js, Config, File System     | Node.js, config file, file system access           | Context scope                          | ✗ (👤)     |
| ContextBuilder gathers context      | Calls list_files tool                    | File System, Node.js             | Node.js, file system access, tool implemented      | File list                              | ✓          |
| ContextBuilder gathers context      | Calls search_files tool                  | File System, Node.js             | Node.js, file system access, tool implemented      | Search results                         | ✓          |
| ContextBuilder gathers context      | Reads file contents                      | File System, Node.js             | Node.js, file system access                        | File contents                          | ✓          |
| ContextBuilder gathers context      | Aggregates context data                  | Node.js, Memory                  | Node.js, sufficient memory                         | Context data (file contents, etc)      | ✓          |
| Orion generates response/plan       | Prepares prompt for LLM                  | Node.js, Memory                  | Node.js, prompt template/config                    | LLM prompt                             | ✓          |
| Orion generates response/plan       | Calls LLM API (DeepSeek)                 | Network, DeepSeek API            | Network access, DeepSeek API key, endpoint         | LLM response                           | ✓          |
| Orion generates response/plan       | Receives response                        | Network, Node.js                 | Network access, LLM API available                  | LLM response (received)                | ✓          |
| Backend stores Orion's response     | Service inserts response into DB         | PostgreSQL, pg lib, Network      | PostgreSQL running, DB connection, pg lib, table   | Persisted Orion response (DB row)      | ✓          |
| Frontend displays Orion's response  | Receives response from backend           | Browser Fetch/XHR, Network       | Browser, network access, backend running           | Response data (for UI)                 | ✓          |
| Frontend displays Orion's response  | Updates chat log UI                      | DOM, Browser Memory              | Browser, UI loaded                                 | UI update (chat log)                   | ✓          |
| User triggers "Plan This" intent    | User clicks "Plan This" button           | DOM, Browser Event System        | Browser, UI loaded                                 | Plan This event                        | ✓          |
| User triggers "Plan This" intent    | UI sends request to backend              | Browser Fetch/XHR, Network       | Browser, network access, backend running           | HTTP request (plan intent)             | ✓          |
| User triggers "Plan This" intent    | Backend creates draft plan entry in DB   | PostgreSQL, pg lib, Network      | PostgreSQL running, DB connection, pg lib, table   | Plan draft entry (DB row)              | ✓          |

---

### 2.2. Level 2 → Level 3 (Selected Deep Dives)

#### ContextBuilder gathers context → Service determines context scope

| L2 Action (Parent)                  | L3 Action (Child)                        | Resources Touched                | Resources Required                                 | Output                | Primitive? |
|-------------------------------------|------------------------------------------|----------------------------------|----------------------------------------------------|-----------------------|------------|
| Service determines context scope    | Read config/defaults                     | File System, Node.js             | Node.js, config file, file system access           | Default context scope | ✓          |
| Service determines context scope    | (👤) Apply user/project overrides         | Config, Node.js                  | Node.js, user/project config, file system access   | Final context scope   | ✗ (👤)     |

#### UI validates input

| L2 Action (Parent)                  | L3 Action (Child)                        | Resources Touched                | Resources Required                                 | Output           | Primitive? |
|-------------------------------------|------------------------------------------|----------------------------------|----------------------------------------------------|------------------|------------|
| UI validates input                  | Check for empty string                   | JS Engine, Browser Memory        | Browser, JS runtime                                | Pass/fail result | ✓          |
| UI validates input                  | Check for max length                     | JS Engine, Browser Memory        | Browser, JS runtime                                | Pass/fail result | ✓          |

#### Middleware validates request body

| L2 Action (Parent)                  | L3 Action (Child)                        | Resources Touched                | Resources Required                                 | Output           | Primitive? |
|-------------------------------------|------------------------------------------|----------------------------------|----------------------------------------------------|------------------|------------|
| Middleware validates request body   | Check for required fields                | Node.js, Express                 | Node.js, Express, validation logic                 | Pass/fail result | ✓          |
| Middleware validates request body   | Check for valid types                    | Node.js, Express                 | Node.js, Express, validation logic                 | Pass/fail result | ✓          |

---

### 2.3. Level 3 → Level 4 (If Needed)

Most L3 actions above are primitives. If further breakdown is needed (e.g., "Apply user/project overrides"), expand as:

| L3 Action (Parent)                  | L4 Action (Child)                        | Resources Touched                | Resources Required                                 | Output                | Primitive? |
|-------------------------------------|------------------------------------------|----------------------------------|----------------------------------------------------|-----------------------|------------|
| (👤) Apply user/project overrides    | Read user/project config                 | File System, Node.js             | Node.js, user/project config, file system access   | User/project config   | ✓          |
| (👤) Apply user/project overrides    | Merge config with defaults               | Node.js, Memory                  | Node.js, config data in memory                     | Final context scope   | ✓          |

---

## 3. Tools, Inputs, and Outputs Audit

### 3.1. Tools Audit (Resources Touched)

| Tool / Resource Touched   | Where Used (Action)                                   | VERIFIED_HAVE / MISSING |
|--------------------------|-------------------------------------------------------|------------------------|
| DOM                      | UI input, button, chat log update                     | VERIFIED_HAVE          |
| Browser Memory           | UI input, validation                                  | VERIFIED_HAVE          |
| Browser Event System     | Button clicks, Plan This                              | VERIFIED_HAVE          |
| JS Engine                | UI validation                                         | VERIFIED_HAVE          |
| Browser Fetch/XHR        | UI sends requests, receives responses                 | VERIFIED_HAVE          |
| Network                  | UI/backend/LLM API communication                      | VERIFIED_HAVE          |
| Node.js                  | Backend, ContextBuilder, config, file ops             | VERIFIED_HAVE          |
| Express                  | Backend API, middleware                               | VERIFIED_HAVE          |
| PostgreSQL               | Store/retrieve messages, plans, responses             | VERIFIED_HAVE          |
| pg lib                   | DB access from Node.js                                | VERIFIED_HAVE          |
| File System              | ContextBuilder, config, file reads                    | VERIFIED_HAVE          |
| DeepSeek API             | LLM API call                                          | VERIFIED_HAVE          |
| Config                   | Context scope, user/project overrides                 | VERIFIED_HAVE          |
| Memory                   | Data aggregation, prompt prep                         | VERIFIED_HAVE          |
| Service module           | Backend business logic                                | VERIFIED_HAVE          |

---

### 3.2. Inputs Audit (Resources Required)

| Input / Resource Required         | Where Used (Action)                                 | VERIFIED_HAVE / MISSING | 👤 Architect Decision Needed |
|-----------------------------------|-----------------------------------------------------|------------------------|-----------------------------|
| Browser, UI loaded                | UI input, button, chat log update                   | VERIFIED_HAVE          |                             |
| JS runtime                        | UI validation                                      | VERIFIED_HAVE          |                             |
| Network access                    | UI/backend/LLM API communication                    | VERIFIED_HAVE          |                             |
| API endpoint available            | UI sends POST /api/chat, Plan This                  | VERIFIED_HAVE          |                             |
| Node.js, Express server running   | Backend API, middleware                             | VERIFIED_HAVE          |                             |
| API route defined                 | Backend API                                         | VERIFIED_HAVE          |                             |
| Validation logic                  | Middleware, backend                                 | VERIFIED_HAVE          |                             |
| Service module                    | Backend business logic                              | VERIFIED_HAVE          |                             |
| PostgreSQL running                | Store/retrieve messages, plans, responses           | VERIFIED_HAVE          |                             |
| DB connection                     | Store/retrieve messages, plans, responses           | VERIFIED_HAVE          |                             |
| pg lib                            | DB access from Node.js                              | VERIFIED_HAVE          |                             |
| Table exists                      | Store/retrieve messages, plans, responses           | VERIFIED_HAVE          |                             |
| Config file                       | ContextBuilder, config                              | VERIFIED_HAVE          |                             |
| File system access                | ContextBuilder, config, file reads                  | VERIFIED_HAVE          |                             |
| Tool implemented (list/search)    | ContextBuilder                                      | VERIFIED_HAVE          |                             |
| Sufficient memory                 | Data aggregation, prompt prep                       | VERIFIED_HAVE          |                             |
| Prompt template/config            | LLM prompt prep                                     | MISSING                |        👤                   |
| DeepSeek API key                  | LLM API call                                        | VERIFIED_HAVE          |                             |
| DeepSeek endpoint                 | LLM API call                                        | VERIFIED_HAVE          |                             |
| User/project config               | ContextBuilder overrides                            | MISSING                |        👤                   |
| Max context size for LLM API      | LLM API call                                        | MISSING                |        👤                   |
| Error message standard            | All error handling                                  | MISSING                |        👤                   |
| UI/UX display standard            | Context artifact display                            | MISSING                |        👤                   |
| Concurrency policy                | Chat session handling                               | MISSING                |        👤                   |

---

### 3.3. Outputs Audit

| Output / Artifact Produced        | Produced by (Action)                        | Depended on by (Action)                        | Auto / Scheduled |
|-----------------------------------|---------------------------------------------|------------------------------------------------|------------------|
| User message (input)              | UI sends POST /api/chat                     | Backend receives/stores message                | Auto             |
| Persisted chat message (DB row)   | Service inserts message into DB             | ContextBuilder, frontend display               | Auto             |
| Context data (file contents, etc) | ContextBuilder gathers/aggregates context   | LLM prompt prep, Orion response                | Auto             |
| LLM prompt                        | Orion prepares prompt for LLM               | LLM API call                                   | Auto             |
| LLM response                      | Orion receives response from LLM API        | Backend stores response, frontend display      | Auto             |
| Persisted Orion response (DB row) | Service inserts response into DB            | Frontend display, Plan This intent             | Auto             |
| Plan draft entry (DB row)         | Backend creates draft plan entry in DB      | Plan visualization, further planning           | Scheduled (by user) |
| Error message                     | Any error handling action                   | User, logs, monitoring                         | Auto             |
| UI update (chat log, context)     | Frontend displays Orion's response, context | User interaction, further actions              | Auto             |

---

## 4. Missing Fundamentals

| Category      | Missing Fundamental                        | Impact                        | Resolution Task / Input Needed |
|---------------|--------------------------------------------|-------------------------------|-------------------------------|
| User Overrides| How/where user/project overrides are specified/applied     | Context may not match user intent      | 👤 Architect decision required |
| LLM API       | Max context size for LLM API calls         | May exceed LLM limits         | 👤 Architect decision required |
| Error Handling| Standard for user-facing error messages    | Inconsistent UX               | 👤 Architect decision required |
| UI/UX         | Where/how to display context artifacts     | Usability, discoverability    | 👤 Architect decision required |
| Concurrency   | Handling concurrent chat sessions          | Data consistency, race cond.  | 👤 Architect decision required |

*👤 = Input/decision required from architect/user*

---

## 5. Dependency & Assumption Audit

| Category   | Status         | Detail                        | Verification Method           | Resolution Task               |
|------------|---------------|-------------------------------|------------------------------|-------------------------------|
| Tool       | VERIFIED_HAVE | Node.js, Express, pg, fetch   | npm list, code review        | —                             |
| Knowledge  | VERIFIED_HAVE | API/DB/FS usage               | Docs, code review            | —                             |
| Access     | VERIFIED_HAVE | DB creds, API keys            | Test connection, .env check  | —                             |
| Physics    | VERIFIED_HAVE | Single-user, atomic ops       | Review architecture          | —                             |
| Tool       | MISSING       | None (all primitives covered) |                              |                               |

*Note: The row above means that every atomic action in this RED analysis maps to a known, available primitive (see Primitive Registry). If a required tool or primitive were missing, it would be listed here with details and a resolution task. In this case, no missing tools were found, so this row confirms the audit is complete and all technical primitives are covered.*

---

## 6. Summary

This RED analysis now includes both the full step-by-step breakdown tables (with outputs) and the unique tools/inputs/outputs audit tables, providing a complete, dependency-aware, and actionable view of Feature 2.
