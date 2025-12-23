const BaseAgent = require('./BaseAgent');
const path = require('path');
const fs = require('fs');

// NOTE: OrionAgent builds a file list internally and injects it into the system prompt.
// This is NOT a runtime tool call.
// We reuse the same implementation as the `list_files` helper so we can:
// - respect .gitignore (and sensible defaults)
// - keep behavior consistent across the app
const { listFiles } = require('../../tools/list_files');
const { loadIgnorePatterns } = require('../../tools/ignore_utils');

const functionDefinitions = require('../../tools/functionDefinitions');
const TraceService = require('../services/trace/TraceService');
const { TRACE_TYPES, TRACE_SOURCES } = require('../services/trace/TraceEvent');

function safeToolName(call) {
  // Tool call shapes vary by provider and by streaming partials.
  // We only accept fully-formed OpenAI-style: { function: { name: string, arguments: string } }
  if (!call || typeof call !== 'object') return null;
  const fn = call.function;
  if (!fn || typeof fn !== 'object') return null;
  if (typeof fn.name !== 'string' || fn.name.trim() === '') return null;
  return fn.name;
}

function mergeArgumentStrings(existing, incoming) {
  if (typeof incoming !== 'string' || incoming.length === 0) return existing;
  if (typeof existing !== 'string' || existing.length === 0) return incoming;

  // If one is a strict prefix of the other, keep the longer (more complete) version.
  if (incoming.startsWith(existing)) return incoming;
  if (existing.startsWith(incoming)) return existing;

  // If the incoming fragment is already at the end, do nothing.
  if (existing.endsWith(incoming)) return existing;

  // Otherwise, append (streaming tool arguments often arrive as fragments).
  return existing + incoming;
}

function mergeToolCall(existing, patch) {
  if (!existing) return patch;
  if (!patch || typeof patch !== 'object') return existing;

  const merged = { ...existing, ...patch };

  const existingFn = existing.function && typeof existing.function === 'object' ? existing.function : {};
  const patchFn = patch.function && typeof patch.function === 'object' ? patch.function : {};

  merged.function = {
    ...existingFn,
    ...patchFn,
    name: patchFn.name || existingFn.name,
    arguments: mergeArgumentStrings(existingFn.arguments, patchFn.arguments),
  };

  return merged;
}

function mergeToolCallsIntoMap(toolCallMap, toolCalls) {
  if (!toolCallMap || !Array.isArray(toolCalls)) return;

  // OpenAI-style streaming can send:
  // - a first delta that includes both { id, index }
  // - later deltas that include only { index } (no id)
  // We keep a mapping of index -> id in the map itself via a special entry.
  const indexToIdKey = '__index_to_id__';
  const indexToId = toolCallMap.get(indexToIdKey) || new Map();

  for (const call of toolCalls) {
    if (!call || typeof call !== 'object') continue;

    // Establish index->id mapping if both exist
    if (typeof call.index === 'number' && typeof call.id === 'string' && call.id.trim() !== '') {
      indexToId.set(call.index, call.id);
    }

    // Resolve key: prefer explicit id, else use mapped id, else fall back to index.
    let key = null;
    if (typeof call.id === 'string' && call.id.trim() !== '') {
      key = call.id;
    } else if (typeof call.index === 'number' && indexToId.has(call.index)) {
      key = indexToId.get(call.index);
    } else if (typeof call.index === 'number') {
      key = String(call.index);
    }

    if (!key) continue;

    const existing = toolCallMap.get(key);
    toolCallMap.set(key, mergeToolCall(existing, call));
  }

  toolCallMap.set(indexToIdKey, indexToId);
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
      // Uses .gitignore-aware listing so Orion sees the repo (CM-TEAM) without noise.
      try {
        // IMPORTANT: Do not rely on process.cwd() here.
        // When the backend is launched from /backend, cwd becomes that folder.
        // Resolve repo root from this file location instead.
        const rootDir = path.resolve(__dirname, '../../..');

        const ignoreInstance = loadIgnorePatterns(rootDir);
        const tree = listFiles(rootDir, rootDir, ignoreInstance);

        const entries = [];
        const flatten = (nodes) => {
          for (const node of nodes) {
            if (!node) continue;
            if (node.type === 'directory') {
              // include directories as navigational context
              if (node.path) entries.push(`${node.path}/`);
              flatten(node.children || []);
            } else if (node.type === 'file') {
              if (node.path) entries.push(node.path);
            }
          }
        };
        flatten(tree);

        // Keep prompt stable between runs
        entries.sort((a, b) => a.localeCompare(b));

        context.systemState.files = entries;
      } catch (fsError) {
        console.error('Error listing files for context:', fsError);
        context.systemState.files = ['Error listing files'];
      }

      return context;
    } catch (error) {
      console.error('Error building context:', error);
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

    // Ensure request-scoped identifiers are available to ToolRunner for:
    // - centralized tool_call/tool_result tracing
    // - per-request duplicate blocking
    if (options && options.requestId) {
      context.requestId = options.requestId;
    }

    const systemPrompt = this.formatSystemPrompt(context, mode);

    // Format messages for the adapter
    let formattedHistory = this.formatChatHistory(context.chatHistory);
    const lastMsg = formattedHistory[formattedHistory.length - 1];

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
   */
  formatSystemPrompt(context, mode) {
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
   */
  formatChatHistory(chatHistory) {
    return chatHistory.map((msg) => {
      const rawRole = msg.role || msg.sender;
      let role = rawRole;
      if (rawRole === 'orion') role = 'assistant';
      return { role, content: msg.content };
    });
  }

  /**
   * Log error to database
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
   */
  async *processStreaming(projectId, userMessage, options = {}) {
    const { messages, context, mode } = await this._prepareRequest(projectId, userMessage, options);

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
    // NOTE: Tools may be named either as bare helpers (list_files) or as prefixed
    // tool-schema names (FileSystemTool_list_files). We allow both.
    const PLAN_MODE_WHITELIST = [
      'read_file',
      'list_files',
      'search_files',
      'list_code_definition_names',

      // FileSystemTool-prefixed read-only calls
      'FileSystemTool_read_file',
      'FileSystemTool_list_files',
      'FileSystemTool_search_files',

      'DatabaseTool_get_subtask_full_context',
      'DatabaseTool_list_subtasks_by_status',
      'DatabaseTool_search_subtasks'
    ];

    while (continueLoop && iteration < maxIterations) {
      iteration++;

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
        tools: functionDefinitions,
        context: { projectId, requestId: options.requestId },
      });

      // Streaming tool_calls are often emitted as partial deltas.
      // Accumulate them across the stream and merge by call.id (or index) so we end
      // up with a fully-formed { function: { name, arguments } } before executing.
      const toolCallMap = new Map();
      let toolCallsFromStream = [];

      // IMPORTANT: Do not forward adapter `done` to the client yet.
      // If we yield `done` before executing tools, StreamingService will stop
      // forwarding later TOOL RESULT chunks, making it appear that tools never ran.
      let pendingDoneEvent = null;

      for await (const event of adapterStream) {
        if (event.toolCalls) {
          mergeToolCallsIntoMap(toolCallMap, event.toolCalls);
          toolCallsFromStream = Array.from(toolCallMap.values());
          // Forward toolCalls for UI visibility/debugging.
          yield event;
          continue;
        }

        if (event.done) {
          // Save for later; we'll emit a single done at the end of the loop.
          pendingDoneEvent = event;
          continue;
        }

        yield event;
      }

      if (toolCallsFromStream.length > 0) {
        const allowedToolCalls = [];
        const blockedToolCalls = [];

        for (const call of toolCallsFromStream) {
          const toolName = safeToolName(call);
          if (!toolName) continue;

          if (mode === 'plan' && !PLAN_MODE_WHITELIST.some(allowed => toolName.startsWith(allowed) || toolName === allowed)) {
            blockedToolCalls.push(call);
          } else {
            allowedToolCalls.push(call);
          }
        }

        if (blockedToolCalls.length > 0) {
          const blockedMsg = `\n\n**System Notice:** The following tool calls were blocked because they are not allowed in PLAN mode: ${blockedToolCalls.map(c => safeToolName(c)).filter(Boolean).join(', ')}. Switch to ACT mode to execute write operations.`;

          yield { chunk: blockedMsg };

          messages.push({
            role: 'system',
            content: `Refusal: The tool calls [${blockedToolCalls.map(c => safeToolName(c)).filter(Boolean).join(', ')}] were blocked by system policy because the user is in PLAN mode. You must ask the user to switch to ACT mode if these actions are required.`
          });
        }

        if (allowedToolCalls.length > 0) {
          const results = await this.handleToolCalls(allowedToolCalls, context);

          for (const result of results) {
            const toolLabel = result.toolName || 'tool';

            // If a tool call was blocked as a duplicate, Orion can fall into a loop
            // where it keeps retrying the tool. Emit an explicit system instruction
            // to stop retrying and reuse the previous results contained in the payload.
            if (!result.success && result.error === 'DUPLICATE_BLOCKED') {
              const stopRetryMsg = `\n\n**System Notice:** Tool call was blocked as DUPLICATE_BLOCKED. Do NOT call this tool again in this turn. Reuse the previous results included below.\n\n`;
              yield { chunk: stopRetryMsg };
              messages.push({
                role: 'system',
                content: `Stop: ${toolLabel} was blocked as DUPLICATE_BLOCKED. You MUST NOT retry this tool call again in this turn. Use the previous results provided in the TOOL RESULT payload.`
              });
            }

            // ToolRunner returns a structured object:
            // { success, result? } on success, or { success:false, error, details? } on failure.
            // Previously we only boxed `result.result`, which is undefined on failures,
            // causing Orion to see an empty tool result box.
            const payload = result.success
              ? { ok: true, result: result.result }
              : {
                  ok: false,
                  error: result.error || 'Unknown tool error',
                  details: result.details || null,
                  attempts: result.attempts || 0,
                  toolCallId: result.toolCallId || null,
                };

            const resultJson = JSON.stringify(payload, null, 2);

            const header = '═══════════════════════════════════════════════════════════════════════════════';
            const titleLine = `TOOL RESULT: ${toolLabel}`;
            const boxed = [
              header,
              titleLine,
              header,
              resultJson,
              header,
            ].join('\n');

            yield { chunk: `\n\n${boxed}\n\n` };

            messages.push({
              role: 'system',
              content: boxed,
            });
          }
        }

        continueLoop = true;
      } else {
        continueLoop = false;
      }

      // Emit the saved done event only after tool handling (and any follow-up turn).
      // If the adapter never sent a done, don't invent one here.
      if (!continueLoop && pendingDoneEvent) {
        yield pendingDoneEvent;
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
      // bare helper names
      /^read_file$/,
      /^list_files$/,
      /^search_files$/,
      /^list_code_definition_names$/,

      // FileSystemTool-prefixed names
      /^FileSystemTool_read_file$/,
      /^FileSystemTool_list_files$/,
      /^FileSystemTool_search_files$/,

      // DB read-only
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
