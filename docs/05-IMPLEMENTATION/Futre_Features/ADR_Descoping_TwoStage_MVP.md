# ADR: De-Scoping Two-Stage Protocol from MVP

**Date:** 2025-12-27
**Status:** Accepted
**Driver:** Architectural Simplification for MVP

## Context

The system currently includes a `TwoStageProtocol` implementation designed to split agent execution into two distinct phases:
1.  **Phase 1 (Planning):** Analysis, information gathering, and artifact generation (e.g., JSON plans).
2.  **Phase 2 (Execution):** Constrained execution against the approved plan.

This protocol was initially considered a core requirement for the Minimum Viable Product (MVP) to ensure safety and structure.

However, recent probes and architectural reviews have highlighted two key factors:
1.  **DeepSeek Reasoner Capabilities:** The DeepSeek Reasoner model (R1) natively provides a "think-before-act" capability (`reasoning_content`) within a single turn. This effectively implements a "micro-two-stage" process (reasoning → tool call) at the model level, reducing the immediate need for a heavyweight protocol to enforce basic reasoning.
2.  **Complexity Overhead:** Wiring the Two-Stage Protocol into the MVP introduces significant complexity:
    - Dynamic protocol selection logic in `OrionAgentV2`.
    - Expanded `TraceService` event schemas (Phase start/end, state transitions).
    - Additional Tara test vectors and potential failure modes.
    - Integration friction with external tools (e.g., Aider delegation).

## Decision

We will **de-scope the Two-Stage Protocol from the MVP requirements**.

The MVP architecture will officially adopt the following baseline:

1.  **Primary Protocol:** **StandardProtocol** (single-phase execution).
    - This will be the default, always-on protocol for Orion.
    - It simplifies the control loop: Request → LLM → Tool → Response.
2.  **Primary Model:** **DeepSeek Reasoner**.
    - We rely on the model's native `reasoning_content` to provide the necessary "planning" and transparency for MVP tasks.
    - Prompts will remain structured (e.g., "THINK then ACT") to guide the model, but without the rigid state machine of `TwoStageProtocol`.
3.  **Two-Stage Protocol Status:**
    - The code for `TwoStageProtocol` will remain in the codebase but will be treated as **experimental / Feature 3 scope**.
    - It will be gated behind configuration flags (e.g., `TWO_STAGE_ENABLED=false` by default).
    - It is **not** a blocker for MVP release or acceptance criteria.

## Consequences

### Positive
- **Reduced Complexity:** Simplifies `OrionAgentV2`, routing logic, and debugging paths for the MVP release.
- **Faster Iteration:** Focus can shift to stabilizing `StandardProtocol`, `ToolRunner`, and core tools (FS/DB) without worrying about multi-phase state management.
- **Clearer Testing:** Tara tests for MVP can focus on "Task → Success" rather than "Task → Phase 1 → Approval → Phase 2 → Success".

### Negative
- **Reduced Global Guardrails:** Without Two-Stage, we lose the strict "plan-first" enforcement at the system level. We rely more on the model's discipline and prompt engineering.
- **Artifact Generation:** We must ensure `StandardProtocol` prompts still encourage generating necessary artifacts (like plan files) during execution, even without a formal phase for it.

## Roadmap Alignment

- **Feature 2 (MVP):** StandardProtocol + DeepSeek Reasoner.
- **Feature 3 (Future):** Two-Stage Protocol & Service Foundation.
    - Will re-introduce Two-Stage for complex, high-risk, or multi-agent workflows where explicit phase separation provides critical value (e.g., extensive refactoring, security-sensitive ops).
