# Modular Agent Architecture for Multi-Agent System

**Date**: 2025-12-23  
**Author**: Adam (Architect)  
**Status**: Proposal  
**Version**: 1.0

## 1. Executive Summary

This document proposes a modular architecture that extracts reusable components from OrionAgent to create a foundation for multiple specialized agents (OrionAgent, AdamAgent, TaraAgent, DevonAgent). The goal is to create a shared service layer that all agents can use, reducing code duplication and enabling consistent behavior across the agent ecosystem.

## 2. Current OrionAgent Analysis (864 lines)

### 2.1 Functional Components Identified

| Component | Lines | Description | Reusability |
|-----------|-------|-------------|-------------|
| **Context Building** | ~150 | `buildContext()`, `formatSystemPrompt()`, `formatChatHistory()` | High - All agents need context |
| **Tool Handling** | ~100 | Tool merging, validation, execution coordination | High - All agents use tools |
| **Request Preparation** | ~50 | `_prepareRequest()` - orchestrates context + message formatting | Medium - Agent-specific variations |
| **Protocol Execution** | ~300 | `processStreaming()` with loop logic, plan mode enforcement | Medium - Protocol-specific |
| **Plan Mode Logic** | ~100 | `PLAN_MODE_WHITELIST`, filtering functions | High - All agents need mode awareness |
| **Error Handling** | ~50 | `logError()` and error recovery | High - All agents need error handling |
| **Utility Functions** | ~100 | `safeToolName()`, merging functions, etc. | High - Shared utilities |
| **Agent-Specific** | ~14 | Orion-specific prompt loading, DB integration | Low - Orion-specific |

### 2.2 Reusability Assessment

**Highly Reusable (60% of code)**:
- Context building and prompt formatting
- Tool merging and validation  
- Error handling and logging
- Plan mode whitelist and filtering
- Utility functions

**Moderately Reusable (30% of code)**:
- Protocol execution logic (varies by agent role)
- Request preparation (some agent-specific variations)

**Agent-Specific (10% of code)**:
- Prompt content and loading
- Role-specific behavior
- Specialized tool usage patterns

## 3. Proposed Modular Architecture

### 3.1 Service Layer Design

```
backend/src/services/agents/
├── ContextService.js           # Context building, prompt formatting
├── ToolService.js              # Tool merging, validation, execution
├── ProtocolService.js          # Protocol strategies (standard, two-stage)
├── PlanModeService.js          # Mode whitelists and filtering
├── ErrorService.js             # Error logging and recovery
└── AgentFactory.js             # Agent creation with dependency injection
```

### 3.2 Agent Layer Design

```
backend/src/agents/
├── BaseAgent.js                # Core agent interface (unchanged)
├── OrionAgent.js               # ~150 lines (orchestrator role)
├── AdamAgent.js                # ~150 lines (architect role)
├── TaraAgent.js                # ~150 lines (tester role)
├── DevonAgent.js               # ~150 lines (developer role)
└── protocols/                  # Protocol implementations
    ├── ProtocolStrategy.js     # Interface
    ├── StandardProtocol.js     # Current loop logic
    └── TwoStageProtocol.js     # Two-stage A/B cycling
```

### 3.3 Service Implementations

#### **ContextService.js** (~200 lines)
```javascript
class ContextService {
  constructor(db, promptLoader) {
    this.db = db;
    this.promptLoader = promptLoader;
  }
  
  async buildContext(projectId, options = {}) {
    // Load chat history, file list, system state
    // Reusable across all agents
  }
  
  formatSystemPrompt(context, mode, agentRole) {
    // Format prompt with agent-specific instructions
  }
  
  formatChatHistory(chatHistory) {
    // Convert DB messages to model format
  }
}
```

#### **ToolService.js** (~150 lines)
```javascript
class ToolService {
  constructor(toolRegistry) {
    this.toolRegistry = toolRegistry;
  }
  
  mergeToolCalls(toolCalls) {
    // Merge streaming tool call deltas
  }
  
  validateToolCall(toolCall, mode, agentRole) {
    // Check if tool is allowed for agent+mode
  }
  
  async executeToolCalls(toolCalls, context) {
    // Coordinate with ToolRunner
  }
  
  formatToolResult(result) {
    // Format tool result as boxed text
  }
}
```

#### **PlanModeService.js** (~100 lines)
```javascript
class PlanModeService {
  constructor() {
    this.whitelists = {
      Orion: [...],    // Orion's whitelist
      Adam: [...],     // Adam's whitelist (different tools)
      Tara: [...],     // Tara's whitelist
      Devon: [...]     // Devon's whitelist
    };
  }
  
  isToolAllowed(toolName, mode, agentRole) {
    // Check against agent-specific whitelist
  }
  
  filterToolCalls(toolCalls, mode, agentRole) {
    // Separate allowed vs blocked
  }
}
```

## 4. Agent Specializations

### 4.1 OrionAgent (Orchestrator)
- **Role**: General orchestration, project management
- **Tools**: Full tool access in ACT mode, read-only in PLAN mode
- **Protocols**: Standard and Two-Stage
- **Prompt**: General system prompt with file context

### 4.2 AdamAgent (Architect)
- **Role**: System design, task breakdown, architecture
- **Tools**: Design tools, schema analysis, dependency mapping
- **Protocols**: Analysis-focused (maybe different protocol)
- **Prompt**: Architecture-focused, pattern recognition

### 4.3 TaraAgent (Tester)
- **Role**: Testing, validation, quality assurance
- **Tools**: Test generation, coverage analysis, bug detection
- **Protocols**: Validation-focused (test-then-fix cycles)
- **Prompt**: Testing methodology, edge case focus

### 4.4 DevonAgent (Developer)
- **Role**: Implementation, coding, refactoring
- **Tools**: Code generation, refactoring, debugging
- **Protocols**: Implementation-focused (code-review cycles)
- **Prompt**: Code quality standards, best practices

## 5. Implementation Phases

### Phase 1: Service Extraction (Week 1-2)
**Goal**: Extract reusable services from OrionAgent

| Task | Description | Output |
|------|-------------|--------|
| **S1.1**: ContextService | Extract `buildContext()`, `formatSystemPrompt()`, `formatChatHistory()` | ContextService.js |
| **S1.2**: ToolService | Extract tool merging, validation, execution logic | ToolService.js |
| **S1.3**: PlanModeService | Extract whitelist and filtering logic | PlanModeService.js |
| **S1.4**: ErrorService | Extract error handling and logging | ErrorService.js |
| **S1.5**: OrionAgent Refactor | Update OrionAgent to use services | OrionAgent.js (~150 lines) |

### Phase 2: Protocol Integration (Week 3)
**Goal**: Integrate two-stage protocol with new service architecture

| Task | Description | Output |
|------|-------------|--------|
| **S2.1**: ProtocolService | Create protocol strategy framework | ProtocolService.js |
| **S2.2**: TwoStageProtocol | Convert TwoStageOrchestrator to protocol | TwoStageProtocol.js |
| **S2.3**: OrionAgent Update | Integrate protocol selection | OrionAgent.js updated |

### Phase 3: Multi-Agent Foundation (Week 4)
**Goal**: Create foundation for additional agents

| Task | Description | Output |
|------|-------------|--------|
| **S3.1**: AgentFactory | Factory for creating agents with services | AgentFactory.js |
| **S3.2**: BaseAgent Enhancement | Add service injection support | BaseAgent.js updated |
| **S3.3**: AdamAgent Skeleton | Create AdamAgent with architect role | AdamAgent.js |
| **S3.4**: Configuration System | Agent-specific configs (prompts, whitelists) | agent-configs/ |

### Phase 4: Specialized Agents (Week 5-6)
**Goal**: Implement specialized agents

| Task | Description | Output |
|------|-------------|--------|
| **S4.1**: AdamAgent Implementation | Architect tools and protocols | AdamAgent.js complete |
| **S4.2**: TaraAgent Implementation | Tester tools and protocols | TaraAgent.js |
| **S4.3**: DevonAgent Implementation | Developer tools and protocols | DevonAgent.js |
| **S4.4**: Routing System | Route requests to appropriate agent | agent-router.js |

## 6. Benefits

### 6.1 Code Quality
- **Reduced Duplication**: Services shared across agents
- **Improved Testability**: Services can be unit tested independently
- **Clean Separation**: Each service has single responsibility

### 6.2 Maintainability
- **Easier Updates**: Update service once, all agents benefit
- **Consistent Behavior**: All agents use same context building, error handling
- **Modular Design**: Can swap services without affecting agents

### 6.3 Extensibility
- **New Agents**: Create new agents with minimal code
- **New Protocols**: Add protocols without modifying agents
- **New Services**: Add capabilities (e.g., caching, monitoring)

### 6.4 Team Productivity
- **Parallel Development**: Different team members can work on different agents
- **Clear Boundaries**: Well-defined interfaces between components
- **Reusable Patterns**: Patterns established for OrionAgent apply to others

## 7. Technical Details

### 7.1 Dependencies

```javascript
// Agent creation with dependency injection
const OrionAgent = AgentFactory.createAgent('orion', {
  adapter: dsAdapter,
  tools: toolRegistry,
  services: {
    context: contextService,
    tool: toolService,
    protocol: protocolService,
    planMode: planModeService,
    error: errorService
  }
});
```

### 7.2 Configuration

```javascript
// agent-configs/orion.json
{
  "role": "orion",
  "promptPath": ".Docs/Prompts/SystemPrompt_Orion.md",
  "whitelist": {
    "plan": ["read_file", "list_files", ...],
    "act": "*" // All tools
  },
  "defaultProtocol": "standard",
  "supportedProtocols": ["standard", "two-stage"]
}
```

### 7.3 Routing

```javascript
// agent-router.js
function routeToAgent(projectId, userMessage, options) {
  const intent = analyzeIntent(userMessage);
  
  switch(intent) {
    case 'design':
    case 'architecture':
      return AdamAgent;
    case 'test':
    case 'validate':
      return TaraAgent;
    case 'implement':
    case 'code':
      return DevonAgent;
    default:
      return OrionAgent; // Default orchestrator
  }
}
```

## 8. Migration Strategy

### 8.1 Incremental Migration
1. **Phase 1**: Extract services, keep OrionAgent working
2. **Phase 2**: Test services independently
3. **Phase 3**: Update OrionAgent to use services
4. **Phase 4**: Verify all tests pass
5. **Phase 5**: Deploy updated OrionAgent
6. **Phase 6**: Begin creating new agents

### 8.2 Risk Mitigation
- **Backward Compatibility**: OrionAgent maintains same API
- **Feature Flags**: New agents behind feature flags initially
- **A/B Testing**: Compare OrionAgent vs specialized agents
- **Rollback Plan**: Revert to monolithic OrionAgent if issues

## 9. Success Metrics

### 9.1 Code Metrics
- **OrionAgent Lines**: Reduced from 864 to ~150
- **Service Reuse**: >60% code shared across agents
- **Test Coverage**: Maintain >80% coverage

### 9.2 Performance Metrics
- **Response Time**: No degradation vs current OrionAgent
- **Memory Usage**: Similar or better with shared services
- **Scalability**: Support multiple concurrent agents

### 9.3 Quality Metrics
- **Bug Rate**: Reduced due to shared, tested services
- **Development Velocity**: Faster agent creation
- **Team Satisfaction**: Clearer architecture, less duplication

## 10. Next Steps

### Immediate (Next 24 hours)
1. **Review this architecture** with team
2. **Prioritize Phase 1** (service extraction)
3. **Begin with S1.1**: Extract ContextService

### Short Term (Week 1-2)
1. Complete Phase 1 service extraction
2. Test services independently
3. Update OrionAgent to use services

### Medium Term (Week 3-6)
1. Complete Phases 2-4
2. Deploy updated OrionAgent
3. Begin specialized agent development

## 11. Appendix

### 11.1 Service Interface Examples

```javascript
// ContextService Interface
interface IContextService {
  buildContext(projectId, options): Promise<Context>;
  formatSystemPrompt(context, mode, agentRole): string;
  formatChatHistory(chatHistory): Message[];
}

// ToolService Interface  
interface IToolService {
  mergeToolCalls(toolCalls): ToolCall[];
  validateToolCall(toolCall, mode, agentRole): boolean;
  executeToolCalls(toolCalls, context): Promise<ToolResult[]>;
  formatToolResult(result): string;
}
```

### 11.2 Agent Interface

```javascript
// Base Agent Interface
class BaseAgent {
  constructor(adapter, tools, services, config) {
    this.adapter = adapter;
    this.tools = tools;
    this.services = services;
    this.config = config;
  }
  
  async *processStreaming(projectId, userMessage, options) {
    // Use services to handle request
    const context = await this.services.context.buildContext(projectId, options);
    const messages = this.services.context.formatMessages(context, userMessage);
    
    // Delegate to protocol
    yield* this.services.protocol.execute(
      messages, 
      this.tools, 
      { ...options, agentRole: this.config.role }
    );
  }
}
```

### 11.3 References
- [Current OrionAgent](backend/src/agents/OrionAgent.js)
- [Two-Stage Protocol Architecture](docs/design/two_stage_protocol_strategy_architecture.md)
- [BaseAgent Implementation](backend/src/agents/BaseAgent.js)

---

*Document generated: 2025-12-23*  
*Based on analysis of OrionAgent.js and multi-agent requirements*
