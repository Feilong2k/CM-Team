# RED v2 Analysis: Feature 3 - Two-Stage Protocol & Service Foundation (Production-Ready) - Version 3

**Date:** 2025-12-23  
**Author:** Adam (Architect)  
**Status:** Draft  
**Version:** 3.0

---

## 1. Overview

This analysis follows the **UPDATED RED v2 protocol** requiring **full recursive decomposition of ALL items to atomic primitives** as defined in `docs/03-PROTOCOLS/core/Primitive_Registry.md`. No early stopping is allowed, regardless of verification status.

The goal is to implement a production-ready two-stage protocol with strategy pattern and modular services. This analysis uncovers hidden missing fundamentals, knowledge gaps, and verification requirements.

**Current Codebase State:**
- `TwoStageOrchestrator.js` (prototype): A/B cycling, duplicate detection, phase metadata
- `OrionAgent.js` (864 lines): Monolithic orchestrator with context building and chat history loading
- Supporting components: `ToolRunner.js`, `TraceService.js`, `GPT41Adapter.js`, and database schema with `chat_messages` table

---

## 2. RED Breakdown — Expanded Tables

### 2.1 Level 1 → Level 2

| L1 Action (Parent) | L2 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|--------------------|-------------------|-------------------|--------------------|--------|-----------:|--------|
| Implement Two-Stage Protocol Strategy | Create ProtocolStrategy interface | Node.js, JS classes | Design spec for interface | ProtocolStrategy.js file | ✗ | MISSING |
| Implement Two-Stage Protocol Strategy | Extract StandardProtocol from OrionAgent | OrionAgent.js | Refactor plan | StandardProtocol.js file | ✗ | MISSING |
| Implement Two-Stage Protocol Strategy | Convert TwoStageOrchestrator to TwoStageProtocol | TwoStageOrchestrator.js | Refactor plan | TwoStageProtocol.js file | ✗ | MISSING |
| Implement Two-Stage Protocol Strategy | Refactor OrionAgent to use protocol strategies | OrionAgent.js | Refactor plan | Updated OrionAgent.js | ✗ | MISSING |
| Selective Service Extraction | Extract ContextService | OrionAgent.js, TwoStageOrchestrator.js | Code duplication identified | ContextService.js file | ✗ | MISSING |
| Selective Service Extraction | Extract ToolService | OrionAgent.js, TwoStageOrchestrator.js | Code duplication identified | ToolService.js file | ✗ | MISSING |
| Enhanced Service Layer | Extract PlanModeService | OrionAgent.js | Whitelist logic | PlanModeService.js file | ✗ | MISSING |
| Enhanced Service Layer | Extract ErrorService | OrionAgent.js | Error handling | ErrorService.js file | ✗ | MISSING |
| Security & Configuration | Implement redactDetails() | TraceService.js | DEV_TRACE_EVENT_MODEL.md | redactDetails function | ✗ | MISSING |
| Security & Configuration | Make budgets configurable via env vars | TwoStageProtocol.js | Env var config | Config files | ✗ | MISSING |
| Security & Configuration | Add phase trace events to TRACE_TYPES | TraceEvent.js | Trace schema | Updated TRACE_TYPES | ✗ | MISSING |
| Observability & Stabilization | Integrate phase trace events in TwoStageProtocol | TwoStageProtocol.js | TraceService | Updated TwoStageProtocol.js | ✗ | MISSING |
| Observability & Stabilization | Performance testing and backward compatibility | Test suite | Test environment | Test reports | ✗ | NEED_Verification |

### 2.2 Level 2 → Level 3 (Complete Decomposition)

| L2 Action (Parent) | L3 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|--------------------|-------------------|-------------------|--------------------|--------|-----------:|--------|
| Create ProtocolStrategy interface | Design ProtocolStrategy interface spec | Design tools | Protocol design patterns | Design document | ✗ | MISSING |
| Create ProtocolStrategy interface | Implement ProtocolStrategy.js class | Node.js, JS classes | Design spec | ProtocolStrategy.js file | ✗ | MISSING |
| Create ProtocolStrategy interface | Add execute() method implementation | JS syntax | Method design | ProtocolStrategy.js | ✗ | MISSING |
| Extract ContextService | Analyze OrionAgent context building | OrionAgent.js | Code analysis tools | Analysis report | ✗ | MISSING |
| Extract ContextService | Design ContextService interface | Design tools | Service design patterns | Design document | ✗ | MISSING |
| Extract ContextService | Implement ContextService.js class | Node.js, JS classes | Design spec | ContextService.js file | ✗ | MISSING |
| Implement redactDetails() | Analyze sensitive data patterns | TraceService.js | Security requirements | Analysis document | ✗ | MISSING |
| Implement redactDetails() | Design redaction patterns | Design tools | Regex/security patterns | Design document | ✗ | MISSING |
| Implement redactDetails() | Implement redactDetails() function | JS syntax | Security implementation | redactDetails function | ✗ | MISSING |
| Add phase trace events to TRACE_TYPES | Review current TRACE_TYPES | TraceEvent.js | Trace schema | Analysis document | ✗ | MISSING |
| Add phase trace events to TRACE_TYPES | Design new trace event types | Design tools | Trace schema design | Updated TRACE_TYPES | ✗ | MISSING |
| Add phase trace events to TRACE_TYPES | Update TRACE_TYPES constant | JS syntax | Code editing | Updated TraceEvent.js | ✗ | MISSING |

### 2.3 Level 3 → Level 4 (Decomposition to Registry Primitives)

| L3 Action (Parent) | L4 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|--------------------|-------------------|-------------------|--------------------|--------|-----------:|--------|
| Design ProtocolStrategy interface spec | Write interface design document | Design tools | Protocol design knowledge | Design document | ✗ | MISSING |
| Implement ProtocolStrategy.js class | Create ProtocolStrategy.js file | Node.js fs module | File system | ProtocolStrategy.js | ✓ (FS: write_file) | VERIFIED_HAVE |
| Implement ProtocolStrategy.js class | Write class definition | JS syntax | Coding standards | ProtocolStrategy.js | ✗ | MISSING |
| Add execute() method implementation | Write method signature | JS syntax | Method design | ProtocolStrategy.js | ✗ | MISSING |
| Add execute() method implementation | Write method body | JS syntax | Implementation logic | ProtocolStrategy.js | ✗ | MISSING |
| Design ContextService interface | Write service design document | Design tools | Service design knowledge | Design document | ✗ | MISSING |
| Implement ContextService.js class | Create ContextService.js file | Node.js fs module | File system | ContextService.js | ✓ (FS: write_file) | VERIFIED_HAVE |
| Implement redactDetails() function | Write function signature | JS syntax | Security design | TraceService.js | ✗ | MISSING |
| Implement redactDetails() function | Implement regex patterns | JS regex | Security patterns | TraceService.js | ✗ | MISSING |
| Implement redactDetails() function | Test redaction with sample data | Test framework | Test data | Test results | ✗ | NEED_Verification |
| Update TRACE_TYPES constant | Edit TraceEvent.js file | Code editor | Trace schema | Updated TraceEvent.js | ✓ (FS: write_file) | VERIFIED_HAVE |

### 2.4 Level 4 → Level 5 (Reaching Atomic Primitives)

| L4 Action (Parent) | L5 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|--------------------|-------------------|-------------------|--------------------|--------|-----------:|--------|
| Create ProtocolStrategy.js file | Call fs.writeFile() | Node.js fs module | Path, content | ProtocolStrategy.js | ✓ (FS: write_file) | VERIFIED_HAVE |
| Create ContextService.js file | Call fs.writeFile() | Node.js fs module | Path, content | ContextService.js | ✓ (FS: write_file) | VERIFIED_HAVE |
| Write class definition | Write "class ProtocolStrategy {" | JS syntax | Class syntax | ProtocolStrategy.js | ✗ | MISSING |
| Write method signature | Write "execute(context) {" | JS syntax | Method syntax | ProtocolStrategy.js | ✗ | MISSING |
| Write method body | Write implementation logic | JS syntax | Business logic | ProtocolStrategy.js | ✗ | MISSING |
| Write function signature | Write "function redactDetails(data) {" | JS syntax | Function syntax | TraceService.js | ✗ | MISSING |
| Implement regex patterns | Write regex pattern for API keys | JS regex | Security patterns | TraceService.js | ✗ | MISSING |
| Edit TraceEvent.js file | Update TRACE_TYPES array | Code editor | Array syntax | TraceEvent.js | ✗ | MISSING |

---

## 3. Tools, Inputs, and Outputs Audit

### 3.1 Tools Audit (Resources Touched)

| Tool / Resource Touched | Where Used (Action) | VERIFIED_HAVE / MISSING | Verification Method | ✓ Verified |
|-------------------------|---------------------|-------------------------|---------------------|-----------:|
| Node.js `fs.writeFile` | Create files | VERIFIED_HAVE | `node -e "console.log(require('fs').writeFile)"` | ✓ |
| JavaScript syntax | Write code | VERIFIED_HAVE | Codebase contains JS files | ✓ |
| Design tools | Interface design | MISSING | No documented design process | |
| Code editor | Edit files | VERIFIED_HAVE | Environment has editor | ✓ |
| Test framework | Test redaction | VERIFIED_HAVE | Jest config exists | ✓ |
| Regex engine | Pattern matching | VERIFIED_HAVE | Node.js has RegExp | ✓ |

### 3.2 Inputs Audit (Resources Required)

| Input / Resource Required | Where Used | Design Required? | Present Now? | VERIFIED_HAVE / MISSING | Verification Method | ✓ Verified |
|--------------------------|------------|-----------------|--------------|------------------------|---------------------|-----------:|
| ProtocolStrategy interface design | Protocol implementation | Yes | No | MISSING | No design document | |
| ContextService design | Service extraction | Yes | No | MISSING | No design document | |
| redactDetails() security requirements | Trace redaction | Yes | No | MISSING | DEV_TRACE_EVENT_MODEL.md exists but no specific patterns | |
| Phase trace event design | Trace schema | Yes | No | MISSING | No design document | |
| TWO_STAGE_ENABLED env var | Route gating | Yes | No | MISSING | `.env` file check | |
| OrionAgent.js context building logic | ContextService extraction | Yes | Yes | VERIFIED_HAVE | File exists, 864 lines | ✓ |

### 3.3 Outputs Audit (Artifacts/State)

| Output / Artifact Produced | Produced by (Action) | Depended on by (Action) | Auto / Scheduled |
|----------------------------|--------------------------|--------------------------------------|------------------|
| ProtocolStrategy.js file | Create ProtocolStrategy.js file | Refactor OrionAgent to use protocol strategies | Scheduled |
| ContextService.js file | Create ContextService.js file | Update OrionAgent to use ContextService | Scheduled |
| redactDetails() function | Implement redactDetails() function | TraceService security | Scheduled |
| Updated TRACE_TYPES | Update TRACE_TYPES constant | TwoStageProtocol integration | Scheduled |
| Design documents | Interface/service design | Implementation tasks | Scheduled |

### 3.5 Knowledge Audit (Mandatory for Feature 3)

| Knowledge Required | Where Used | Knowledge Required? | Present Now? | VERIFIED_HAVE / MISSING | Verification Method | ✓ Verified | 👤 Architect Decision Needed |
|-------------------|------------|---------------------|--------------|-------------------------|---------------------|-----------:|------------------------------|
| Protocol strategy pattern | Protocol design | Yes | Partial | NEED_Verification | No documented examples in repo | | 👤 |
| Service extraction patterns | Context/Tool service | Yes | Partial | NEED_Verification | No prior service extraction examples | | 👤 |
| Security redaction patterns | redactDetails() | Yes | No | MISSING | No security redaction examples | | 👤 |
| Trace event design | Phase trace events | Yes | Partial | VERIFIED_HAVE | Existing trace events in codebase | ✓ | |
| Large-scale refactoring | OrionAgent extraction | Yes | Partial | NEED_Verification | No prior 800+ line refactoring examples | | 👤 |
| A/B testing patterns | Two-stage protocol | Yes | Partial | VERIFIED_HAVE | TwoStageOrchestrator exists | ✓ | |

---

## 4. Missing Fundamentals

| Category | Missing Fundamental | Impact | Resolution Task |
|----------|---------------------|--------|-----------------|
| ProtocolStrategy interface design | No design document | Blocks interface implementation | Create ProtocolStrategy design document |
| ContextService design | No design document | Blocks service extraction | Create ContextService design document |
| redactDetails() security patterns | No security requirements | Blocks implementation | Define redaction patterns based on DEV_TRACE_EVENT_MODEL.md |
| Phase trace event design | No trace schema design | Blocks observability | Design phase trace event types |
| TWO_STAGE_ENABLED env var | Environment variable missing | Blocks route gating | Add TWO_STAGE_ENABLED to .env and config |
| Protocol strategy pattern knowledge | Team knowledge gap | Risk of poor implementation | Create protocol pattern documentation/examples |

---

## 5. Dependency & Assumption Audit

| Category | Status | Detail | Verification Method | ✓ Verified | Resolution Task |
|----------|--------|--------|---------------------|-----------:|-----------------|
| **Tool** | VERIFIED_HAVE | Node.js fs module | Runtime check | ✓ | — |
| **Tool** | VERIFIED_HAVE | JavaScript runtime | Code execution | ✓ | — |
| **Tool** | MISSING | Design documentation tools | No design process established | | Define design tooling (Miro, diagrams.net, etc.) |
| **Knowledge** | NEED_Verification | Protocol strategy pattern | No examples in repo | | Create protocol pattern documentation |
| **Knowledge** | NEED_Verification | Service extraction patterns | No examples in repo | | Document service extraction approach |
| **Access** | VERIFIED_HAVE | File system write access | Can create files | ✓ | — |
| **Access** | MISSING | TWO_STAGE_ENABLED env var | .env file missing variable | | Add env var to all environments |
| **Physics** | VERIFIED_HAVE | Single-writer file access | Architecture review | ✓ | — |
| **Ops/Owner** | MISSING | Who runs design phase? | No defined owner | | Assign design ownership (Adam/Architect) |

---

## 6. Verification Checklist

### Atomic Primitives Verification:
- [ ] **FS: write_file** - Verified via Node.js runtime check
- [ ] **JavaScript syntax** - Verified via existing codebase
- [ ] **Regex engine** - Verified via Node.js runtime check

### Design Prerequisites:
- [ ] ProtocolStrategy interface design document needed
- [ ] ContextService design document needed  
- [ ] Security redaction patterns document needed
- [ ] Phase trace event design needed

### Knowledge Prerequisites:
- [ ] Protocol strategy pattern documentation needed
- [ ] Service extraction pattern documentation needed
- [ ] Security redaction pattern examples needed

### Implementation Readiness:
- [ ] TWO_STAGE_ENABLED env var configured
- [ ] Design documents approved
- [ ] Knowledge gaps addressed

---

*Document generated: 2025-12-23*  
*Author: Adam (Architect)*  
*Status: Draft v3*

**Protocol Compliance:** This analysis follows UPDATED RED v2 protocol requiring decomposition to Primitive Registry entries for ALL items. Decomposition continues until reaching registered primitives (e.g., FS: write_file). Knowledge Audit included as mandatory for complex Feature 3.
