# Orion System — Integrated Roadmap v2.2

**Date**: 2025-12-23  
**Author**: Adam (Architect)  
**Status**: Proposal (Updated Based on RED v3 Analysis)  
**Version**: 2.2

## 1. Executive Summary

This roadmap integrates the original MVP implementation requirements with current development progress and future architectural plans, **updated based on comprehensive RED v3 analysis findings**. It provides a unified view of the Orion System's evolution with **added design phases, knowledge transfer, and explicit security patterns** identified through decomposition to atomic primitives.

**Core Philosophy:**
- **UI-First:** Every feature results in a visible UI update
- **Role-Centric:** We build the "Brain" and "Hands" for each agent specifically
- **Stateful:** The DB is the Single Source of Truth
- **Modular:** Services enable extensibility and code reuse
- **Design-First:** Critical missing fundamentals addressed before implementation

**Current State Assessment:**
- **Feature 1 (Foundation):** Mostly complete (database, plan import, viewer UI)
- **Feature 2 (Orion Chat):** In progress (chat API, context system, two-stage protocol prototype)
- **Feature 3 (Two-Stage Protocol & Service Foundation):** **Updated based on RED v3** - adds design phase, knowledge transfer, explicit security patterns
- **Feature 4-6 (Specialized Agents):** Planned (will use phased modular approach)
- **Feature 7 (Full Modular):** Future (complete modular architecture)

**Implementation Strategy:** **Design-first approach** based on RED findings → two-stage protocol strategy → selective service extraction → full modular when needed.

**Key Changes from v2.1 (Based on RED v3 Analysis):**
1. **Added Design Phase (Task 3.0):** 2-3 days for design documents before implementation
2. **Restructured Tasks:** Implementation tasks broken down further with design-to-implementation flow
3. **Enhanced Security:** Explicit security pattern development for redactDetails()
4. **Added Knowledge Transfer:** Documentation task to close knowledge gaps
5. **Updated Timeline:** 14-18 days total (from 10-15) with more realistic estimates
6. **Enhanced Risk Mitigation:** New risks identified from RED analysis

---

## 2. Feature Inventory

### Feature 1: Foundation & Plan Visualization (The SSOT)
**Goal:** We have a DB that stores the Plan, and a UI that displays it.
**Status:** Mostly Complete

**Tasks:**
- **Task 1.0:** Database Migration Infrastructure ✓
  - `scripts/migrate.js` created and working
- **Task 1.1:** Database Schema Setup ✓
  - `002_orion_workflow.sql` implemented with tables: `planning_docs`, `tasks`, `subtasks`, `task_steps`
- **Task 1.2:** Plan Import Tool ✓
  - Orion Plan Schema defined (Markdown Spec)
  - `markdown-it` integration working
  - Script ingests Markdown Plan → DB Rows
- **Task 1.3:** Plan Viewer UI ✓
  - `listToTree.js` utility implemented
  - `FeatureTree.vue` refactored to accept props
  - Plan visualization with status badges working

**Remaining Work:**
- UI enhancements for plan editing
- Real-time plan updates via SSE

### Feature 2: Orion Chat & Context (The Planner)
**Goal:** We can talk to Orion, and he has the context to understand the project.
**Status:** In Progress (Current Focus)

**Current Implementation:**
- **Chat API & Persistence:** ✓
  - `POST /api/chat/messages` with SSE streaming
  - Messages persisted to `chat_messages` table
  - Project context (`project_id`) integrated
- **Context System (The "Eyes"):** ✓
  - `search_files` and `list_files` tools implemented
  - `FileSystemTool` with repo root access
  - Context building service extracts file content for LLM
- **Two-Stage Protocol Prototype:** ✓
  - `/api/chat/messages_two_stage` route with feature flag
  - `TwoStageOrchestrator.js` implements A/B cycling
  - Duplicate detection and prevention
  - Frontend toggle for two-stage mode

**Tasks in Progress:**
- **Task 2.1:** Two-Stage Protocol Integration (Strategy Pattern)
  - **Objective:** Integrate two-stage protocol into OrionAgent using strategy pattern
  - **Current Work:** Protocol strategy interface, StandardProtocol extraction, TwoStageProtocol conversion
  - **Dependencies:** OrionAgent refactoring
  - **Timeline:** 3-4 days

- **Task 2.2:** Context Hydration Across Turns
  - **Objective:** Two-stage protocol loads chat history for multi-turn conversations
  - **Current Work:** Design cross-turn context loading strategy
  - **Dependencies:** Task 2.1 completion
  - **Timeline:** 2-3 days (after Task 2.1)

- **Task 2.3:** Enhanced Budget Strategy
  - **Objective:** Replace hard-coded cycle limits with configurable, progress-sensitive budgets
  - **Current Work:** RED v2 analysis for adaptive budgeting
  - **Dependencies:** Two-stage protocol stabilization
  - **Timeline:** 2-3 days

- **Task 2.4:** Trace Redaction & Security
  - **Objective:** Implement `redactDetails()` per DEV_TRACE_EVENT_MODEL.md
  - **Current Work:** Security review of trace logging
  - **Dependencies:** Trace service implementation
  - **Timeline:** 1-2 days

**Future Tasks:**
- **Task 2.5:** "Plan This" Intent
  - Orion takes user request, uses context tools, generates Draft Plan in DB
  - **Status:** Design phase
  - **Timeline:** After Feature 2 core completion

### Feature 3: Two-Stage Protocol & Service Foundation (Production-Ready)
**Goal:** Implement production-ready two-stage protocol with strategy pattern and modular services, **with design-first approach based on RED v3 analysis**.
**Status:** Next Priority

**Implementation Approach:** **Design phase first** → Phased implementation addressing all RED v3 gaps for production readiness.

**Tasks (Updated Based on RED v3 Analysis):**

#### **PHASE 1: DESIGN & KNOWLEDGE FOUNDATION (2-3 days)**
- **Task 3.0: Design & Knowledge Foundation (2-3 days)**
  - **3.0.1:** Create ProtocolStrategy interface design document
  - **3.0.2:** Design ContextService architecture and API
  - **3.0.3:** Define security redaction patterns per DEV_TRACE_EVENT_MODEL.md
  - **3.0.4:** Design phase trace event schema and integration approach
  - **3.0.5:** Document protocol strategy patterns and service extraction patterns
  - **Output:** Approved design documents, knowledge gap closed
  - **Dependencies:** RED v3 analysis completion
  - **Risks:** Design ambiguity, knowledge transfer gaps

#### **PHASE 2: CORE IMPLEMENTATION (7-9 days)**
- **Task 3.1: Protocol Strategy Implementation (4-5 days)**
  - **3.1.1:** Implement ProtocolStrategy.js from approved design
  - **3.1.2:** Extract StandardProtocol from OrionAgent (guided by design)
  - **3.1.3:** Convert TwoStageOrchestrator → TwoStageProtocol (with design validation)
  - **3.1.4:** Refactor OrionAgent to use protocol strategies (incremental rollout)
  - **Dependencies:** Task 3.0 completion (design approval)
  - **Key Benefit:** TwoStageProtocol inherits OrionAgent's context hydration (chat history, file list)

- **Task 3.2: ContextService Implementation (3-4 days)**
  - **3.2.1:** Implement ContextService.js from approved design
  - **3.2.2:** Move _prepareRequest() logic from OrionAgent to ContextService
  - **3.2.3:** Update protocols to use ContextService (dependency injection)
  - **3.2.4:** Verify chat history loading and multi-turn context works
  - **Dependencies:** Task 3.1 completion (protocol foundation)
  - **Key Benefit:** Eliminates duplication between protocols, enables testable components

#### **PHASE 3: ENHANCED SERVICES & SECURITY (4-5 days)**
- **Task 3.3: Enhanced Service Layer (2-3 days)**
  - **3.3.1:** Extract `PlanModeService` (whitelists and filtering for PLAN mode)
  - **3.3.2:** Extract `ErrorService` (error logging and recovery)
  - **3.3.3:** Create basic AgentFactory for protocol selection
  - **Dependencies:** Task 3.2 completion (core services)
  - **Key Benefit:** Clean separation of concerns, testable components

- **Task 3.4: Security & Configuration (3-4 days)**
  - **3.4.1:** Implement `redactDetails()` with tested regex patterns (from design)
  - **3.4.2:** Add TWO_STAGE_ENABLED env var and route gating
  - **3.4.3:** Make budgets configurable via env vars (`TWO_STAGE_MAX_CYCLES`, `TWO_STAGE_MAX_DUPLICATES`)
  - **3.4.4:** Add phase trace events to TRACE_TYPES (`phase_start`, `phase_end`, `budget_exhausted`, etc.)
  - **Dependencies:** Task 3.0 completion (security patterns design)
  - **Key Benefit:** Production security and operational flexibility

#### **PHASE 4: OBSERVABILITY & STABILIZATION (3-4 days)**
- **Task 3.5: Observability & Stabilization (2-3 days)**
  - **3.5.1:** Phase trace event integration in TwoStageProtocol
  - **3.5.2:** Performance testing and optimization
  - **3.5.3:** Backward compatibility verification
  - **Dependencies:** Task 3.4 completion (security & configuration)
  - **Key Benefit:** Production monitoring and stability

- **Task 3.6: Documentation & Knowledge Transfer (1-2 days)**
  - **3.6.1:** Create protocol pattern documentation with examples
  - **3.6.2:** Document service extraction approach for future features
  - **3.6.3:** Create security redaction guidelines for team
  - **3.6.4:** Update roadmap with lessons learned
  - **Dependencies:** All Feature 3 tasks completion
  - **Key Benefit:** Team knowledge transfer, maintainable codebase

**Total Timeline:** 14-18 days for production-ready two-stage protocol (updated from 10-15 days)

**RED v3 Gaps Addressed:**
1. ✅ **Design Ambiguity** - Via Task 3.0 (design phase)
2. ✅ **Knowledge Gaps** - Via Tasks 3.0 and 3.6 (documentation)
3. ✅ **Security Pattern Implementation** - Via Task 3.4 (explicit patterns)
4. ✅ **Cross-turn context hydration** - Via Task 3.2 (ContextService)
5. ✅ **Trace redaction** - Via Task 3.4
6. ✅ **Configurable budgets** - Via Task 3.4
7. ✅ **Phase trace events** - Via Task 3.4
8. ⏳ **Frontend phase visualization** - Optional enhancement (deferred)

### Feature 4: The Orchestrator & Tara (The Tester)
**Goal:** Orion can break down work and direct Tara to verify it.
**Status:** Planned (After Feature 3)

**Tasks (From Original Requirements):**
- **Task 4.1:** Step Generator (Orion Core).
    - Logic to break a `subtask` into atomic `steps` (e.g., "Create Test File").
- **Task 4.2:** Tara's Toolbox.
    - `run_test(path)`: Wraps `npm test`.
    - `read_file(path)`: Read only.
    - `create_file(path)`: For creating test files.
- **Task 4.3:** Agent Runner (Tara Profile).
    - Service to launch Tara with the "Tester" System Prompt + Toolbox.
- **Task 4.4:** Handover Protocol.
    - Implement `submit_step_completion` tool for Tara to report results to DB.

**Updated Timeline:** 4-5 days (after Feature 3 completion) + 2-3 day buffer for Feature 3 dependencies

### Feature 5: Devon Integration (The Coder)
**Goal:** Orion can direct Devon to implement solutions.
**Status:** Planned (After Feature 4)

**Tasks (From Original Requirements):**
- **Task 5.1:** Devon's Toolbox.
    - `edit_file(path, diff)`: The core coding tool.
    - `delete_file(path)`.
- **Task 5.2:** Agent Runner (Devon Profile).
    - Service to launch Devon with "Implementer" System Prompt + Toolbox.
- **Task 5.3:** Loop Closure.
    - Orion logic: If Tara fails (Red), trigger Devon (Green), then trigger Tara (Refactor/Verify).

**Timeline:** 3-4 days (after Feature 4 completion)

### Feature 6: Automation & Safety (The Pipeline)
**Goal:** Professionalize the workflow.
**Status:** Future (After Feature 5)

**Tasks (From Original Requirements):**
- **Task 6.1:** Git Automation.
    - Orion commits to git after every successful Task completion.
- **Task 6.2:** Concurrency Locks.
    - Prevent Tara and Devon from running on the same file simultaneously.

**Timeline:** 2-3 days (after Feature 5 completion)

### Feature 7: Full Modular Architecture & Enhanced Intelligence
**Goal:** Complete modular agent architecture with enhanced intelligence features.
**Status:** Future (When multi-agent system matures)

**Prerequisites:** Features 3-6 completed, real need for AdamAgent and full agent routing

**Components:**
- **Complete Service Layer:** All services from Feature 3 plus AnalyticsService, MonitoringService
- **Agent Factory:** Full dependency injection, configuration management, plugin system
- **Specialized Agents:** AdamAgent (architect), TaraAgent (tester), DevonAgent (developer), OrionAgent (orchestrator)
- **Protocol Registry:** StandardProtocol, TwoStageProtocol, ValidationProtocol, ImplementationProtocol
- **Enhanced Intelligence:** Progress-sensitive budgeting, adaptive cycle limits, intent-based routing

**Tasks:**
- **Task 7.1:** Complete Service Layer Implementation (4-5 days)
  - All services with full interfaces (including AnalyticsService)
  - Service dependency management
  - Plugin system foundation

- **Task 7.2:** Agent Factory & Configuration (3-4 days)
  - Full dependency injection
  - Agent configuration system (JSON/YAML)
  - Plugin system for extensions

- **Task 7.3:** Specialized Agent Implementation (5-6 days)
  - AdamAgent with architect tools and protocols
  - Enhanced TaraAgent with testing protocols
  - Enhanced DevonAgent with implementation protocols

- **Task 7.4:** Enhanced Intelligence Features (3-4 days)
  - Progress-sensitive budgeting (adaptive cycle limits)
  - Intent-based agent routing
  - Agent handover and collaboration protocols

**Timeline:** 15-19 days total (when needed)

**Note:** Task 3.7 (Progress-sensitive budgeting) moved here from Feature 3 as it's an enhancement, not MVP requirement.

---

## 3. Current Development Focus (Next 14-18 Days)

### Days 1-3: Design & Knowledge Foundation
1. **Protocol Strategy Interface Design**
2. **ContextService Architecture Design**
3. **Security Redaction Pattern Definition**
4. **Phase Trace Event Schema Design**
5. **Knowledge Documentation Creation**

### Days 4-9: Core Protocol Implementation
1. **ProtocolStrategy Implementation** from design
2. **StandardProtocol Extraction** from OrionAgent
3. **TwoStageProtocol Conversion** with design validation
4. **OrionAgent Coordinator** refactor to use protocols
5. **Route Integration** for protocol selection

### Days 10-13: Service Extraction & Security
1. **ContextService Implementation** from design
2. **ToolService Extraction** (tool merging, validation, execution)
3. **Security Implementation** (redactDetails() with tested patterns)
4. **Configuration Setup** (env vars, budgets, route gating)

### Days 14-16: Enhanced Services & Observability
1. **PlanModeService & ErrorService** extraction
2. **Phase Trace Event** integration
3. **Performance Testing** of new architecture
4. **Backward Compatibility** verification

### Days 17-18: Documentation & Knowledge Transfer
1. **Protocol Pattern Documentation** with examples
2. **Service Extraction Approach** documentation
3. **Security Redaction Guidelines** for team
4. **Roadmap Update** with lessons learned

---

## 4. UI Checkpoints

1.  **Feature 1:** Open "Plan" tab → See the Roadmap tree ✓
2.  **Feature 2:** Open "Chat" tab → Ask "What is in src/?" → Orion lists files ✓
3.  **Feature 2 Enhanced:** Toggle "2-stage" mode → See A/B cycling in trace events
4.  **Feature 3 Phase 1:** "Design Review Complete" milestone reached
5.  **Feature 3 Phase 2:** Protocol selection dropdown in UI (Standard vs Two-Stage)
6.  **Feature 3 Phase 3:** "Security Patterns Implemented" verification in trace dashboard
7.  **Feature 4:** Click "Run Test" on a Subtask → See Tara wake up, run test, Step turns Green/Red
8.  **Feature 5:** Click "Implement" → See Devon edit code → See Tara run regression
9.  **Feature 6:** See automatic git commits after task completion
10. **Feature 7:** Agent selection dropdown with Adam/Tara/Devon/Orion, intent-based routing

---

## 5. Architectural Principles

### 5.1 Design-First Approach
- **Design before implementation** for complex patterns (protocol strategy, services)
- **Document knowledge gaps** and address before coding
- **Security patterns defined** and reviewed before implementation

### 5.2 Minimalism First
- Only propose tools, frameworks, or patterns strictly necessary
- Avoid new libraries unless clear benefit (solves blocker or reduces repeated work)
- Extract services only when duplication exists

### 5.3 Follow Existing Stack
- PostgreSQL, Vue 3, Node.js, Express
- No ORMs or abstraction layers unless critical requirement
- Native SQL for database operations

### 5.4 Design for Testability
- Every task testable by Tara
- APIs mockable for unit tests
- Clear test boundaries (unit vs integration)

### 5.5 Phased Modularity with Design Validation
- **Design phase** validates modularity approach
- Start with strategy pattern (immediate need)
- Extract services incrementally (as duplication appears)
- Full modular only when multi-agent system matures

---

## 6. Risk Assessment

### High Risk (Block Production)
1. **Design Ambiguity**
   - **Probability:** Medium (from RED v3 analysis)
   - **Impact:** High (wrong implementation direction)
   - **Mitigation:** Design review sessions, approval gates in Task 3.0

2. **Protocol Integration Complexity**
   - **Probability:** Medium
   - **Impact:** High (could break existing functionality)
   - **Mitigation:** Thorough testing, gradual rollout, feature flags

3. **Service Extraction Breaking Changes**
   - **Probability:** Medium  
   - **Impact:** High (OrionAgent regression)
   - **Mitigation:** Comprehensive test suite, incremental extraction

### Medium Risk
1. **Knowledge Transfer Gaps**
   - **Probability:** High (from RED v3 analysis)
   - **Impact:** Medium (team can't maintain/extend)
   - **Mitigation:** Task 3.6 documentation, examples, pair programming

2. **Security Pattern Implementation**
   - **Probability:** Low
   - **Impact:** High (security vulnerability)
   - **Mitigation:** Design review, security testing checklist

3. **Performance Impact**
   - **Probability:** Medium
   - **Impact:** Medium (slower response times)
   - **Mitigation:** Profile before/after, optimize bottlenecks

### Low Risk
1. **Configuration Management**
   - **Probability:** Low
   - **Impact:** Medium (operational complexity)
   - **Mitigation:** Clear documentation, default values

2. **Frontend Compatibility**
   - **Probability:** Low
   - **Impact:** Low (UI works, missing features)
   - **Mitigation:** Optional enhancements

---

## 7. Success Metrics

### Technical Metrics
- **Design Completeness:** 100% design documents approved before implementation
- **Code Complexity:** OrionAgent reduced from 864 to ~150 lines
- **Test Coverage:** Maintain >80% coverage
- **Performance:** <10% overhead for two-stage vs standard
- **Code Reuse:** >70% of context building logic shared via services

### Knowledge Metrics
- **Team Understanding:** Can explain protocol strategy patterns
- **Documentation Quality:** All patterns documented with examples
- **Security Awareness:** Team understands redaction requirements

### Operational Metrics
- **Success Rate:** >95% of two-stage requests complete successfully
- **Duplicate Prevention:** >90% reduction in duplicate tool calls
- **Cycle Efficiency:** Avg cycles per turn < 2.5

### User Metrics
- **Response Quality:** No degradation in answer quality
- **Conversation Continuity:** Multi-turn conversations work correctly
- **Error Rate:** <5% of requests require fallback

---

## 8. Dependencies

### Critical Path
```
Task 3.0 (Design Phase) → Task 3.1 (Protocol Implementation) → Task 3.2 (ContextService)
      ↓
Task 3.3 (Enhanced Services) → Task 3.4 (Security) → Task 3.5 (Observability)
      ↓
Task 3.6 (Documentation) → Feature 4 (Tara) → Feature 5 (Devon)
      ↓
Feature 6 (Automation) → Feature 7 (Full Modular - When Needed)
```

### External Dependencies
- **DeepSeek API:** Available and working
- **PostgreSQL Database:** Running with proper schemas
- **Node.js Environment:** Current LTS version

### Knowledge Dependencies (New from RED v3)
- **Protocol Strategy Pattern Knowledge:** Must be documented/learned before Task 3.1
- **Service Extraction Patterns:** Must be understood before Task 3.2
- **Security Redaction Patterns:** Must be defined before Task 3.4

---

## 9. Next Steps

### Immediate (Next 24 hours)
1. **Review and approve** RED v3 analysis findings
2. **Begin Task 3.0.1:** ProtocolStrategy interface design document
3. **Set up design review sessions** for Task 3.0 outputs

### Days 2-3 (Design Phase)
1. **Complete all design documents** (Tasks 3.0.1-3.0.5)
2. **Conduct design reviews** and obtain approvals
3. **Update test plans** based on design specifications

### Days 4-9 (Core Implementation)
1. **Begin Task 3.1:** Protocol strategy implementation
2. **Set up feature flags** for controlled rollout
3. **Run full test suite** to establish baseline

---

## 10. Appendix

### 10.1 Related Documents
- **Original MVP Requirements:** `Orion_System_MVP_Implementation_Requirements_v1.2.md`
- **Two-Stage Protocol Architecture:** `two_stage_protocol_strategy_architecture.md`
- **Modular Agent Architecture:** `modular_agent_architecture.md`
- **Modular Expansion Capabilities:** `modular_expansion_capabilities.md`
- **Trace Event Model:** `DEV_TRACE_EVENT_MODEL.md`
- **Architecture Review Response:** `architecture_review_response.md`
- **RED v3 Analysis:** `RED_Feature3_TwoStage_Protocol_Service_Foundation_Analysis_v3.md`

### 10.2 Current Code References
- **OrionAgent:** `backend/src/agents/OrionAgent.js` (864 lines)
- **TwoStageOrchestrator:** `backend/src/services/TwoStageOrchestrator.js`
- **Chat Messages Route:** `backend/src/routes/chatMessages.js`
- **FileSystemTool:** `backend/tools/FileSystemTool.js`

### 10.3 Glossary
- **A/B Cycling:** Alternating between Action Phase (B) and Tool Phase (A)
- **Context Hydration:** Loading chat history and system state for new turns
- **Protocol Strategy:** Interface for different execution protocols (standard, two-stage)
- **Service Layer:** Reusable components (ContextService, ToolService, etc.)
- **AgentFactory:** Factory for creating agents with dependency injection
- **Phased Modularity:** Incremental service extraction based on actual needs
- **Design-First Approach:** Creating design documents before implementation to address knowledge gaps

---

*Document generated: 2025-12-23*  
*Version 2.2 - Updated based on RED v3 analysis findings, adds design phase, knowledge transfer, and explicit security patterns*
