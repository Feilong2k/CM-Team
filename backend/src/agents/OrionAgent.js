const BaseAgent = require('./BaseAgent');
const path = require('path');
const fs = require('fs');
const { listFiles } = require('../../tools/list_files');
const functionDefinitions = require('../../tools/functionDefinitions');
const TraceService = require('../services/trace/TraceService');
const { TRACE_TYPES, TRACE_SOURCES } = require('../services/trace/TraceEvent');
const { logDuplicationProbe } = require('../services/trace/DuplicationProbeLogger');

function computeContentHash(content) {
  let hash = 0;
  if (!content) return hash;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  // Force unsigned 32-bit for readability
  return hash >>> 0;
}

function safeToolName(call) {
  // Tool call shapes vary by provider and by streaming partials.
  // We only accept fully-formed OpenAI-style: { function: { name: string, arguments: string } }
  if (!call || typeof call !== 'object') return null;
  const fn = call.function;
  if (!fn || typeof fn !== 'object') return null;
  if (typeof fn.name !== 'string' || fn.name.trim() === '') return null;
  return fn.name;
}

/**
 * OrionAgent - The orchestrator agent that extends BaseAgent.
 * Handles context building, logging, and conversation management.
 */
class OrionAgent extends BaseAgent {
  constructor(adapter, tools, promptPath = null) {
    super(adapter, tools, 'Orion');

    if (tools && tools.DatabaseToolInternal) {
      this.db = tools.DatabaseToolInternal;
    } else if (tools && tools.DatabaseTool) {
      this.db = tools.DatabaseTool;
    } else {
      this.db = tools;
    }

    const defaultPromptPath = path.join(__dirname, '../../../.Docs/Prompts/SystemPrompt_Orion.md');
    this.promptPath = promptPath || defaultPromptPath;

    try {
      this.promptContent = fs.readFileSync(this.promptPath, 'utf8');
      this.promptFile = path.basename(this.promptPath);
    } catch (error) {
      console.error(`Failed to load Orion prompt from ${this.promptPath}:`, error);
      this.promptContent = '# Orion Orchestrator\n\nDefault prompt content not loaded.';
      this.promptFile = 'default.md';
    }
  }

  /**
   * Build context for a project
   * @param {string} projectId - Project ID
   * @param {string} [taskId] - Optional task ID
   * @returns {Promise<Object>} Context object with chat history and system state
   */
  async buildContext(projectId, taskId = null) {
    const context = {
      projectId,
      taskId,
      chatHistory: [],
      systemState: {
        prompt: {
          file: this.promptFile,
          path: this.promptPath,
          loadedAt: this.promptContent ? new Date().toISOString() : null
        },
        files: [] // List of available files
      },
      timestamp: new Date().toISOString()
    };

    try {
      // Get last 20 chat messages for the project
      if (this.db.chatMessages && typeof this.db.chatMessages.getMessages === 'function') {
        context.chatHistory = await this.db.chatMessages.getMessages(projectId, 20);
      } else {
        console.warn('chatMessages.getMessages not available, using empty chat history');
      }

      // Get list of available files (context building)
      // Whitelisted directories: src/, backend/, frontend/, .Docs/, package.json, README.md
      // We use listFiles tool logic here. Since we are in the backend, we can import it or use fs directly.
      // For MVP, we'll list top-level relevant directories recursively.
      try {
        const rootDir = process.cwd(); // Assuming we are in project root or backend
        // If cwd is c:\\Coding\\CM-TEAM, then backend is a subdir.

        // Simple recursive list implementation for whitelisted dirs
        const whitelist = ['backend', 'frontend', '.Docs', 'src'];
        const files = [];

        for (const dir of whitelist) {
            const fullPath = path.join(rootDir, dir);
            if (fs.existsSync(fullPath)) {
                const walk = (dirPath) => {
                    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                    for (const entry of entries) {
                        const res = path.resolve(dirPath, entry.name);
                        const relPath = path.relative(rootDir, res);

                        // Ignore node_modules, .git, etc.
                        if (relPath.includes('node_modules') || relPath.includes('.git') || relPath.includes('dist') || relPath.includes('build')) {
                            continue;
                        }

                        if (entry.isDirectory()) {
                            walk(res);
                        } else {
                            files.push(relPath);
                        }
                    }
                };
                walk(fullPath);
            }
        }
        // Also add specific root files
        ['package.json', 'README.md'].forEach(f => {
            if (fs.existsSync(path.join(rootDir, f))) files.push(f);
        });

        context.systemState.files = files;
      } catch (fsError) {
        console.error('Error listing files for context:', fsError);
        context.systemState.files = ['Error listing files'];
      }

      return context;
    } catch (error) {
      console.error('Error building context:', error);
      // Return minimal context on error
      return context;
    }
  }

  /**
   * Prepare a request by storing user message, building context, and formatting messages.
   * This is shared between process and processStreaming.
   * @private
   */
  async _prepareRequest(projectId, userMessage, options = {}) {
    const { mode = 'plan' } = options;

    if (!projectId || !userMessage) {
      throw new Error('projectId and userMessage are required');
    }

    if (mode !== 'plan' && mode !== 'act') {
      throw new Error('mode must be either "plan" or "act"');
    }

    // Store user message
    if (this.db.chatMessages && typeof this.db.chatMessages.addMessage === 'function') {
      await this.db.chatMessages.addMessage(projectId, 'user', userMessage, { mode });
    }

    // Build context and system prompt
    const context = await this.buildContext(projectId);
    const systemPrompt = this.formatSystemPrompt(context, mode);

    // Format messages for the adapter
    // Deduplication check: If the last message in history is identical to the current userMessage,
    // (which happens because we just saved it to DB), we should NOT append it again.
    let formattedHistory = this.formatChatHistory(context.chatHistory);
    const lastMsg = formattedHistory[formattedHistory.length - 1];

    // If history already contains the user message as the last item, don't append it again
    if (lastMsg && lastMsg.role === 'user' && lastMsg.content === userMessage) {
        formattedHistory.pop();
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...formattedHistory,
      { role: 'user', content: userMessage }
    ];

    return { messages, context, mode };
  }

  /**
   * Process a user request with context and tools.
   * @param {string} projectId - Project ID
   * @param {string} userMessage - User's message
   * @param {Object} options - Processing options
   * @param {string} [options.mode='plan'] - 'plan' or 'act' mode
   * @returns {Promise<Object>} Response object with content and metadata
   */
  async process(projectId, userMessage, options = {}) {
    const { mode = 'plan' } = options;

    if (!projectId || !userMessage) {
      throw new Error('projectId and userMessage are required');
    }

    if (mode !== 'plan' && mode !== 'act') {
      throw new Error('mode must be either "plan" or "act"');
    }

    const startTime = Date.now();
    let response;
    let responseContent = '';
    let toolCallResults = [];

    try {
      const { messages, context } = await this._prepareRequest(projectId, userMessage, options);

      let continueLoop = true;
      let iteration = 0;
      const maxIterations = 5;

      while (continueLoop && iteration < maxIterations) {
        iteration++;

        // Filter out any malformed or empty messages before passing to the adapter.
        // DS_ChatAdapter enforces that each message must have both a role and
        // non-empty content; previous empty Orion responses (e.g., from failed
        // tool runs) can otherwise poison subsequent turns.
        const safeMessages = messages
          .filter(m =>
            m &&
            typeof m === 'object' &&
            typeof m.role === 'string' &&
            typeof m.content === 'string' &&
            m.content.trim() !== ''
          )
          .map(m => ({ role: m.role, content: m.content }));

        const adapterResponse = await this.adapter.sendMessages(safeMessages, {
          temperature: mode === 'plan' ? 0.7 : 0.3,
          max_tokens: 8192,
          tools: functionDefinitions
        });

        const { content, toolCalls } = adapterResponse;

        responseContent = content;

        if (toolCalls && toolCalls.length > 0) {
          toolCallResults = await this.handleToolCalls(toolCalls, context);

          for (const result of toolCallResults) {
            const toolLabel = result.toolName || 'tool';
            const resultJson = JSON.stringify(result.result, null, 2);

            // Surface the tool result back to the model in a visually distinct
            // block so it is easy to spot in the prompt and in traces.
            const header = '═══════════════════════════════════════════════════════════════════════════════';
            const titleLine = `TOOL RESULT: ${toolLabel}`;
            const boxed = [
              header,
              titleLine,
              header,
              resultJson,
              header,
            ].join('\n');

            messages.push({
              role: 'system',
              content: boxed,
            });
          }
        } else {
          continueLoop = false;
        }
      }

      if ((!responseContent || responseContent.trim() === '') && toolCallResults && toolCallResults.length > 0) {
        responseContent = toolCallResults
          .map(result => {
            const label = result.toolName || 'tool';
            if (result.success) {
              return `Tool ${label} returned:\n${JSON.stringify(result.result, null, 2)}`;
            }
            return `Tool ${label} failed: ${result.error || 'Unknown error'}`;
          })
          .join('\n\n');
      }

      response = {
        content: responseContent,
        metadata: {
          model: this.getModelName(),
          mode,
          tokens: 0,
          context: {
            chatHistoryCount: context.chatHistory.length,
            hasSystemState: Object.keys(context.systemState).length > 0
          },
          processingTime: Date.now() - startTime
        }
      };
    } catch (error) {
      console.error('OrionAgent process error:', error);
      await this.logError(projectId, error, { userMessage, mode });
      throw new Error(`OrionAgent chat failed: ${error.message}`);
    }

    return response;
  }

  /**
   * Format system prompt with context and mode
   * @param {Object} context - Context object from buildContext
   * @param {string} mode - 'plan' or 'act'
   * @returns {string} Formatted system prompt
   */
  formatSystemPrompt(context, mode) {
    // Add dynamic context header
    const fileList = context.systemState.files.join('\n');
    const header = `## Current Session Context\n
- **Project ID**: ${context.projectId}\n
- **Mode**: ${mode} (${mode === 'plan' ? 'PLAN mode: Focus on analysis, planning, and high-level guidance.' : 'ACT mode: Focus on concrete implementation, code generation, and execution.'})\n
- **Chat History**: ${context.chatHistory.length} previous messages available\n
- **System State**: ${Object.keys(context.systemState).length > 0 ? 'Available' : 'Not available'}\n
- **Current Time**: ${new Date().toISOString()}\n

## Available Context (File List)\n
The following files are available in the project context. You can use 'read_file' to examine them.\n
\`\`\`\n
${fileList.slice(0, 5000)} ${fileList.length > 5000 ? '\n... (truncated)' : ''}\n
\`\`\`\n

`;

    return header + this.promptContent;
  }

  /**
   * Format chat history for model messages
   * @param {Array} chatHistory - Array of chat messages from database
   * @returns {Array} Formatted messages for the model
   */
  formatChatHistory(chatHistory) {
    return chatHistory.map(msg => {
      // Database uses 'sender', but we might have 'role' in some contexts
      const rawRole = msg.role || msg.sender;
      let role = rawRole;

      if (rawRole === 'orion') role = 'assistant';
      // 'user' and 'system' are valid roles

      return {
        role,
        content: msg.content
      };
    });
  }

  /**
   * Log error to database
   * @param {string} projectId - Project ID
   * @param {Error} error - Error object
   * @param {Object} metadata - Additional metadata
   */
  async logError(projectId, error, metadata = {}) {
    try {
      if (this.db.chatMessages && typeof this.db.chatMessages.addMessage === 'function') {
        await this.db.chatMessages.addMessage(projectId, 'system', `Error: ${error.message}`, {
          type: 'error',
          ...metadata,
          stack: error.stack
        });
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  /**
   * Process a user request with context and tools, returning a stream of the response.
   * Now unified for both PLAN and ACT modes.
   *
   * @param {string} projectId - Project ID
   * @param {string} userMessage - User's message
   * @param {Object} options - Processing options
   * @param {string} [options.mode='plan'] - 'plan' or 'act' mode
   * @returns {AsyncGenerator<Object>} Stream of chunks and events
   */
  async *processStreaming(projectId, userMessage, options = {}) {
    const { messages, context, mode } = await this._prepareRequest(projectId, userMessage, options);

    // Accumulate full content as seen by OrionAgent for duplication probes
    // NOTE: kept outside try/finally so we can flush probes even if the stream is cancelled early.
    let fullContentProbe = '';

    const probeProjectId = context.projectId || projectId;
    const probeRequestId = options.requestId;

    // "Start" probe: proves the agent streaming path is being invoked at all.
    logDuplicationProbe('agent_start', {
      projectId: probeProjectId,
      requestId: probeRequestId,
      mode,
      hash: 0,
      length: 0,
      sample: 'agent_start',
    });

    try {
      // Log tool registration snapshot for streaming session
      try {
        await TraceService.logEvent({
          projectId,
          type: 'tool_registration',
          source: 'system',
          timestamp: new Date().toISOString(),
          summary: 'Streaming tool registry for Orion',
          details: { tools: Object.keys(this.tools || {}) },
          requestId: options.requestId,
        });
      } catch (err) {
        console.error('Trace logging failed for tool registration (streaming):', err);
      }

      let iteration = 0;
      const maxIterations = 5;
      let continueLoop = true;

      // Define allowed read-only tools for PLAN mode
      const PLAN_MODE_WHITELIST = [
        'read_file', 'list_files', 'search_files', 'list_code_definition_names',
        'DatabaseTool_get_subtask_full_context',
        'DatabaseTool_list_subtasks_by_status',
        'DatabaseTool_search_subtasks'
      ];

      while (continueLoop && iteration < maxIterations) {
        iteration++;

        // Filter out any malformed or empty messages before passing to the adapter.
        const safeMessages = messages
          .filter(m =>
            m &&
            typeof m === 'object' &&
            typeof m.role === 'string' &&
            typeof m.content === 'string' &&
            m.content.trim() !== ''
          )
          .map(m => ({ role: m.role, content: m.content }));

        const adapterStream = this.adapter.sendMessagesStreaming(safeMessages, {
          temperature: mode === 'plan' ? 0.7 : 0.3,
          max_tokens: 8192,
          tools: functionDefinitions, // Always provide tool definitions, filtering happens at execution time
          context: { projectId, requestId: options.requestId },
        });

        let toolCallsFromStream = [];

        for await (const event of adapterStream) {
          if (event.chunk) {
            fullContentProbe += event.chunk;
          }
          if (event.toolCalls) {
            toolCallsFromStream = event.toolCalls;
          }
          // Yield everything to the frontend (chunks, done, etc.)
          yield event;
        }

        // If we got tool calls, we need to handle them (execute + inject result + loop)
        if (toolCallsFromStream.length > 0) {
          // Filter tools based on mode
          const allowedToolCalls = [];
          const blockedToolCalls = [];

          for (const call of toolCallsFromStream) {
            const toolName = safeToolName(call);
            if (!toolName) {
              // Ignore partial/invalid streamed tool_call entries
              continue;
            }
            // In PLAN mode, check whitelist. In ACT mode, allow all.
            if (mode === 'plan' && !PLAN_MODE_WHITELIST.some(allowed => toolName.startsWith(allowed) || toolName === allowed)) {
               blockedToolCalls.push(call);
            } else {
               allowedToolCalls.push(call);
            }
          }

          // Handle blocked tools (yield a system message to user, do not execute)
          if (blockedToolCalls.length > 0) {
            const blockedMsg = `\n\n**System Notice:** The following tool calls were blocked because they are not allowed in PLAN mode: ${blockedToolCalls.map(c => safeToolName(c)).filter(Boolean).join(', ')}. Switch to ACT mode to execute write operations.`;

            // Yield as a text chunk so user sees it
            yield { chunk: blockedMsg };

            // Add to history so model knows it failed/was blocked
            messages.push({
              role: 'system',
              content: `Refusal: The tool calls [${blockedToolCalls.map(c => safeToolName(c)).filter(Boolean).join(', ')}] were blocked by system policy because the user is in PLAN mode. You must ask the user to switch to ACT mode if these actions are required.`
            });
          }

          // Execute allowed tools
          if (allowedToolCalls.length > 0) {
             // We use handleToolCalls (via ToolRunner) which returns results
             const results = await this.handleToolCalls(allowedToolCalls, context);

             for (const result of results) {
                const toolLabel = result.toolName || 'tool';
                const resultJson = JSON.stringify(result.result, null, 2);

                // Surface the tool result back to the model AND the stream
                const header = '═══════════════════════════════════════════════════════════════════════════════';
                const titleLine = `TOOL RESULT: ${toolLabel}`;
                const boxed = [
                  header,
                  titleLine,
                  header,
                  resultJson,
                  header,
                ].join('\n');

                // 1. Yield to stream so frontend sees it immediately
                // We prepend a newline to ensure separation.
                yield { chunk: `\n\n${boxed}\n\n` };

                // 2. Add to history for next iteration
                messages.push({
                  role: 'system',
                  content: boxed,
                });
             }
          }

          // If we had tool calls (blocked or allowed), we continue the loop to let the model generate the next response based on the results/refusals.
          continueLoop = true;

        } else {
          // No tool calls in this turn, we are done.
          continueLoop = false;
        }
      }

    } finally {
      // Duplication probe: log what OrionAgent saw as full streamed content (by concatenating chunks)
      // This runs even if the client disconnects / stream is cancelled early.
      try {
        const hash = computeContentHash(fullContentProbe);

        try {
          await TraceService.logEvent({
            projectId: probeProjectId,
            type: 'tool_result_stream',
            source: 'orion',
            timestamp: new Date().toISOString(),
            summary: `dup_probe_agent_full_content (mode=${mode})`,
            details: {
              hash,
              length: fullContentProbe.length,
              sample: fullContentProbe.slice(0, 300),
            },
            requestId: probeRequestId,
          });
        } catch (traceErr) {
          console.error('Trace logging failed for dup_probe_agent_full_content:', traceErr);
        }

        // Always write agent probe to disk
        logDuplicationProbe('agent', {
          projectId: probeProjectId,
          requestId: probeRequestId,
          mode,
          hash,
          length: fullContentProbe.length,
          sample: fullContentProbe.slice(0, 300),
        });

        // Also write an explicit "end" marker so we can tell if finalizers ran.
        logDuplicationProbe('agent_end', {
          projectId: probeProjectId,
          requestId: probeRequestId,
          mode,
          hash,
          length: fullContentProbe.length,
          sample: 'agent_end',
        });
      } catch (probeErr) {
        console.error('Dup probe flush failed:', probeErr);
      }
    }
  }

  /**
   * Filter tools based on mode.
   * @private
   */
  _filterToolsByMode(mode) {
    const allTools = this.tools || {};
    if (mode === 'act') {
      return allTools;
    }
    // PLAN mode: only allow read-only tools
    const readOnlyPatterns = [
      /^read_file$/,
      /^list_files$/,
      /^search_files$/,
      /^list_code_definition_names$/,
      /^DatabaseTool_get_/, 
      /^DatabaseTool_list_/, 
      /^DatabaseTool_search_/,
    ];
    const filtered = {};
    for (const [name, impl] of Object.entries(allTools)) {
      if (readOnlyPatterns.some(pattern => pattern.test(name))) {
        filtered[name] = impl;
      }
    }
    return filtered;
  }

  /**
   * Filter tool calls into allowed and blocked arrays.
   * @private
   */
  _filterToolCalls(toolCalls, allowedTools) {
    const allowed = [];
    const blocked = [];
    for (const call of toolCalls) {
      const toolName = call.function?.name;
      if (!toolName) {
        blocked.push(call);
        continue;
      }
      if (allowedTools[toolName]) {
        allowed.push(call);
      } else {
        blocked.push(call);
      }
    }
    return { allowed, blocked };
  }
}

module.exports = OrionAgent;
