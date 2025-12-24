# Orion System — Integrated Roadmap v2.0

**Date**: 2025-12-23  
**Author**: Adam (Architect)  
**Status**: Approved  
**Version**: 2.0

## 1. Executive Summary

This roadmap integrates the original MVP implementation requirements with current development progress and future architectural plans. It provides a unified view of the Orion System's evolution from foundational data structures through specialized agent capabilities.

**Core Philosophy:**
- **UI-First:** Every feature results in a visible UI update
- **Role-Centric:** We build the "Brain" and "Hands" for each agent specifically
- **Stateful:** The DB is the Single Source of Truth
- **Modular:** Services enable extensibility and code reuse

**Current State Assessment:**
- **Feature 1 (Foundation):** Mostly complete (database, plan import, viewer UI)
- **Feature 2 (Orion Chat):** In progress (chat API, context system, two-stage protocol)
- **Feature 3-5 (Specialized Agents):** Planned (modular architecture foundation established)

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
  - **Dependencies:** OrionAgent refactoring, service extraction
  - **Timeline:** Week 1-2

- **Task 2.2:** Context Hydration Across Turns
  - **Objective:** Two-stage protocol loads chat history for multi-turn conversations
  - **Current Work:** Design cross-turn context loading strategy
  - **Dependencies:** Task 2.1 completion
  - **Timeline:** Week 2-3

- **Task 2.3:** Enhanced Budget Strategy
  - **Objective:** Replace hard-coded cycle limits with configurable, progress-sensitive budgets
  - **Current Work:** RED v2 analysis for adaptive budgeting
  - **Dependencies:** Two-stage protocol stabilization
  - **Timeline:** Week 3-4

- **Task 2.4:** Trace Redaction & Security
  - **Objective:** Implement `redactDetails()` per DEV_TRACE_EVENT_MODEL.md
  - **Current Work:** Security review of trace logging
  - **Dependencies:** Trace service implementation
  - **Timeline:** Week 4

**Future Tasks:**
- **Task 2.5:** "Plan This" Intent
  - Orion takes user request, uses context tools, generates Draft Plan in DB
  - **Status:** Design phase
  - **Timeline:** After Feature 2 core completion

### Feature 3: Modular Agent Architecture Foundation
**Goal:** Create reusable service layer for multiple specialized agents.
**Status:** Design Complete, Implementation Pending

**Architecture Design:**
- **Service Layer:** ContextService, ToolService, ProtocolService, PlanModeService, ErrorService
- **Agent Layer:** OrionAgent (orchestrator), AdamAgent (architect), TaraAgent (tester), DevonAgent (developer)
- **Protocol Layer:** StandardProtocol, TwoStageProtocol, future specialized protocols

**Tasks:**
- **Task 3.1:** Service Extraction from OrionAgent
  - Extract `ContextService` (context building, prompt formatting)
  - Extract `ToolService` (tool merging, validation, execution)
  - Extract `PlanModeService` (whitelists and filtering)
  - Extract `ErrorService` (error logging and recovery)
  - **Timeline:** Week 1-2 (parallel with Task 2.1)

- **Task 3.2:** OrionAgent Refactor to Use Services
  - Reduce OrionAgent from 864 to ~150 lines
  - Maintain backward compatibility
  - All existing tests pass
  - **Timeline:** Week 2-3

- **Task 3.3:** AgentFactory Implementation
  - Factory for creating agents with dependency injection
  - Configuration system for agent-specific prompts and whitelists
  - **Timeline:** Week 3-4

- **Task 3.4:** BaseAgent Enhancement
  - Add service injection support
  - Standardize agent lifecycle
  - **Timeline:** Week 4

### Feature 4: Specialized Agents Implementation
**Goal:** Implement Adam, Tara, and Devon agents with role-specific capabilities.
**Status:** Design Phase

**Agent Specializations:**
- **AdamAgent (Architect):** System design, task breakdown, architecture analysis
- **TaraAgent (Tester):** Testing, validation, quality assurance
- **DevonAgent (Developer):** Implementation, coding, refactoring

**Tasks:**
- **Task 4.1:** AdamAgent Implementation
  - Architect tools and protocols
  - Design-focused system prompt
  - **Timeline:** After Feature 3 completion

- **Task 4.2:** TaraAgent Implementation
  - Tester tools and protocols
  - Test generation and execution
  - **Timeline:** After AdamAgent

- **Task 4.3:** DevonAgent Implementation
  - Developer tools and protocols
  - Code generation and refactoring
  - **Timeline:** After TaraAgent

- **Task 4.4:** Agent Collaboration Protocols
  - Multi-agent coordination
  - Handover protocols between agents
  - **Timeline:** After all agents implemented

### Feature 5: Automation & Safety (The Pipeline)
**Goal:** Professionalize the workflow with automation and safety measures.
**Status:** Future

**Tasks:**
- **Task 5.1:** Git Automation
  - Orion commits to git after every successful Task completion
  - **Timeline:** After Feature 4

- **Task 5.2:** Concurrency Locks
  - Prevent agents from running on the same file simultaneously
  - **Timeline:** After Feature 4

- **Task 5.3:** Performance Monitoring
  - Agent performance metrics and alerts
  - Resource usage optimization
  - **Timeline:** After Feature 4

---

## 3. Current Development Focus (Next 4 Weeks)

### Week 1-2: Two-Stage Protocol Integration
1. **Protocol Strategy Interface** (`ProtocolStrategy.js`)
2. **StandardProtocol Extraction** from OrionAgent
3. **TwoStageProtocol Conversion** from TwoStageOrchestrator
4. **OrionAgent Coordinator** refactor
5. **Route Integration** for protocol selection

### Week 2-3: Service Extraction
1. **ContextService** extraction
2. **ToolService** extraction  
3. **PlanModeService** extraction
4. **OrionAgent** refactor to use services
5. **Testing** of service interfaces

### Week 3-4: Enhanced Capabilities
1. **Context Hydration** for multi-turn conversations
2. **Configurable Budgets** (env vars for cycle limits)
3. **Trace Redaction** implementation
4. **AgentFactory** foundation

### Week 4: Stabilization
1. **Performance Testing** of new architecture
2. **Backward Compatibility** verification
3. **Documentation** updates
4. **Production Readiness** review

---

## 4. UI Checkpoints

1.  **Feature 1:** Open "Plan" tab → See the Roadmap tree ✓
2.  **Feature 2:** Open "Chat" tab → Ask "What is in src/?" → Orion lists files ✓
3.  **Feature 2 Enhanced:** Toggle "2-stage" mode → See A/B cycling in trace events
4.  **Feature 3:** Agent selection dropdown → Choose between Orion/Adam/Tara/Devon
5.  **Feature 4:** Click "Run Test" on a Subtask → See Tara wake up, run test, Step turns Green/Red
6.  **Feature 4:** Click "Implement" → See Devon edit code → See Tara run regression

---

## 5. Architectural Principles

### 5.1 Minimalism First
- Only propose tools, frameworks, or patterns strictly necessary
- Avoid new libraries unless clear benefit (solves blocker or reduces repeated work)
- Extract services only when duplication exists

### 5.2 Follow Existing Stack
- PostgreSQL, Vue 3, Node.js, Express
- No ORMs or abstraction layers unless critical requirement
- Native SQL for database operations

### 5.3 Design for Testability
- Every task testable by Tara
- APIs mockable for unit tests
- Clear test boundaries (unit vs integration)

### 5.4 Modular Expansion
- Services with clear interfaces for extensibility
- Plugin system for new capabilities
- Feature flags for gradual rollout

---

## 6. Risk Assessment

### High Risk (Block Production)
1. **Protocol Integration Complexity**
   - **Probability:** Medium
   - **Impact:** High (could break existing functionality)
   - **Mitigation:** Thorough testing, gradual rollout

2. **Service Extraction Breaking Changes**
   - **Probability:** Medium  
   - **Impact:** High (OrionAgent regression)
   - **Mitigation:** Comprehensive test suite, feature flags

### Medium Risk
1. **Performance Impact**
   - **Probability:** Medium
   - **Impact:** Medium (slower response times)
   - **Mitigation:** Profile before/after, optimize bottlenecks

2. **Configuration Management**
   - **Probability:** Low
   - **Impact:** Medium (operational complexity)
   - **Mitigation:** Clear documentation, default values

### Low Risk
1. **Frontend Compatibility**
   - **Probability:** Low
   - **Impact:** Low (UI works, missing features)
   - **Mitigation:** Optional enhancements

---

## 7. Success Metrics

### Technical Metrics
- **Code Complexity:** OrionAgent reduced from 864 to ~150 lines
- **Test Coverage:** Maintain >80% coverage
- **Performance:** <10% overhead for two-stage vs standard
- **Code Reuse:** >60% of code shared via services

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
Task 2.1 (Protocol Integration) → Task 2.2 (Context Hydration)
      ↓
Task 3.1 (Service Extraction) → Task 3.2 (OrionAgent Refactor)
      ↓
Task 3.3 (AgentFactory) → Task 4.1 (AdamAgent)
```

### External Dependencies
- **DeepSeek API:** Available and working
- **PostgreSQL Database:** Running with proper schemas
- **Node.js Environment:** Current LTS version

---

## 9. Next Steps

### Immediate (Next 24 hours)
1. **Begin Task 2.1:** Protocol strategy interface implementation
2. **Set up feature flags** for controlled rollout
3. **Run full test suite** to establish baseline

### This Week
1. **Complete Protocol Strategy Interface**
2. **Begin StandardProtocol extraction**
3. **Update test mocks** for new architecture

### Next Week
1. **Complete TwoStageProtocol conversion**
2. **Begin ContextService extraction**
3. **Performance testing** of new architecture

---

## 10. Appendix

### 10.1 Related Documents
- **Original MVP Requirements:** `Orion_System_MVP_Implementation_Requirements_v1.2.md`
- **Two-Stage Protocol Architecture:** `two_stage_protocol_strategy_architecture.md`
- **Modular Agent Architecture:** `modular_agent_architecture.md`
- **Modular Expansion Capabilities:** `modular_expansion_capabilities.md`
- **Trace Event Model:** `DEV_TRACE_EVENT_MODEL.md`

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

---

*Document generated: 2025-12-23*  
*Integrates original MVP requirements with current development and future architecture plans*
