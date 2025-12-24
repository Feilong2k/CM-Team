# Feature 2: Orion Chat & Context — RED (Recursive Execution Decomposition) Analysis v1.1

## 1. Overview

This version presents only the unique Tools, Inputs, and Outputs audit tables for Feature 2, with explicit verification methods and checkmarks indicating which items were actually verified in the codebase or environment.

---

## 2. Tools, Inputs, and Outputs Audit

### 2.1. Tools Audit (Resources Touched)

| Tool / Resource Touched   | Where Used (Action)                                   | VERIFIED_HAVE / MISSING | Verification Method         | ✓ Verified |
|--------------------------|-------------------------------------------------------|------------------------|----------------------------|------------|
| DOM                      | UI input, button, chat log update                     | VERIFIED_HAVE          | Manual review (frontend)   | ✓          |
| Browser Memory           | UI input, validation                                  | VERIFIED_HAVE          | Manual review (frontend)   | ✓          |
| Browser Event System     | Button clicks, Plan This                              | VERIFIED_HAVE          | Manual review (frontend)   | ✓          |
| JS Engine                | UI validation                                         | VERIFIED_HAVE          | Manual review (frontend)   | ✓          |
| Browser Fetch/XHR        | UI sends requests, receives responses                 | VERIFIED_HAVE          | Manual review (frontend)   | ✓          |
| Network                  | UI/backend/LLM API communication                      | VERIFIED_HAVE          | Manual review (code)       | ✓          |
| Node.js                  | Backend, ContextBuilder, config, file ops             | VERIFIED_HAVE          | npm list, code review      | ✓          |
| Express                  | Backend API, middleware                               | VERIFIED_HAVE          | npm list, code review      | ✓          |
| PostgreSQL               | Store/retrieve messages, plans, responses             | VERIFIED_HAVE          | npm list, code review      | ✓          |
| pg lib                   | DB access from Node.js                                | VERIFIED_HAVE          | npm list, code review      | ✓          |
| File System              | ContextBuilder, config, file reads                    | VERIFIED_HAVE          | Code review                | ✓          |
| DeepSeek API             | LLM API call                                          | VERIFIED_HAVE          | Code review, .env.example  | ✓          |
| Config                   | Context scope, user/project overrides                 | VERIFIED_HAVE          | Code review, config files  | ✓          |
| Memory                   | Data aggregation, prompt prep                         | VERIFIED_HAVE          | Code review                | ✓          |
| Service module           | Backend business logic                                | VERIFIED_HAVE          | Code review                | ✓          |

---

### 2.2. Inputs Audit (Resources Required)

> **Key Principle:** Distinguish between what the **design requires** and what is **currently present and verified**. Anything that is design-required but not explicitly verified must be treated as **MISSING** (or at best, UNKNOWN), never silently assumed.

| Input / Resource Required         | Where Used (Action)                                 | Design Required? | Present Now? | VERIFIED_HAVE / MISSING | 👤 Architect Decision Needed | Verification Method                         | ✓ Verified |
|-----------------------------------|-----------------------------------------------------|------------------|--------------|------------------------|-----------------------------|--------------------------------------------|------------|
| Browser, UI loaded                | UI input, button, chat log update                   | Yes              | Yes          | VERIFIED_HAVE          |                             | Manual review (frontend components)        | ✓          |
| JS runtime                        | UI validation                                      | Yes              | Yes          | VERIFIED_HAVE          |                             | Manual review (frontend environment)       | ✓          |
| Network access                    | UI/backend/LLM API communication                    | Yes              | Yes          | VERIFIED_HAVE          |                             | Code review (fetch/HTTP usage)             | ✓          |
| API endpoint available            | UI sends POST /api/chat, Plan This                  | Yes              | Yes          | VERIFIED_HAVE          |                             | Code review (Express routes)               | ✓          |
| Node.js, Express server running   | Backend API, middleware                             | Yes              | Yes          | VERIFIED_HAVE          |                             | Code review (server.js, package.json)      | ✓          |
| API route defined                 | Backend API                                         | Yes              | Yes          | VERIFIED_HAVE          |                             | Code review (routes/features.js)           | ✓          |
| Validation logic                  | Middleware, backend                                 | Yes              | Yes          | VERIFIED_HAVE          |                             | Code review (middleware/tests)             | ✓          |
| Service module                    | Backend business logic                              | Yes              | Yes          | VERIFIED_HAVE          |                             | Code review (controllers/services)         | ✓          |
| PostgreSQL running                | Store/retrieve messages, plans, responses           | Yes              | Unknown      | MISSING                |                             | Not runtime-tested in this analysis        |            |
| DB connection                     | Store/retrieve messages, plans, responses           | Yes              | Unknown      | MISSING                |                             | Not runtime-tested in this analysis        |            |
| pg lib                            | DB access from Node.js                              | Yes              | Yes          | VERIFIED_HAVE          |                             | Code review (package.json, imports)        | ✓          |
| Table exists (messages/plan data) | Store/retrieve messages, plans, responses           | Yes              | No           | MISSING                |                             | Migrations inspected + user confirmation   | ✓          |
| Config file                       | ContextBuilder, config                              | Yes              | Yes          | VERIFIED_HAVE          |                             | Code review (config files present)         | ✓          |
| File system access                | ContextBuilder, config, file reads                  | Yes              | Yes          | VERIFIED_HAVE          |                             | Code review (fs usage)                     | ✓          |
| Tool implemented (list/search)    | ContextBuilder                                      | Yes              | Yes          | VERIFIED_HAVE          |                             | Code review (tool implementations)         | ✓          |
| Sufficient memory                 | Data aggregation, prompt prep                       | Yes              | Unknown      | MISSING                |                             | Not measured in this analysis              |            |
| Prompt template/config            | LLM prompt prep                                     | Yes              | No           | MISSING                |        👤                   | Code search (not found in backend)         | ✓          |
| DeepSeek API key                  | LLM API call                                        | Yes              | Unknown      | MISSING                |                             | Not runtime-tested; .env.example only      |            |
| DeepSeek endpoint                 | LLM API call                                        | Yes              | Unknown      | MISSING                |                             | Not runtime-tested; .env.example only      |            |
| User/project config               | ContextBuilder overrides                            | Yes              | No           | MISSING                |        👤                   | Code search (no explicit override config)  | ✓          |
| Max context size for LLM API      | LLM API call                                        | Yes              | No           | MISSING                |        👤                   | Not specified in code/docs                 |            |
| Error message standard            | All error handling                                  | Yes              | No           | MISSING                |        👤                   | Not specified in code/docs                 |            |
| UI/UX display standard            | Context artifact display                            | Yes              | No           | MISSING                |        👤                   | Not specified in code/docs                 |            |
| Concurrency policy                | Chat session handling                               | Yes              | No           | MISSING                |        👤                   | Not specified in code/docs                 |            |

---

### 2.3. Outputs Audit

| Output / Artifact Produced        | Produced by (Action)                        | Depended on by (Action)                        | Auto / Scheduled | Verification Method         | ✓ Verified |
|-----------------------------------|---------------------------------------------|------------------------------------------------|------------------|----------------------------|------------|
| User message (input)              | UI sends POST /api/chat                     | Backend receives/stores message                | Auto             | Code review (frontend)     | ✓          |
| Persisted chat message (DB row)   | Service inserts message into DB             | ContextBuilder, frontend display               | Auto             | Code review, migrations    | ✓          |
| Context data (file contents, etc) | ContextBuilder gathers/aggregates context   | LLM prompt prep, Orion response                | Auto             | Code review                | ✓          |
| LLM prompt                        | Orion prepares prompt for LLM               | LLM API call                                   | Auto             | Not found (missing)        |            |
| LLM response                      | Orion receives response from LLM API        | Backend stores response, frontend display      | Auto             | Code review                | ✓          |
| Persisted Orion response (DB row) | Service inserts response into DB            | Frontend display, Plan This intent             | Auto             | Code review, migrations    | ✓          |
| Plan draft entry (DB row)         | Backend creates draft plan entry in DB      | Plan visualization, further planning           | Scheduled (by user) | Code review, migrations | ✓          |
| Error message                     | Any error handling action                   | User, logs, monitoring                         | Auto             | Code review                | ✓          |
| UI update (chat log, context)     | Frontend displays Orion's response, context | User interaction, further actions              | Auto             | Code review (frontend)     | ✓          |

---

## 3. Missing Fundamentals

These are the **design-required** fundamentals that are **not currently present or fully specified**, based on the Inputs Audit above.

| Category        | Missing Fundamental                                      | Impact                                            | Resolution Task / Input Needed               |
|-----------------|----------------------------------------------------------|---------------------------------------------------|----------------------------------------------|
| Data Model      | Messages/plan tables do not exist yet                   | Chat & plan persistence cannot function           | Design & add migrations for required tables  |
| Infra / Access  | PostgreSQL running & reachable in target environment    | Entire feature offline if DB is not available     | Define DB provisioning & connection test flow|
| Access          | DB creds / connection string not runtime-verified       | Backend cannot connect to DB reliably             | Define .env vars + add explicit connection test |
| LLM Config      | Prompt template/config for LLM                          | LLM cannot generate context-aware responses       | 👤 Architect to define prompt template/config |
| LLM Config      | DeepSeek API key & endpoint not runtime-verified        | LLM calls may fail at runtime                     | Define env vars + smoke-test LLM connectivity |
| LLM API         | Max context size for LLM API calls                      | May exceed LLM limits and cause failures          | 👤 Architect to define max context policy     |
| User Overrides  | How/where user/project overrides are specified/applied  | Context may not match user intent                 | 👤 Architect to define override mechanism     |
| Error Handling  | Standard for user-facing error messages                 | Inconsistent UX and unclear failure modes         | 👤 Architect to define error messaging standard|
| UI/UX           | Where/how to display context artifacts                  | Poor usability / discoverability of context       | 👤 Architect to define UI/UX pattern          |
| Concurrency     | Policy for concurrent chat sessions                     | Risk of race conditions & inconsistent state      | 👤 Architect to define concurrency policy     |

*👤 = Input/decision required from architect/user*

---

## 4. Dependency & Assumption Audit

This section summarizes **global dependencies and assumptions** surfaced by the Tools/Inputs audits.

| Category   | Status         | Detail                                      | Verification Method                    | ✓ Verified | Resolution Task                                   |
|------------|----------------|---------------------------------------------|----------------------------------------|-----------:|--------------------------------------------------|
| Tool       | VERIFIED_HAVE  | Node.js, Express, pg, fetch                 | npm list, code review                  | ✓          | —                                                |
| Knowledge  | VERIFIED_HAVE  | API/DB/FS usage                             | Docs, code review                      | ✓          | —                                                |
| Access     | MISSING        | DB creds, DB connection, DeepSeek key/URL  | Not runtime-tested in this analysis    |            | Define env vars + add DB & LLM connectivity tests|
| Physics    | VERIFIED_HAVE  | Single-user, atomic ops (no contention yet) | Architecture review                    | ✓          | —                                                |
| Tool       | MISSING        | None (all primitives covered)               | Code review, Primitive Registry check  | ✓          | —                                                |

*Note: `Access` is marked **MISSING** because even though configs and examples exist, no runtime connectivity tests were performed in this analysis. These must become explicit tasks before implementation is considered safe.*

---

## 5. Summary

This RED analysis v1.1 provides a focused audit of unique tools, inputs, and outputs for Feature 2, with explicit verification methods and checkmarks. Any missing or architect-dependent items are clearly flagged for action.
