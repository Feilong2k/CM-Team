# ProtocolStrategy Interface Design - Questions for Decision

**Date:** 2025-12-24  
**Author:** Adam (Architect)  
**Context:** Task 3-0-1 (P1-F3-T0-S1) - Create ProtocolStrategy interface design document  
**Status:** Awaiting User Input

## Key Design Questions

### 1. **Design Philosophy**
- Should we follow **Option 1: Simple Plug-in** (recommended), **Option 2: Full Lifecycle Control**, or **Option 3: Configuration-Driven**?
- Which option aligns best with your vision for the system?

**RESPONSE:** Given your vision of the staged protocol becoming the default way for LLMs to call tools (preventing spam and ensuring action on results), **Option 1: Simple Plug-in** is best for the long run. It's minimal, easy to understand, and allows us to evolve the protocol without over-engineering. We can start simple and add complexity only when needed.

**RECOMMENDATION:** Option 1 (Simple Plug-in) - A single `execute()` method that handles the entire protocol. This aligns with making two-stage the default protocol in the future.
  NOTE: ok let's do option 1
  
**RESPONSE:** Confirmed. We'll proceed with **Option 1: Simple Plug-in** design. The ProtocolStrategy will have a single `execute()` method that handles the entire two-stage protocol lifecycle.

### 2. **Compatibility & Constraints**
- Should the ProtocolStrategy work with existing `TwoStageOrchestrator` and `OrionAgent` without breaking changes?

**RESPONSE:** Yes, the ProtocolStrategy must work with both without breaking changes. Feature 3's purpose is to create a production-ready two-stage protocol foundation with modular services. We're moving towards modular setup to:
1. Eliminate duplication between OrionAgent and TwoStageOrchestrator <- you have the answer right here
2. Enable code reuse via shared services (ContextService, ToolService)
3. Create a foundation for future specialized agents (Adam, Tara, Devon)
4. Make the two-stage protocol the default, robust way of tool execution
  NOTE: Wrong answer, the purpose was for OrionAgent to be able to use the staged Protocol and the normal one, TwoStageOrchestrator will not exist once this is setup, so it only needs to work with OrionAgent, not both
  
**RESPONSE TO NOTE:** You're absolutely right. Thank you for the correction. The ProtocolStrategy should work **only with OrionAgent**. TwoStageOrchestrator will be deprecated/removed as part of Feature 3 implementation. The goal is to make OrionAgent protocol-agnostic, able to use either standard or two-stage protocol via the Strategy pattern.


- Are there any non-negotiable principles?

**RESPONSE:** Based on your notes:
1. **Must support A/B cycling** - Core of two-stage protocol
2. **Must prevent tool call spam** - Primary goal of staged execution
3. **Must ensure consistent action on results** - LLM must act on tool results
4. **Must be testable in isolation** - For Tara's testing
5. **Must be backward compatible** - Existing routes should keep working
NOTES: confirmed

**RESPONSE TO NOTE:** Confirmed. All 5 non-negotiable principles are accepted and will be incorporated into the ProtocolStrategy design.


### 3. **Dependency Injection**
- Do you prefer **constructor-based injection** (passing services in constructor) or **factory pattern**?

**RESPONSE:** 
- **Constructor-based injection**: Pass dependencies directly in constructor. Example: `new TwoStageProtocol(contextService, toolService)`
- **Factory pattern**: A factory creates instances with dependencies. Example: `ProtocolFactory.create('two-stage', services)`

**Current usage**: We don't have a formal pattern yet. OrionAgent creates its own dependencies internally.

**Recommendation**: **Constructor-based injection** because:
1. Simpler to understand and implement
2. Clear dependency declaration in constructor
3. Easier testing (can pass mocks directly)
4. No need for complex factory setup initially
5. We can add a factory later if needed for multi-agent routing
  NOTE: what is this used for? if this how things like toolservice interacts with OrionAgent? as long as the recommendation can act consistently won't break anything i am fine wiht your recommendation

**RESPONSE TO NOTE:** Dependency injection is how we pass services (ContextService, ToolService, etc.) **into** the ProtocolStrategy. OrionAgent will create a ProtocolStrategy instance and pass it the services it needs. This allows:
  1. **Testing**: Tara can test ProtocolStrategy in isolation by passing mock services
  2. **Consistency**: Same services used across different protocols
  3. **Maintainability**: Easy to swap implementations
  Since you're fine with constructor-based injection, we'll use that approach. It won't break existing functionality and will maintain consistency.

- Which shared services should be injectable?

**RESPONSE:** Yes, everything should be injectable - that's the goal of modularity. At minimum:
1. **ContextService** - Context building, chat history loading
2. **ToolService** - Tool execution, merging, validation
3. **TraceService** - Logging and observability
4. **Adapter** (LLM) - For streaming responses

  NOTE: confirmed
  
**RESPONSE TO NOTE:** Confirmed. All 4 services (ContextService, ToolService, TraceService, Adapter) will be injectable into the ProtocolStrategy.

### 4. **Lifecycle Hooks**
- Which lifecycle hooks are mandatory?

**RESPONSE:** Lifecycle hooks are methods that get called at specific points in the protocol execution. For our two-stage protocol:

**Recommendation**: **No mandatory hooks initially** - Keep it simple (Option 1 philosophy). The protocol should handle its own lifecycle internally.

**Why**: The two-stage protocol already has built-in phases (Action Phase, Tool Phase). Adding external hooks would complicate the simple plug-in approach. Error handling should be internal to the protocol.

**If needed later**: We can add optional hooks, but start without them.

**Alternative approach**: If we need observability, use **TraceService events** instead of hooks:
- `phase_start`, `phase_end`, `tool_executed`, `error_occurred`
  NOTE: can hooks be used to improve on the interactinos with LLMs? like reduce spam tool calling or improve LLM's reaction to results? if yes, then we should put it in, if not then no.

**RESPONSE TO NOTE:** Excellent question. **Hooks cannot directly improve LLM interactions** for spam reduction or result handling - those are core protocol responsibilities. Hooks would allow external code to observe/participate in protocol execution (e.g., logging, metrics, validation). 

**Recommendation:** No hooks initially because:
1. The two-stage protocol already handles spam prevention internally (via A/B cycling)
2. LLM result handling is built into the protocol phases
3. We can add hooks later if needed for observability
4. TraceService events provide sufficient observability without hooks

### 5. **Protocol Selection**
- How should Orion choose which protocol to use?

**RESPONSE:** Based on your note: **Environment variable `TWO_STAGE_ENABLED=true/false`**
  NOTE: confirmed

**Implementation**:
1. Keep current `/api/chat/messages` route
2. If `TWO_STAGE_ENABLED=true`, use TwoStageProtocol
3. If `TWO_STAGE_ENABLED=false` or not set, use StandardProtocol
4. Eventually, remove the flag and make TwoStageProtocol the only protocol

**Rationale**:
- Simple configuration
- No UI changes needed
- Gradual rollout capability
- Eventually becomes the default (no choice)

**RESPONSE TO NOTE:** Confirmed. We'll use environment variable `TWO_STAGE_ENABLED=true/false` for protocol selection, with the eventual goal of making TwoStageProtocol the only protocol.

### 6. **Common Code Extraction**
- Should we extract common code (like context building) into a shared **ContextService**?

**RESPONSE:** Yes, this is Task 3.2 (ContextService Implementation). The answer is **Yes** - we should extract common code.

**Consideration of all Feature 3 tasks**:
- **Task 3.1**: Protocol strategy implementation (this design)
- **Task 3.2**: ContextService extraction (shared context building)
- **Task 3.3**: ToolService extraction (shared tool execution)
- **Task 3.4**: Security & configuration
- **Task 3.5**: Observability & stabilization

**Conclusion**: Extraction is necessary to eliminate duplication between OrionAgent and TwoStageOrchestrator, which is the core problem Feature 3 solves.

### 7. **Output Location**
- Where should the design document go?

**RESPONSE:** 
1. **Current**: `docs/00-INBOX/2025-12-24_ProtocolStrategy_Design_Questions.md` (this file, for clarification)
2. **After approval**: `docs/02-ARCHITECTURE/designs/3-0/ProtocolStrategy_interface.md`

**New folder structure**:
- `docs/02-ARCHITECTURE/designs/3-0/` - All Feature 3 design documents
- `docs/02-ARCHITECTURE/designs/3-1/` - Future Feature 3.1 designs, etc.

### 8. **Review Process**
- Who needs to review and approve the design before it's "locked"?

**RESPONSE:** You (the user) review and approve. As Adam (Architect), I create the design, you review and lock it.

- Do you want to see a working example first, or just the design?

**RESPONSE:** Just the design (per your note). I'll create the comprehensive design document based on these answers.

## Next Steps

Once you provide answers to these questions, I'll create the comprehensive design document.

---

**Note:** These questions are based on the RED v3 analysis findings and the need to address knowledge gaps before implementation.

## Summary of Responses

I have now responded to all your notes inline in each section. Here's a summary:

### ✅ All Notes Addressed
1. **Design Philosophy**: Option 1 (Simple Plug-in) confirmed
2. **Compatibility**: ProtocolStrategy works only with OrionAgent (TwoStageOrchestrator will be deprecated)
3. **Dependency Injection**: Constructor-based injection confirmed with explanation of purpose
4. **Injectable Services**: ContextService, ToolService, TraceService, Adapter confirmed
5. **Lifecycle Hooks**: No hooks initially - they don't improve LLM interactions for spam reduction/result handling
6. **Protocol Selection**: Environment variable `TWO_STAGE_ENABLED=true/false` confirmed
7. **Non-negotiable principles**: All 5 principles confirmed

### 🔍 Response Method
- Your original notes are preserved in each section
- My responses are added directly below each note as `**RESPONSE TO NOTE:**` 
- No content was deleted - only additions made

## Next Steps

With all notes addressed, I'm ready to create the comprehensive ProtocolStrategy interface design document at `docs/02-ARCHITECTURE/designs/3-0/ProtocolStrategy_interface.md`.

**Should I proceed with creating the design document?**
