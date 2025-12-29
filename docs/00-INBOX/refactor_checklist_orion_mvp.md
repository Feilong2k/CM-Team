# Refactor Checklist: Orion MVP Re-Alignment

**Target:** Align backend with ADR "De-Scoping Two-Stage Protocol from MVP"
**Goal:** Establish StandardProtocol + DeepSeek Reasoner as the primary, default execution path.

## 1. Environment & Configuration
- [X] **Verify Default Config:**
  - Check `backend/.env` (and template) to ensure `TWO_STAGE_ENABLED=false` is set or defaults to false in code.
  - Verify `ORION_MODEL_PROVIDER=DeepSeek` is the preferred default.
- [X] **Config Loader:**
  - Update `backend/src/services/trace/TraceConfig.js` or `server.js` to expose these flags clearly to the app context.
  - Remaining "Config Loader" item is just an __optional cleanup__: a helper (e.g. `getAppConfig()` / `getTraceConfig()`) that centralizes reading `ORION_MODEL_PROVIDER`, `TWO_STAGE_ENABLED`, etc. from `process.env`.


## 2. Adapter Layer (`backend/src/adapters/`)
- [X] **Create `DS_ReasonerAdapter.js`:**
  - Create a new adapter specialized for `deepseek-reasoner`.
  - Accept `temperature` via `sendMessages` options (do not hard-enforce 0.0, as Plan Mode needs ~1.3).
  - Handle `reasoning_content` extraction explicitly.
- [X] **Refactor Factory (`index.js`):**
  - Update `adapters/index.js` to use `DS_ReasonerAdapter` as the *primary* DeepSeek adapter.
  - (Optional) Mark `DS_ChatAdapter.js` as deprecated/fallback (no need to maintain active support for MVP).
- [X] **Consolidate Interfaces:**
  - Ensure `DS_ReasonerAdapter` exposes the standard interface: `{ content, toolCalls, reasoningContent }`.
  ### Tara's Prompt

## 3. Protocol Layer (`backend/src/agents/protocols/`)
- [X] **StandardProtocol as Default:**
  - Ensure `StandardProtocol.js` is robust and handles `reasoning_content` if present (logging it to trace, but not necessarily executing it).
  - Verify it correctly delegates to `ToolRunner` for execution.
- [X] **TwoStageProtocol Gating:**
  - Ensure `TwoStageProtocol.js` is isolated and only instantiated if explicit config/flag requests it.

## 4. Agent Layer (`backend/src/agents/`)
- [x] **OrionAgentV2 Simplification:**
  - Refactor constructor to default to `StandardProtocol` if no protocol is injected.
  - Remove complex "auto-switch" logic that might accidentally trigger Two-Stage based on prompt keywords.
  - Ensure `process()` and `processStreaming()` methods simply delegate to the active protocol.
- [x] **Temperature / Mode Logic:**
  - Implement dynamic temperature selection in `OrionAgentV2`:
    - **PLAN MODE**: Default `1.3` (DeepSeek "General Conversation").
    - **ACT MODE**: Default `0.0` (DeepSeek "Coding/Tools").
  - Pass this temperature to `StandardProtocol` -> `adapter.sendMessages`.
  - *Future-proof:* Allow `projectConfig` override (e.g. for Creative Writing projects requiring 1.5).

## 5. Tooling Layer (`backend/tools/`)
- [ ] **Registry & Runner:**
  - Confirm `registry.js` exports `DatabaseTool` correctly (as fixed during probes).
  - Confirm `ToolRunner.js` has the instance-method fallback fix.
  - Ensure `DatabaseToolAgentAdapter.js` has all required methods (`create_task`, `delete_subtask`, etc.) implemented and delegating correctly.
  - Make sure delte task and detele feature is coded as well.

## 6. Routes (`backend/src/routes/`)
- [ ] **chatMessages.js:**
  - Verify the `/chat` and `/stream` endpoints initialize `OrionAgentV2` with the correct (Standard) protocol configuration.
  - Ensure trace logging in the route captures the `reasoning_content` if available from the agent/adapter.
- [ ] **Trace Persistence:**
  - Explicitly map `reasoning_content` from the LLM response into the `details` JSONB column of `trace_events`.
  - Ensure `TraceService.js` allows this field (validation) and that the frontend dashboard can eventually read it.

## 7. Testing & Verification
- [ ] **Unit Tests:**
  - Update `orion_agent_v2.spec.js` to test the StandardProtocol path primarily.
  - Ensure `api_chat_messages_two_stage.spec.js` is skipped or marked as "Feature 3" context (don't let it block MVP CI).
- [ ] **Integration Probe:**
  - Create a new "MVP Sanity Probe" script (similar to `probe_db_tools.js`) that instantiates `OrionAgentV2` (not just raw tools) and runs a simple task end-to-end to verify the full stack wiring.

## 8. Cleanup
- [ ] **Legacy Code:**
  - Move unused files from `backend/src` to `backend/archive` if they are truly obsolete (e.g., old `OrionAgent.js` v1 if V2 is fully capable).
  - Update System Prompt and Reference doc if necessary witht he latest tool info.