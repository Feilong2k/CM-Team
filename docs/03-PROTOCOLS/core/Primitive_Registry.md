# Primitive Registry

This registry defines "Known Primitives" for the Fractal Analysis Protocol (FAP). A **Primitive** is an action that can be considered "atomic" because it meets all three conditions:
1. **Tool Exists:** The binary/library/function is available
2. **Knowledge Exists:** The syntax/arguments are known
3. **Access Exists:** Permissions/environment are confirmed

## Purpose
- Stop recursion in FAP when an action maps to a registered primitive
- Provide verification methods for dependency audits
- Document failure modes for risk assessment

## Registry Format
Each entry follows this structure:
```
### [Category] Primitive Name
**Tool:** What tool/library provides this
**Verification:** How to confirm it exists and works
**Failure Modes:** What could go wrong
**Notes:** Additional context
```

---

## File System Primitives

### FS: read_file
**Tool:** Node.js `fs.readFile` / `fs.readFileSync`
**Verification:** Call `fs.readFile` on a known test file
**Failure Modes:** Permission denied, path doesn't exist, encoding mismatch
**Notes:** Async vs sync variants

### FS: write_file
**Tool:** Node.js `fs.writeFile` / `fs.writeFileSync`
**Verification:** Write a test file, read it back
**Failure Modes:** Disk full, permission denied, path traversal
**Notes:** Requires write permission

### FS: list_directory
**Tool:** Node.js `fs.readdir`
**Verification:** List contents of known directory
**Failure Modes:** Permission denied, not a directory
**Notes:** Recursive option available

---

## Database Primitives

### DB: postgres_connection
**Tool:** `pg` library (`pg.Client` or `pg.Pool`)
**Verification:** Connect to DB with `DATABASE_URL`, run `SELECT 1`
**Failure Modes:** Invalid credentials, network timeout, DB down
**Notes:** Requires `.env` configuration

### DB: execute_sql
**Tool:** `pg` library `client.query()`
**Verification:** Run simple query (`SELECT version()`)
**Failure Modes:** Syntax error, constraint violation, deadlock
**Notes:** Transaction support available

### DB: jsonb_support
**Tool:** PostgreSQL 9.4+ with JSONB type
**Verification:** Create table with JSONB column, insert/query JSON
**Failure Modes:** Version mismatch, index creation fails
**Notes:** Native to PostgreSQL

---

## Network Primitives

### HTTP: fetch_api
**Tool:** Node.js `fetch` or `axios` library
**Verification:** Make GET request to known endpoint
**Failure Modes:** Network timeout, DNS failure, SSL issues
**Notes:** CORS considerations for browser

### HTTP: express_server
**Tool:** Express.js framework
**Verification:** Start server on localhost, make test request
**Failure Modes:** Port conflict, middleware errors
**Notes:** Requires route configuration

---

## CLI Primitives

### CLI: execute_command
**Tool:** Node.js `child_process.exec` / `spawn`
**Verification:** Run `echo "test"` and capture output
**Failure Modes:** Command not found, permission denied, timeout
**Notes:** Shell injection risk

### CLI: npm_install
**Tool:** npm CLI
**Verification:** `npm install --no-save <test-package>`
**Failure Modes:** Network failure, package not found, version conflict
**Notes:** Requires package.json

---

## Validation Primitives

### VALIDATION: json_schema
**Tool:** `ajv` or `zod` library
**Verification:** Create schema, validate test object
**Failure Modes:** Schema syntax error, type mismatch
**Notes:** Runtime vs compile-time validation

### VALIDATION: markdown_parsing
**Tool:** `markdown-it` library
**Verification:** Parse "# Heading" -> HTML
**Failure Modes:** Unsupported syntax, XSS risk
**Notes:** Extensible with plugins

---

## UI Primitives

### UI: vue_component
**Tool:** Vue 3 Composition API
**Verification:** Mount component with test props
**Failure Modes:** Template syntax error, reactivity issue
**Notes:** Requires Vue runtime

### UI: tailwind_styling
**Tool:** Tailwind CSS
**Verification:** Apply class `text-neon-blue`, verify color
**Failure Modes:** Class not defined, purge configuration
**Notes:** JIT mode vs build-time

### UI: icon_rendering
**Tool:** `lucide-vue-next` library
**Verification:** Import and render icon component
**Failure Modes:** Icon name not found, size mismatch
**Notes:** Tree-shakeable

---

## Testing Primitives

### TEST: jest_unit
**Tool:** Jest test runner
**Verification:** Run existing test suite
**Failure Modes:** Mock failures, async timeout
**Notes:** Supports snapshot testing

### TEST: vitest_component
**Tool:** Vitest + Vue Test Utils
**Verification:** Mount component, assert DOM
**Failure Modes:** Vue version mismatch, async updates
**Notes:** Vite-based

---

## Version Control Primitives

### VCS: git_operations
**Tool:** Git CLI
**Verification:** `git status`, `git log --oneline -1`
**Failure Modes:** Repository corrupted, authentication failed
**Notes:** Requires git installation

---

## LLM & AI Primitives

### LLM: gpt41_adapter_send
**Tool:** `GPT41Adapter.sendMessages()` method
**Verification:** Call adapter with test messages, verify API response
**Failure Modes:** API key invalid, network timeout, rate limiting
**Notes:** Requires OpenAI GPT-4.1-mini access

### LLM: ds_chat_adapter_stream
**Tool:** `DS_ChatAdapter.streaming()` method
**Verification:** Stream response from DeepSeek API, verify chunks
**Failure Modes:** API endpoint down, token limit exceeded
**Notes:** Uses DeepSeek API with streaming support

### LLM: llm_adapter_interface
**Tool:** `LLMAdapter` abstract class methods
**Verification:** Implement adapter and test all interface methods
**Failure Modes:** Interface contract violation, missing method implementations
**Notes:** Base class for all LLM adapters

## Tool Execution Primitives

### TOOL: toolrunner_execute
**Tool:** `ToolRunner.execute()` method
**Verification:** Execute a tool with valid parameters, verify result
**Failure Modes:** Tool not found, parameter validation failed, timeout
**Notes:** Central tool execution engine

### TOOL: registry_get_tool
**Tool:** `ToolRegistry.getTool()` method
**Verification:** Look up tool by name, verify tool definition returned
**Failure Modes:** Tool not registered, duplicate tool names
**Notes:** Tool discovery and metadata access

### TOOL: canonical_signature_build
**Tool:** `ToolRunner._buildCanonicalSignature()` method
**Verification:** Build signature from tool call, verify format consistency
**Failure Modes:** Missing required parameters, signature collision
**Notes:** Used for duplicate detection

## Trace & Logging Primitives

### TRACE: trace_service_log
**Tool:** `TraceService.log()` method
**Verification:** Log trace event, verify storage (DB or memory)
**Failure Modes:** Trace storage full, serialization error
**Notes:** Centralized tracing with configurable sinks

### TRACE: trace_event_create
**Tool:** `TraceEvent` class constructor
**Verification:** Create trace event with valid type and data
**Failure Modes:** Invalid trace type, data too large
**Notes:** Immutable trace event representation

### TRACE: redact_details_implementation
**Tool:** `redactDetails()` function in TraceService
**Verification:** Redact sensitive data (API keys, paths), verify original data not leaked
**Failure Modes:** Incomplete redaction, false positives
**Notes:** Security-critical function

## Protocol & Service Primitives

### PROTOCOL: strategypattern_execute
**Tool:** `ProtocolStrategy.execute()` method
**Verification:** Execute protocol strategy with context, verify phase transitions
**Failure Modes:** Strategy not implemented, invalid state transition
**Notes:** Interface for all protocol implementations

### PROTOCOL: twostage_cyclephase
**Tool:** `TwoStageProtocol.cyclePhase()` method
**Verification:** Cycle between A/B phases, verify phase metadata updated
**Failure Modes:** Cycle counter overflow, duplicate detection failure
**Notes:** Core of two-stage protocol

### PROTOCOL: contextservice_buildcontext
**Tool:** `ContextService.buildContext()` method
**Verification:** Build chat context from history and files, verify context structure
**Failure Modes:** DB query failure, file read errors, token limit exceeded
**Notes:** Centralized context hydration

## Adding New Primitives
When FAP discovers a new "atomic" action that should be considered primitive:
1. Add it to this registry with the standard format
2. Include verification method that can be automated
3. Document failure modes for risk assessment
4. Update the FAP protocol to reference this registry

---

## Verification Checklist (For Dependency Audit)
When auditing a primitive, verify:
- [ ] Tool is installed/available
- [ ] Documentation/examples exist for usage
- [ ] Required permissions/environment are configured
- [ ] Failure modes have mitigation strategies
