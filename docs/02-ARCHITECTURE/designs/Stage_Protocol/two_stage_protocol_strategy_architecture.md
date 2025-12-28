# Two-Stage Protocol Integration Architecture (Strategy Pattern)

**Date**: 2025-12-23  
**Author**: Adam (Architect)  
**Status**: Approved  
**Version**: 1.0

## 1. Executive Summary

This document outlines the architecture for integrating the two-stage (triggered-phase) protocol into the existing OrionAgent using the Strategy Pattern. The goal is to create a clean, maintainable separation between OrionAgent's coordination responsibilities and protocol-specific logic, enabling both standard and two-stage protocols to coexist with minimal complexity.

## 2. Problem Statement

### Current State
- **OrionAgent** (864 lines) handles context building, tool merging, streaming, and looped tool execution
- **TwoStageOrchestrator** (500+ lines) duplicates context building and lacks OrionAgent's rich features
- Two separate code paths create maintenance burden and inconsistent behavior

### Requirements
1. Single OrionAgent capable of both standard and two-stage protocols
2. Clean separation of concerns to prevent complexity explosion
3. Reuse OrionAgent's existing context building, tool registry, and error handling
4. Maintain backward compatibility with existing routes
5. Enable gradual migration from standard to two-stage as primary protocol

## 3. Architecture Design

### 3.1 Strategy Pattern Implementation

```
backend/src/agents/
├── OrionAgent.js              (Coordinator, ~200 lines)
├── protocols/
│   ├── ProtocolStrategy.js    (Interface)
│   ├── StandardProtocol.js    (Current logic, ~400 lines)
│   └── TwoStageProtocol.js    (Two-stage logic, ~400 lines)
```

### 3.2 Interface Definition

```javascript
// ProtocolStrategy.js
class ProtocolStrategy {
  /**
   * Execute protocol with context and tools
   * @param {Object} context - Prepared request context (messages, projectId, mode, etc.)
   * @param {Object} tools - Tool registry
   * @param {Object} options - { requestId, mode, twoStageDebug, etc. }
   * @returns {AsyncGenerator<SSEEvent>} Stream of SSE events
   */
  async *execute(context, tools, options) {}
  
  /**
   * Get protocol metadata (name, description, capabilities)
   */
  getMetadata() {}
}
```

### 3.3 OrionAgent as Coordinator

```javascript
class OrionAgent extends BaseAgent {
  constructor(adapter, tools, promptPath = null, options = {}) {
    super(adapter, tools, 'Orion');
    this.protocol = options.protocol || 'standard'; // 'standard' | 'two-stage'
    this.protocolStrategy = this._createProtocolStrategy();
  }
  
  async *processStreaming(projectId, userMessage, options = {}) {
    // 1. Build context (chat history, file list, system prompt)
    const { messages, context } = await this._prepareRequest(projectId, userMessage, options);
    
    // 2. Delegate to protocol strategy
    const executionOptions = {
      ...options,
      projectId,
      userMessage,
      orionAgent: this // For access to logging, etc.
    };
    
    yield* this.protocolStrategy.execute(
      { messages, context, projectId, userMessage },
      this.tools,
      executionOptions
    );
  }
}
```

## 4. Protocol Implementations

### 4.1 StandardProtocol (Existing Logic)
- **Purpose**: Current OrionAgent looped execution (5 iterations max)
- **Features**:
  - Tool call merging and accumulation
  - Plan mode whitelist enforcement
  - Tool result injection as system messages
  - Trace logging integration

### 4.2 TwoStageProtocol (New from TwoStageOrchestrator)
- **Purpose**: A/B cycling with triggered-phase protocol
- **Features**:
  - Action Phase (B): Model streams reasoning, stops at first complete tool call
  - Tool Phase (A): Execute first complete tool call, inject result
  - Duplicate detection and prevention (MAX_DUPLICATE_ATTEMPTS_PER_TURN = 3)
  - Cycle budget enforcement (MAX_PHASE_CYCLES_PER_TURN = 3)
  - Phase metadata in SSE events (phase, phaseIndex, cycleIndex)

## 5. Production Readiness Requirements

### 5.1 Phase 1: Core Integration (Week 1)
**Goal**: Working two-stage protocol with OrionAgent's context building

| Task | Owner | Description | Acceptance Criteria |
|------|-------|-------------|---------------------|
| **T1.1**: Protocol Interface | Devon | Create `ProtocolStrategy.js` interface | Interface defines `execute()` method |
| **T1.2**: StandardProtocol Refactor | Devon | Extract current logic from OrionAgent to StandardProtocol.js | All existing tests pass, no behavior change |
| **T1.3**: TwoStageProtocol Creation | Devon | Convert TwoStageOrchestrator to TwoStageProtocol.js | Implements ProtocolStrategy, passes two-stage tests |
| **T1.4**: OrionAgent Coordinator | Devon | Simplify OrionAgent to use protocol strategies | Routes can choose protocol via constructor option |
| **T1.5**: Route Integration | Devon | Update `/api/chat/messages_two_stage` to use TwoStageProtocol | Feature flag `TWO_STAGE_ENABLED` still works |

### 5.2 Phase 2: Context Hydration (Week 2)
**Goal**: Cross-turn conversation history in two-stage protocol

| Task | Owner | Description | Acceptance Criteria |
|------|-------|-------------|---------------------|
| **T2.1**: Context Building Audit | Adam | Analyze OrionAgent's `_prepareRequest()` for two-stage compatibility | Document any adjustments needed |
| **T2.2**: History Integration | Devon | Ensure TwoStageProtocol uses OrionAgent's context building | Two-stage route loads last 10 chat messages |
| **T2.3**: System Prompt Enhancement | Devon | Combine OrionAgent's rich prompt with two-stage instructions | System prompt includes both context and protocol rules |
| **T2.4**: Token Management | Devon | Implement token counting/truncation for long histories | Messages truncated before token limit exceeded |

### 5.3 Phase 3: Security & Configuration (Week 3)
**Goal**: Production-ready security and configurability

| Task | Owner | Description | Acceptance Criteria |
|------|-------|-------------|---------------------|
| **T3.1**: Trace Redaction | Devon | Implement `redactDetails()` per DEV_TRACE_EVENT_MODEL.md | Sensitive data (API keys, paths) redacted in logs |
| **T3.2**: Configurable Budgets | Devon | Replace hard-coded constants with env vars | `TWO_STAGE_MAX_CYCLES`, `TWO_STAGE_MAX_DUPLICATES` |
| **T3.3**: Phase Trace Events | Devon | Add phase-specific trace event types | `phase_start`, `phase_end`, `budget_exhausted` in TRACE_TYPES |
| **T3.4**: Error Recovery | Devon | Implement graceful degradation on protocol failures | Falls back to standard protocol with error logging |

### 5.4 Phase 4: Enhanced Intelligence (Week 4)
**Goal**: Advanced protocol features

| Task | Owner | Description | Acceptance Criteria |
|------|-------|-------------|---------------------|
| **T4.1**: Progress-Sensitive Budgeting | Adam | Design adaptive cycle limits based on progress | RED v3 analysis document |
| **T4.2**: Frontend Phase Visualization | Devon | Add phase indicators to ChatPanel (optional) | Users see phase transitions in UI |
| **T4.3**: Protocol Performance Metrics | Tara | Add monitoring for protocol effectiveness | Success rate, avg cycles, duplicate rate tracked |

## 6. Implementation Details

### 6.1 File Structure Changes

```
backend/src/agents/
├── OrionAgent.js                          # Coordinator (200 lines)
├── protocols/
│   ├── ProtocolStrategy.js                # Interface (50 lines)
│   ├── StandardProtocol.js                # Current logic (400 lines)
│   └── TwoStageProtocol.js                # Two-stage logic (400 lines)
└── BaseAgent.js                           # Unchanged

backend/src/services/
├── TwoStageOrchestrator.js                # DELETE after migration
└── (other services unchanged)

backend/src/routes/chatMessages.js         # Updated to use protocol strategies
```

### 6.2 Dependencies

```javascript
// TwoStageProtocol will depend on:
const ToolRunner = require('../../tools/ToolRunner');
const { buildCanonicalSignature } = require('../../tools/ToolRunner');
const TraceService = require('../services/trace/TraceService');

// But NOT on OrionAgent (to avoid circular dependency)
```

### 6.3 Testing Strategy

1. **Unit Tests**: Each protocol tested independently
2. **Integration Tests**: OrionAgent with each protocol
3. **Backward Compatibility**: All existing tests pass
4. **New Two-Stage Tests**: Enhanced to test with OrionAgent context

## 7. Rollout Strategy

### 7.1 Current State
- `TWO_STAGE_ENABLED=false` by default
- Route returns 501 when disabled
- Frontend toggle persists to localStorage

### 7.2 Recommended Rollout
1. **Phase 1 Complete**: Enable for project P1 only
2. **Phase 2 Complete**: Enable for all projects
3. **Phase 3 Complete**: Consider making default for new projects

### 7.3 Rollback Plan
- Flip `TWO_STAGE_ENABLED=false`
- Frontend automatically falls back to standard protocol
- No data migration required

## 8. Risk Assessment

### 8.1 High Risk (Block Production)
1. **Protocol Integration Complexity**
   - **Probability**: Medium
   - **Impact**: High (could break existing functionality)
   - **Mitigation**: Thorough testing, gradual rollout

2. **Context Hydration Issues**
   - **Probability**: Low
   - **Impact**: High (breaks multi-turn conversations)
   - **Mitigation**: Test with real conversation history

### 8.2 Medium Risk
1. **Performance Impact**
   - **Probability**: Medium
   - **Impact**: Medium (slower response times)
   - **Mitigation**: Profile both protocols, optimize bottlenecks

2. **Configuration Management**
   - **Probability**: Low
   - **Impact**: Medium (operational complexity)
   - **Mitigation**: Clear documentation, default values

### 8.3 Low Risk
1. **Frontend Compatibility**
   - **Probability**: Low
   - **Impact**: Low (UI works, missing phase indicators)
   - **Mitigation**: Optional enhancement

## 9. Success Metrics

### 9.1 Technical Metrics
- **Code Complexity**: OrionAgent lines reduced from 864 to ~200
- **Test Coverage**: Maintain >80% coverage for all protocols
- **Performance**: <10% overhead for two-stage vs standard

### 9.2 Operational Metrics
- **Success Rate**: >95% of two-stage requests complete successfully
- **Duplicate Prevention**: >90% reduction in duplicate tool calls
- **Cycle Efficiency**: Avg cycles per turn < 2.5

### 9.3 User Metrics
- **Response Quality**: No degradation in answer quality
- **Conversation Continuity**: Multi-turn conversations work correctly
- **Error Rate**: <5% of requests require fallback to standard

## 10. Definition of Done (Production Ready)

### 10.1 Technical DoD
- [ ] All Phase 1-3 tasks complete
- [ ] All existing tests pass
- [ ] New two-stage tests with OrionAgent context pass
- [ ] Code coverage maintained >80%
- [ ] No linting errors

### 10.2 Operational DoD
- [ ] Configurable via environment variables
- [ ] Trace redaction implemented
- [ ] Phase trace events logged
- [ ] Graceful error recovery

### 10.3 User Experience DoD
- [ ] Cross-turn conversations work
- [ ] No infinite loops in duplicate scenarios
- [ ] System prompts include both context and protocol rules
- [ ] Frontend toggle works correctly

## 11. Next Steps

### Immediate (Next 24 hours)
1. **Toggle to Act Mode** and begin implementation
2. **Start with T1.1**: Create ProtocolStrategy interface
3. **Parallel**: Update test mocks for new architecture

### Short Term (Week 1)
1. Complete Phase 1 integration
2. Run full test suite
3. Deploy to development environment

### Medium Term (Week 2-4)
1. Complete Phases 2-4
2. Performance testing
3. Gradual production rollout

## 12. Appendix

### 12.1 Decision Log
- **2025-12-23**: Chose Strategy Pattern over monolithic OrionAgent or separate orchestrator
- **Rationale**: Clean separation of concerns, maintainable, testable
- **Alternatives Considered**: Monolithic OrionAgent, Separate Script, Protocol Service

### 12.2 References
- [RED v2 Analysis](docs/analysis/two_stage_protocol/RED_two_stage_protocol_plan_v2_implementation.md)
- [Two-Stage Prototype Tests](backend/src/_test_/two_stage_protocol.spec.js)
- [OrionAgent Current Implementation](backend/src/agents/OrionAgent.js)
- [TwoStageOrchestrator Prototype](backend/src/services/TwoStageOrchestrator.js)

### 12.3 Glossary
- **A/B Cycling**: Alternating between Action Phase (B) and Tool Phase (A)
- **Triggered-Phase Protocol**: Another term for two-stage protocol
- **Phase Metadata**: SSE event fields: `phase`, `phaseIndex`, `cycleIndex`
- **Context Hydration**: Loading chat history and system state for new turns

---

*Document generated: 2025-12-23*  
*Based on architectural review of OrionAgent.js and TwoStageOrchestrator.js*
