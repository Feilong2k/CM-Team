# F2-T1: CDP Level 3 & PVP Analysis

## Overview
This document contains a Constraint Discovery Protocol (CDP) Level 3 analysis and Plan Verification Protocol (PVP) analysis for Task 2-1 (F2-T1): DeepSeek API Integration with Tool-Calling Prompt Templates.

## CDP Level 3 Analysis (Constraint Discovery Protocol)

### PART 1: RESOURCE ANALYSIS

| Resource | Current State | Who Uses It | Exclusive/Shared |
|----------|--------------|-------------|------------------|
| DeepSeek API | Available (key in .env) | OrionAgent (future: all agents) | Shared (rate limits apply) |
| PostgreSQL Database | Running (DATABASE_URL configured) | All backend services | Shared (connection pooling) |
| File System (src/) | Readable/writable | ContextBuilder, OrionAgent | Shared (concurrent reads safe) |
| Node.js Process | Running on PORT=3500 | Express server, adapters | Exclusive (single process) |
| Environment Variables | Configured (.env) | All components | Shared (read-only) |
| Network Interface | Localhost:3500 | Frontend, API clients | Shared |

### PART 2: OPERATION ANALYSIS (CRITICAL)

| Operation | Physical Change? | Locks? | 2 Actors Simultaneously? |
|-----------|-----------------|--------|--------------------------|
| DeepSeek API Call | No (read-only) | Rate limit locks | Yes (rate limited) |
| Database Read (chat history) | No | Row-level locks (minimal) | Yes (concurrent reads) |
| Database Write (API logs) | Yes (INSERT) | Table/row locks | Yes (concurrent writes) |
| File System Read (context) | No | File locks (OS level) | Yes (concurrent reads) |
| OrionAgent Processing | No (compute) | Memory/CPU contention | No (single agent instance) |

### PART 3: ACTOR ANALYSIS

| Actor | Resources They Touch | Same Resource Same Time? |
|-------|---------------------|-------------------------|
| OrionAgent | DeepSeek API, Database, File System | Yes (all shared resources) |
| Frontend User | Chat API, Database (via API) | Yes (concurrent users possible) |
| ContextBuilder | File System, Database | Yes (shared with OrionAgent) |
| DS_ChatAdapter | DeepSeek API, Network | Yes (shared API endpoint) |

### PART 4: ASSUMPTION AUDIT (minimum 10)

| # | Assumption | Explicit/Implicit | Breaks if FALSE | Risk |
|---|------------|-------------------|-----------------|------|
| 1 | DeepSeek API accepts our request format | Implicit | API returns error | High |
| 2 | API key has sufficient quota | Implicit | Rate limiting/denial | High |
| 3 | Network connectivity to api.deepseek.com | Implicit | Timeout/failure | High |
| 4 | Database connection pool sufficient | Implicit | Connection errors | Medium |
| 5 | File system paths are accessible | Implicit | Context building fails | Medium |
| 6 | Node.js fetch/axios works with DeepSeek | Implicit | HTTP errors | Medium |
| 7 | Response parsing matches expected format | Implicit | Parsing errors | Medium |
| 8 | Token counting works accurately | Implicit | Token limit exceeded | Low |
| 9 | Environment variables loaded correctly | Implicit | Missing configuration | High |
| 10 | Error handling covers all failure modes | Implicit | Unhandled exceptions | High |

### PART 5: PHYSICAL VS LOGICAL CHECK

| Claimed Separation | Mechanism | Physical/Logical | If Mechanism Fails? |
|-------------------|-----------|------------------|---------------------|
| "Different API calls" | HTTP requests | Logical | Same network/rate limits |
| "Different database tables" | SQL queries | Logical | Same DB connection pool |
| "Different file reads" | File paths | Logical | Same disk/I/O subsystem |
| "Different agent instances" | JavaScript objects | Logical | Same Node.js process memory |

**KEY FINDING**: All "separate" operations share physical resources (network, disk, database). Concurrent operations may contend for these resources.

### PART 6: GAP ANALYSIS (CRITICAL)

| Gap | Possible Interpretations | Answer Under Each |
|-----|-------------------------|-------------------|
| API response format | A: JSON with tool_calls B: Plain text C: Custom format | Need DeepSeek API documentation |
| Error handling scope | A: Retry on network failure B: Retry on API error C: No retry | A→Implement, B→Implement, C→Reject |
| Token counting method | A: Client-side estimation B: Server-side count C: Fixed limit | A→Implement gpt-tokenizer |
| Context building trigger | A: On every message B: On "Plan This" C: Configurable | A→Implement per F2-T0-S4 |
| Prompt template location | A: File system B: Database C: Hard-coded | A→Create /prompts/ directory |
| OrionAgent existence | A: Needs creation B: Exists but needs refactor C: Partially exists | A→Create new (based on search) |

### PART 7: CONDITIONAL VERDICT

- **IF** DeepSeek API format matches OpenAI-like tool calling **THEN** implementation straightforward
- **IF** API has strict rate limits **THEN** need robust retry/backoff logic
- **IF** database connection fails **THEN** should degrade gracefully (cache in memory?)
- **IF** file system inaccessible **THEN** context building fails (need fallback)

**Gaps MUST Be Clarified**: API response format, exact error codes, rate limit details.

## PVP Analysis (Plan Verification Protocol)

### 1. LIST ACTIONS
1. Create `backend/src/adapters/` directory structure
2. Implement `LLMAdapter.js` abstract interface
3. Implement `DS_ChatAdapter.js` with DeepSeek API integration
4. Validate environment variables (DEEPSEEK_API_KEY)
5. Create `backend/src/agents/` directory
6. Implement `OrionAgent.js` using DS_ChatAdapter
7. Integrate OrionAgent with existing chat routes
8. Implement token counting middleware
9. Create prompt templates (`deepseek-plan.mustache`, `deepseek-act.mustache`)
10. Add basic error handling and retry logic
11. Test end-to-end chat flow

### 2. FIND RESOURCES
- **Tools**: Node.js, npm, PostgreSQL, DeepSeek API
- **APIs**: DeepSeek REST API, existing backend Express API
- **Databases**: PostgreSQL with `chat_messages`, `features`, `tasks`, `subtasks` tables
- **Files**: `.env` configuration, source code files, prompt templates
- **Environment Variables**: `DEEPSEEK_API_KEY`, `DATABASE_URL`, `PORT`
- **Network**: Internet connectivity to api.deepseek.com

### 3. IDENTIFY GAPS & MAP DATA FLOW

**Data Flow Map:**
```
User → Frontend → POST /api/chat → Chat Controller → OrionAgent → DS_ChatAdapter → DeepSeek API
                                                                       ↓
Response ← Frontend ← Chat Controller ← OrionAgent ← DS_ChatAdapter ← DeepSeek Response
```

**Gaps Identified:**
1. **Missing**: DeepSeek API documentation for exact request/response format
2. **Missing**: OrionAgent implementation (needs creation)
3. **Missing**: Prompt template files
4. **Missing**: Token counting implementation
5. **Missing**: Integration tests for adapter
6. **Ambiguous**: Error handling strategy for different failure modes

### 4. MAP DEPENDENCIES
1. Environment validation (requires .env file)
2. LLMAdapter interface (prerequisite for DS_ChatAdapter)
3. DS_ChatAdapter (prerequisite for OrionAgent)
4. OrionAgent (prerequisite for chat integration)
5. Prompt templates (can be developed in parallel)
6. Token counting (can be added after basic flow works)

**Blocking Dependencies:**
- DeepSeek API key must be valid and have quota
- Database must be accessible for chat history
- Network connectivity to DeepSeek API

### 5. CHECK INTEGRATION

**Integration Points:**
1. **DS_ChatAdapter → DeepSeek API**: HTTP REST calls, authentication, error handling
2. **OrionAgent → DS_ChatAdapter**: JavaScript class instantiation, method calls
3. **OrionAgent → DatabaseTool**: For logging and context retrieval
4. **Chat Controller → OrionAgent**: Service layer integration
5. **Frontend → Chat API**: Existing integration (needs enhancement for errors)

**Compatibility Checks:**
- ✅ DS_ChatAdapter output matches OrionAgent expected input
- ✅ OrionAgent output matches chat controller expected format
- ✅ Error formats consistent across layers
- ⚠️ Need to verify DeepSeek API response format compatibility

### 5.1 VALIDATE TEST SEAMS (CRITICAL)

**Injection Seams:**
1. DS_ChatAdapter can be mocked (dependency injection)
2. DatabaseTool can be mocked (already testable)
3. File system operations can be mocked (for context building)
4. Environment variables can be overridden in tests

**Observation Seams:**
1. API calls can be intercepted (nock/axios-mock-adapter)
2. Database writes can be verified (test transactions)
3. File reads can be verified (mock file system)
4. Error conditions can be simulated

**Testability Assessment:** ✅ GOOD - All major components have clear injection/observation seams.

### 6. VALIDATE COMPLETENESS

**Original Goal:** "Integrate DeepSeek API with tool-calling prompt templates, implement conversation management, and log API calls to the database."

**Plan Coverage:**
- ✅ DeepSeek API integration (via DS_ChatAdapter)
- ✅ Tool-calling prompt templates (mustache templates)
- ✅ Conversation management (OrionAgent + existing chat routes)
- ⚠️ API call logging (deferred to post-MVP per decision)
- ✅ Error handling and retry logic

**Missing from Original Goal:** Full API call logging to database (intentionally deferred).

### 7. DEFINE VERIFICATION TESTS

**Component Tests:**
1. DS_ChatAdapter unit tests: API calls, error handling, response parsing
2. LLMAdapter interface tests: Contract compliance
3. OrionAgent unit tests: Context building, prompt assembly
4. Token counter tests: Accurate token estimation

**Integration Tests:**
1. End-to-end chat flow: User message → API call → Response
2. Error handling: Network failure, API errors, rate limiting
3. Context building: File system access, token truncation
4. Database integration: Chat history retrieval

**Acceptance Tests:**
1. User can send chat message and receive Orion response
2. System handles DeepSeek API failures gracefully
3. Context is included in prompts (file names at minimum)
4. Token limits are respected (automatic truncation)

## Risk Assessment & Mitigation

### High Risk Items:
1. **DeepSeek API compatibility** - Mitigation: Start with simple text completion, add tool calling later
2. **Rate limiting** - Mitigation: Implement exponential backoff, track usage
3. **Network failures** - Mitigation: Retry logic, circuit breaker pattern
4. **Token limit exceeded** - Mitigation: Client-side counting, proactive truncation

### Medium Risk Items:
1. **Database performance** - Mitigation: Connection pooling, query optimization
2. **File system access** - Mitigation: Error handling, fallback to minimal context
3. **Memory usage** - Mitigation: Stream processing where possible

### Low Risk Items:
1. **Configuration management** - Already handled via .env
2. **Frontend integration** - Existing chat UI can be extended

## Missing Fundamentals Identified

1. **DeepSeek API Documentation**: Need exact request/response format for tool calling
2. **OrionAgent Implementation**: Complete design needed (based on Agent Handover Protocol)
3. **Prompt Template Examples**: Sample conversations for plan/act modes
4. **Token Counting Library**: Choose and integrate `gpt-tokenizer` or similar
5. **Error Logging Strategy**: Where to log errors (console vs database vs both)

## Recommendations

### Immediate Actions:
1. Research DeepSeek API documentation for exact formats
2. Create stub implementations with minimal functionality
3. Implement comprehensive error handling from start
4. Add configuration validation on startup

### Deferred Items (Post-MVP):
1. Full API call logging to database
2. Advanced tool calling support
3. Multiple LLM provider support
4. Sophisticated rate limiting strategies

## Conclusion

The plan for F2-T1 is **CONDITIONALLY SOUND** with the following conditions:

1. DeepSeek API responds as expected (format verification needed)
2. OrionAgent design follows Agent Handover Protocol patterns
3. Error handling is comprehensive from the start
4. Token counting is implemented to prevent limit violations

**Primary Risk**: API compatibility unknown until tested with actual DeepSeek API calls.

**Next Step**: Create a spike/prototype to test DeepSeek API connectivity and response format before full implementation.

---
**Analysis Completed**: 2025-12-19  
**Analyst**: Adam (Architect)  
**Status**: Ready for implementation planning
