# F2-T1: LLM Adapter Architecture & Implementation Plan

## Context
Following the completion of F2-T0 (Orion DB Surface v1.1), we are now planning F2-T1: DeepSeek API Integration with Tool-Calling Prompt Templates. This document captures the architectural decisions and implementation plan for creating a modular LLM adapter system.

## Architectural Vision

### 1. Multi-Agent System with Modular LLM Adapters
The system is designed to support multiple specialized agents, each with their own LLM adapter configuration:

- **OrionAgent** (orchestrator): Step generation, context building, tool orchestration
- **AdamAgent** (architect): System design, task breakdowns, specifications  
- **TaraAgent** (tester): Test generation, validation, quality assurance
- **DevonAgent** (developer): Implementation, refactoring, code generation

Each agent can be "plugged in" with their own specialized LLM adapters, allowing different agents to use different LLM providers based on their specific needs.

### 2. Two-Layer Adapter Architecture

#### Layer 1: LLM Adapter Interface (Abstract)
- **Purpose**: Define a consistent interface for all LLM providers
- **Location**: `backend/src/adapters/LLMAdapter.js`
- **Responsibilities**:
  - Raw API communication
  - Response parsing and normalization
  - Tool call extraction
  - Error handling and retry logic
  - Rate limiting and token counting
  - Usage statistics collection

#### Layer 2: Provider-Specific Adapters (Concrete Implementations)
- **DS_ChatAdapter**: DeepSeek API implementation (first priority)
- **Future Adapters**: OpenAIAdapter, AnthropicAdapter, LocalModelAdapter, etc.
- **Configuration**: One adapter per model/API provider
- **Environment Variables**: Each adapter reads its own API keys (e.g., `DEEPSEEK_API_KEY`)

### 3. Integration with Existing System

#### Database Integration
- **API Call Logging**: New `api_call_logs` table (not for MVP, but designed for future)
- **Existing Tables**: Use `chat_messages` for conversation history
- **DatabaseTool.js**: Leverage existing DB operations for logging

#### Chat System Integration
- **Existing**: `backend/src/routes/chatMessages.js` provides message persistence
- **New**: OrionAgent will use chat history for context building

#### Configuration
- **MVP**: Environment variables only
- **Future**: Database configuration for multiple API keys, load balancing

## Technical Specifications

### LLM Adapter Interface
```javascript
// LLMAdapter Interface (backend/src/adapters/LLMAdapter.js)
class LLMAdapter {
  async sendMessage(prompt, options) {
    // Makes API call, handles retries, rate limiting
    // Returns: { content: string, toolCalls: array, metadata: object }
  }
  
  async parseResponse(rawResponse) {
    // Extracts content, tool calls, metadata from provider-specific format
  }
  
  async handleToolCalls(toolCalls, context) {
    // Executes or routes tool calls (delegates to appropriate handlers)
  }
  
  async getUsageStats() {
    // Returns: { tokensUsed: number, cost: number, latency: number }
  }
  
  // Common configuration
  getMaxTokens() { return 32000; } // DeepSeek limit
  getSupportedTools() { return []; } // Tool definitions
}
```

### DS_ChatAdapter (DeepSeek Implementation)
```javascript
// DS_ChatAdapter (backend/src/adapters/DS_ChatAdapter.js)
class DS_ChatAdapter extends LLMAdapter {
  constructor() {
    super();
    this.apiKey = process.env.DEEPSEEK_API_KEY;
    this.baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  }
  
  async sendMessage(prompt, options) {
    // DeepSeek-specific API call implementation
    // Includes retry logic, error handling, rate limiting
  }
  
  async parseResponse(rawResponse) {
    // DeepSeek-specific response parsing
    // Extracts tool calls from DeepSeek's format
  }
}
```

### File Structure
```
backend/src/
├── adapters/
│   ├── LLMAdapter.js (interface)
│   ├── DS_ChatAdapter.js (DeepSeek implementation)
│   └── (future: OpenAIAdapter.js, etc.)
├── agents/
│   ├── BaseAgent.js (common functionality)
│   ├── OrionAgent.js (orchestrator - to be created/refactored)
│   └── (future: AdamAgent.js, TaraAgent.js, DevonAgent.js)
├── middleware/
│   └── tokenCounter.js (to be created)
├── prompts/
│   ├── deepseek-plan.mustache (to be created)
│   └── deepseek-act.mustache (to be created)
└── services/
    └── APILoggingService.js (future - for api_call_logs)
```

## Implementation Phases

### Phase 1: Foundation (F2-T1-S1)
1. **Create adapter directory structure**: `backend/src/adapters/`
2. **Implement LLMAdapter interface**: Abstract base class
3. **Create DS_ChatAdapter**: Minimal DeepSeek API integration
4. **Add environment validation**: Check `DEEPSEEK_API_KEY` on startup

### Phase 2: OrionAgent Integration (F2-T1-S2)
1. **Create agents directory**: `backend/src/agents/`
2. **Implement OrionAgent**: Refactor or create new using DS_ChatAdapter
3. **Integrate with chat system**: Use existing `chatMessages.js` routes
4. **Add basic error handling**: Retry logic, user-friendly errors

### Phase 3: Enhanced Features (F2-T1-S3)
1. **Implement token counting**: Middleware for token limits
2. **Create prompt templates**: Plan/act mode templates per F2-T0-S4 decisions
3. **Add tool calling support**: At adapter level (deferred to post-MVP if needed)
4. **Basic API logging**: Simple console logging (full DB logging deferred)

## Decisions Locked

### From F2-T0-S4-S5-S6 Decision Record:
1. **Prompt Templates**: Single template for all interactions in MVP
2. **Context Policies**: Fixed defaults with 32K token limit (30K with buffer)
3. **Error Handling**: Automatic retry ×2 + user notification with "Retry" button
4. **Session Handling**: Global chat history (single session for all users)

### New Decisions for F2-T1:
1. **Adapter Pattern**: Two-layer architecture (interface + implementations)
2. **One Model = One Adapter**: Each LLM provider gets its own adapter class
3. **Environment Variables**: API keys configured via .env for MVP
4. **API Logging**: Deferred to post-MVP (no `api_call_logs` table in MVP)
5. **Multi-Agent Ready**: Architecture supports future AdamAgent, TaraAgent, DevonAgent

## Dependencies

### Required for Phase 1:
- DeepSeek API account and API key
- Node.js environment with fetch/axios support
- Existing database connection (for future logging)

### Builds Upon:
- F2-T0 completed (Orion DB Surface v1.1)
- DatabaseTool.js for DB operations
- Existing chat message persistence

## Next Steps

### Immediate (F2-T1-S1):
1. Create `backend/src/adapters/` directory
2. Implement `LLMAdapter.js` interface
3. Implement `DS_ChatAdapter.js` with basic API calls
4. Add environment variable validation

### After Review:
1. Create detailed subtask breakdown for Devon/Tara
2. Run RED analysis on adapter implementation
3. Define acceptance criteria for each phase

## Open Questions for Future Consideration
1. Should adapters support streaming responses?
2. How to handle model-specific prompt optimizations?
3. Configuration management for multiple environments (dev/test/prod)?
4. Circuit breaker pattern for API failure scenarios?

---
**Document Created**: 2025-12-19  
**Author**: Adam (Architect)  
**Based On**: Architecture discussion with project lead  
**Status**: Ready for review
