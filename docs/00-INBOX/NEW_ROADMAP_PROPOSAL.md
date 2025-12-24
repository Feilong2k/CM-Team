# New Roadmap Proposal - December 2025

**Date**: 2025-12-23  
**Author**: Adam (Architect)  
**Status**: Proposal - Awaiting Approval  
**Based On**: Architect review of three design documents and current project state

## 1. Executive Summary

This roadmap proposal reorients the project based on today's architectural review and decisions. It prioritizes immediate integration of the two-stage protocol while establishing a foundation for future modular agent architecture.

### Key Changes from Current Roadmap:
1. **Immediate Focus**: Strategy pattern for protocol integration (Week 1-2)
2. **Phased Approach**: Selective service extraction (ContextService, ToolService) before full modular architecture
3. **Realistic Sequencing**: Address current duplication before speculative multi-agent development
4. **Risk-Aware**: Gradual rollout with feature flags and comprehensive testing

## 2. Current State Assessment (Based on Database Query)

### 2.1 Database State (Feature 2: Orion Chat & Context)
**Feature Status**: `in progress` (P1-F2)

**Tasks**:
| Task | Title | Status | Subtasks |
|------|-------|--------|----------|
| **P1-F2-T0** | Resolve Missing Fundamentals from RED & CAP/PCC Analysis | `done` | 7 subtasks (6 done, 1 blocked) |
| **P1-F2-T1** | Chat API & Persistence | `in progress` | 23 subtasks |
| **P1-F2-T2** | Context System (The "Eyes") | `pending` | 0 subtasks |
| **P1-F2-T3** | "Plan This" Intent | `pending` | 0 subtasks |

**Key Completed Subtasks**:
- **P1-F2-T0-S1** to **S6**: All fundamentals completed
- **P1-F2-T1-S1, S2**: LLM Adapter Foundation & OrionAgent Integration (done)
- **P1-F2-T1-S4** to **S15**: Streaming, trace, scroll, message expansion (done)
- **P1-F2-T1-S19**: ACT-mode tool dedup + PLAN/ACT separation (done)
- **P1-F2-T1-S21**: Enhanced Soft Stop (done)
- **P1-F2-T1-S22**: Two-stage protocol foundation (done)

**Current In-Progress Work**:
- **P1-F2-T1-S18**: FileSystemTool compatibility with single-args pattern (`in progress`)
- **P1-F2-T1-S23**: Two-stage/Triggered-Phase Prototype (`in progress`, flagged)

**Blocked Work**:
- **P1-F2-T0-S7**: Implement Orion DB Surface v1.1 (`blocked`)

### 2.2 Key Problems Identified
1. **Duplication**: OrionAgent (864 lines) and TwoStageOrchestrator duplicate context building
2. **Complexity**: Adding two-stage to OrionAgent would push it to ~1,100+ lines
3. **Missing Context**: Two-stage prototype lacks OrionAgent's rich context (chat history, file list)
4. **Limited Reusability**: Architecture not designed for multiple specialized agents
5. **Inconsistent Status**: Database shows many subtasks as "done" but roadmap shows them as pending

### 2.3 What's Working
- **Basic OrionAgent**: 864-line orchestrator with context building, tool execution
- **Two-Stage Prototype**: TwoStageOrchestrator.js (functional but lacks OrionAgent context)
- **Database Schema**: Features, tasks, subtasks structure in place with 30 subtasks tracked
- **Testing Framework**: Tara tests with CDP analysis covering completed work
- **Frontend Chat**: Basic streaming UI with scroll, message expansion features

## 3. New Roadmap Structure

### 3.1 Phase 1: Protocol Strategy Integration (Week 1)
**Goal**: Complete two-stage prototype integration using strategy pattern

| Task ID | Title | Description | Priority | Est. Days | Dependencies |
|---------|-------|-------------|----------|-----------|--------------|
| **P1-T1** | Unblock P1-F2-T0-S7 | Resolve Orion DB Surface v1.1 blocking issue | Critical | 2 | None |
| **P1-T2** | Complete P1-F2-T1-S18 | Finish FileSystemTool compatibility work | High | 2 | None |
| **P1-T3** | Protocol Strategy Interface | Create ProtocolStrategy interface and factory | High | 2 | P1-T1 |
| **P1-T4** | Standard Protocol Extraction | Extract current OrionAgent logic to StandardProtocol | High | 3 | P1-T3 |
| **P1-T5** | Two-Stage Protocol Conversion | Convert TwoStageOrchestrator to TwoStageProtocol | High | 3 | P1-T4 |
| **P1-T6** | OrionAgent Coordinator | Refactor OrionAgent to use protocol strategies | High | 2 | P1-T5 |
| **P1-T7** | Complete P1-F2-T1-S23 | Finish two-stage prototype with full context | Critical | 3 | P1-T6 |
| **P1-T8** | Testing & Validation | Comprehensive tests for both protocols | High | 3 | P1-T7 |

**Success Criteria**:
- OrionAgent < 300 lines
- Both protocols work with OrionAgent context building
- All existing tests pass
- Two-stage route has full context support
- P1-F2-T1-S23 marked as `completed`

### 3.2 Phase 2: Service Extraction & Context System (Weeks 2-3)
**Goal**: Extract reusable services and implement Context System (P1-F2-T2)

| Task ID | Title | Description | Priority | Est. Days | Dependencies |
|---------|-------|-------------|----------|-----------|--------------|
| **P2-T1** | ContextService Extraction | Extract context building from protocols | High | 3 | Phase 1 complete |
| **P2-T2** | ToolService Extraction | Extract tool merging, validation, execution | High | 3 | P2-T1 |
| **P2-T3** | Service Integration | Update protocols to use services | High | 2 | P2-T2 |
| **P2-T4** | Context System Implementation | Implement P1-F2-T2 (The "Eyes") | High | 5 | P2-T3 |
| **P2-T5** | PlanModeService | Extract plan mode whitelist logic | Medium | 2 | P2-T3 |
| **P2-T6** | Delete TwoStageOrchestrator | Remove old prototype file | Low | 0.5 | P2-T3 |
| **P2-T7** | Database Cleanup | Update subtask statuses to reflect completion | Medium | 1 | Phase 1 complete |

**Success Criteria**:
- ContextService and ToolService unit tested
- OrionAgent < 200 lines
- 60% code reuse between protocols
- Context System (P1-F2-T2) implemented
- Delete TwoStageOrchestrator.js
- Database accurately reflects completed work

### 3.3 Phase 3: "Plan This" Intent & Multi-Agent Foundation (Weeks 4-5)
**Goal**: Implement "Plan This" Intent (P1-F2-T3) and create foundation for specialized agents

| Task ID | Title | Description | Priority | Est. Days | Dependencies |
|---------|-------|-------------|----------|-----------|--------------|
| **P3-T1** | "Plan This" Intent Implementation | Implement P1-F2-T3 | High | 5 | Phase 2 complete |
| **P3-T2** | AgentFactory | Factory for creating agents with dependency injection | Medium | 3 | P3-T1 |
| **P3-T3** | BaseAgent Enhancement | Add service injection support | Medium | 2 | P3-T2 |
| **P3-T4** | Configuration System | Agent-specific configs (prompts, whitelists) | Medium | 3 | P3-T3 |
| **P3-T5** | AdamAgent Skeleton | Create AdamAgent with architect role | Low | 2 | P3-T4 |
| **P3-T6** | Feature 2 Completion | Mark Feature 2 as `completed` in database | High | 0.5 | P3-T1 |

**Success Criteria**:
- "Plan This" Intent (P1-F2-T3) implemented
- AgentFactory can create OrionAgent with services
- Configuration system supports agent-specific prompts
- AdamAgent skeleton exists (no implementation yet)
- Feature 2 marked as `completed`

### 3.4 Phase 4: Specialized Agents & Feature 3 (Future)
**Goal**: Implement specialized agents and begin Feature 3 based on concrete requirements

| Task ID | Title | Description | Priority | Est. Days | Dependencies |
|---------|-------|-------------|----------|-----------|--------------|
| **P4-T1** | Feature 3 Planning | Define Feature 3 scope and requirements | Future | 3 | Phase 3 complete |
| **P4-T2** | AdamAgent Implementation | Architect tools and protocols | Future | 5 | P4-T1 |
| **P4-T3** | TaraAgent Implementation | Tester tools and protocols | Future | 5 | P4-T2 |
| **P4-T4** | DevonAgent Implementation | Developer tools and protocols | Future | 5 | P4-T3 |
| **P4-T5** | Agent Collaboration | Multi-agent coordination protocols | Future | 7 | P4-T4 |

**Note**: These tasks are deferred until Feature 2 is complete and Feature 3 requirements are defined. Current focus is completing Feature 2 with extensible architecture.

## 4. Task Breakdown (Detailed)

### 4.1 P1-T1: Protocol Strategy Interface
**Implementation Requirements**:
```javascript
// backend/src/agents/protocols/ProtocolStrategy.js
class ProtocolStrategy {
  async *execute(messages, tools, options) {
    throw new Error('Not implemented');
  }
}

// backend/src/agents/protocols/ProtocolFactory.js
class ProtocolFactory {
  static createProtocol(type, services) {
    switch(type) {
      case 'standard': return new StandardProtocol(services);
      case 'two-stage': return new TwoStageProtocol(services);
      default: throw new Error(`Unknown protocol: ${type}`);
    }
  }
}
```

**Acceptance Criteria**:
- Interface defines execute() method with proper parameters
- Factory can create protocol instances
- Unit tests for factory and interface

### 4.2 P1-T2: Standard Protocol Extraction
**Implementation Requirements**:
- Extract current OrionAgent.processStreaming() logic to StandardProtocol
- Maintain exact same behavior
- Update OrionAgent to delegate to StandardProtocol

**Acceptance Criteria**:
- All existing OrionAgent tests pass
- StandardProtocol produces identical output
- OrionAgent reduced by ~300 lines

### 4.3 P1-T3: Two-Stage Protocol Conversion
**Implementation Requirements**:
- Convert TwoStageOrchestrator to TwoStageProtocol
- Use OrionAgent's context building (via services in Phase 2)
- Maintain A/B cycling behavior

**Acceptance Criteria**:
- Two-stage protocol works with OrionAgent context
- All existing two-stage tests pass
- Protocol follows strategy interface

### 4.4 P2-T1: ContextService Extraction
**Implementation Requirements**:
```javascript
class ContextService {
  async buildContext(projectId, options) {
    // Load chat history, file list, system state
  }
  
  formatSystemPrompt(context, mode, agentRole) {
    // Format prompt with agent-specific instructions
  }
}
```

**Acceptance Criteria**:
- ContextService unit tested
- Both protocols use ContextService
- No duplication of context building logic

## 5. Dependencies and Sequencing

### 5.1 Critical Path
```
P1-T1 (Protocol Interface) → P1-T2 (Standard Protocol) → P1-T3 (Two-Stage Protocol)
      ↓
P1-T4 (OrionAgent Coordinator) → P1-T5 (Route Integration)
      ↓
P2-T1 (ContextService) → P2-T2 (ToolService) → P2-T3 (Service Integration)
```

### 5.2 Optional/Deferred
- P2-T4 (PlanModeService): Only if whitelist logic becomes complex
- P2-T5 (ErrorService): Only if error handling needs enhancement
- Phase 3 & 4: Deferred until concrete multi-agent requirements

## 6. Risk Assessment

### 6.1 Technical Risks
| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Refactor breaks existing functionality** | Medium | High | Comprehensive test suite, feature flags |
| **Performance degradation** | Low | Medium | Profile before/after, optimize hot paths |
| **Increased complexity** | Medium | Medium | Keep OrionAgent simple, document boundaries |

### 6.2 Operational Risks
| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Team unfamiliar with new patterns** | Medium | Low | Pair programming, documentation |
| **Over-engineering** | High | Medium | Stick to "extract only when duplicated" |
| **Scope creep** | Medium | Medium | Clear acceptance criteria for each phase |

### 6.3 Business Risks
| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Delayed two-stage rollout** | Low | High | Strategy pattern first, services later |
| **Reduced velocity during refactor** | High | Medium | Small, incremental changes |

## 7. Success Metrics

### 7.1 Phase 1 Metrics
- **Code Reduction**: OrionAgent from 864 to < 300 lines
- **Test Coverage**: Maintain >80% coverage
- **Performance**: No degradation in response time
- **Functionality**: Both protocols work with full context

### 7.2 Phase 2 Metrics
- **Code Reuse**: 60% of code shared via services
- **Testability**: Services independently unit tested
- **Maintainability**: Update service once, both protocols benefit

### 7.3 Overall Metrics
- **Time to New Protocol**: < 1 week (vs current ~2 weeks)
- **Agent Creation Time**: < 1 day (with AgentFactory)
- **Bug Rate**: Reduced due to shared, tested services

## 8. Alignment with Architectural Principles

### 8.1 Minimalism First
- Phase 1: Only extract protocols (solves immediate duplication)
- Phase 2: Only extract ContextService and ToolService (most duplicated)
- Phase 3: Deferred until needed

### 8.2 Follow Existing Stack
- Uses current Node.js, PostgreSQL, Vue.js stack
- No new frameworks or libraries
- Builds on existing TwoStageOrchestrator

### 8.3 Design for Testability
- Protocol strategies independently testable
- Services unit testable
- Clear seams for Tara tests

### 8.4 Justify Choices
- Strategy pattern: Solves duplication between OrionAgent and TwoStageOrchestrator
- Service extraction: Enables code reuse, reduces maintenance
- Phased approach: Minimizes risk, delivers value incrementally

## 9. Next Steps

### 9.1 Immediate (Next 24 hours)
1. **Review this roadmap** - Provide feedback on priorities and sequencing
2. **Approve Phase 1 implementation** - Begin with P1-T1
3. **Create detailed task breakdowns** - For P1-T1 through P1-T6

### 9.2 This Week
1. **Begin P1-T1 implementation** - Protocol strategy interface
2. **Set up feature flags** - For controlled rollout
3. **Run full test suite** - Establish baseline

### 9.3 Next Week
1. **Complete Phase 1** - Protocol strategy integration
2. **Deploy updated OrionAgent** - With two-stage protocol support
3. **Begin Phase 2 planning** - ContextService extraction

## 10. Request for Approval

**Please review and provide feedback on**:
1. Overall roadmap structure and phasing
2. Task priorities and sequencing
3. Risk assessment and mitigation
4. Success metrics

**Key Decisions Needed**:
1. Proceed with Phase 1 immediately? (Yes/No)
2. Approve phased approach vs big bang? (Phased/Big Bang)
3. Any adjustments to timeline or scope?

**Once approved**, we will:
1. Create detailed implementation requirements for each task
2. Begin Phase 1 implementation
3. Update team on new roadmap

---

**Note**: This roadmap replaces the previous Feature 2 roadmap, focusing on the architectural decisions made today. It maintains backward compatibility while enabling future growth.
