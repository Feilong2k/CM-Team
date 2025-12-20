const BaseAgent = require('./BaseAgent');
const path = require('path');
const fs = require('fs');
const { listFiles } = require('../../tools/list_files'); // Assuming this tool exists or I need to create/import it. 
// Wait, I should check where list_files is defined. It's likely in backend/tools/list_files.js

/**
 * OrionAgent - The orchestrator agent that extends BaseAgent.
 * Handles context building, logging, and conversation management.
 */
class OrionAgent extends BaseAgent {
  /**
   * Constructor for OrionAgent
   * @param {Object} adapter - Model adapter that implements LLMAdapter interface
   * @param {Object} databaseTool - Database tool with methods for chat messages and logging
   * @param {string} [promptPath] - Optional custom path to the Orion prompt file
   */
  constructor(adapter, databaseTool, promptPath = null) {
    super(adapter, databaseTool, 'Orion');
    
    this.db = databaseTool;
    
    // Load Orion prompt from file
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
        // We need to be careful about where cwd is.
        // If cwd is c:\Coding\CM-TEAM, then backend is a subdir.
        
        // Simple recursive list implementation for whitelisted dirs
        const whitelist = ['backend', 'frontend', '.Docs', 'src'];
        const files = [];
        
        for (const dir of whitelist) {
            const fullPath = path.join(rootDir, dir);
            if (fs.existsSync(fullPath)) {
                // Use the listFiles tool logic if possible, or just a simple recursive walk
                // Here we'll do a simple walk for now to populate file names
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
    let messages = [
      { role: 'system', content: '' },
      { role: 'user', content: userMessage }
    ];

    try {
      // Store user message
      if (this.db.chatMessages && typeof this.db.chatMessages.addMessage === 'function') {
        await this.db.chatMessages.addMessage(projectId, 'user', userMessage, { mode });
      }

      // Build context and system prompt
      const context = await this.buildContext(projectId);
      const systemPrompt = this.formatSystemPrompt(context, mode);

      // Initialize messages with system prompt and chat history
      messages = [
        { role: 'system', content: systemPrompt },
        ...this.formatChatHistory(context.chatHistory),
        { role: 'user', content: userMessage }
      ];

      let continueLoop = true;
      let iteration = 0;
      const maxIterations = 5;

      while (continueLoop && iteration < maxIterations) {
        iteration++;

        // Send messages to adapter
        const adapterResponse = await this.adapter.sendMessages(messages, {
          temperature: mode === 'plan' ? 0.7 : 0.3,
          max_tokens: 4000,
          tools: this.tools // Pass tools to adapter if needed
        });

        // Adapter response expected to be { content, toolCalls }
        const { content, toolCalls } = adapterResponse;

        responseContent = content;

        // Store Orion's response
        if (this.db.chatMessages && typeof this.db.chatMessages.addMessage === 'function') {
          // Generate a unique ID for the response to avoid unique constraint violation on external_id
          const responseId = `${projectId}-response-${Date.now()}`;
          await this.db.chatMessages.addMessage(responseId, 'orion', content, {
            mode,
            model: this.getModelName(),
            tokens: 0 // TODO: Extract tokens from adapter response if available
          });
        }

        if (toolCalls && toolCalls.length > 0) {
          // Execute tool calls using BaseAgent's handleToolCalls
          toolCallResults = await this.handleToolCalls(toolCalls, context);

          // Append tool call results to messages for next iteration
          for (const result of toolCallResults) {
            messages.push({
              role: 'system',
              content: `Tool ${result.toolName} returned: ${JSON.stringify(result.result)}`
            });
          }
        } else {
          continueLoop = false;
        }
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
    const header = `## Current Session Context
- **Project ID**: ${context.projectId}
- **Mode**: ${mode} (${mode === 'plan' ? 'PLAN mode: Focus on analysis, planning, and high-level guidance.' : 'ACT mode: Focus on concrete implementation, code generation, and execution.'})
- **Chat History**: ${context.chatHistory.length} previous messages available
- **System State**: ${Object.keys(context.systemState).length > 0 ? 'Available' : 'Not available'}
- **Current Time**: ${new Date().toISOString()}

## Available Context (File List)
The following files are available in the project context. You can use 'read_file' to examine them.
\`\`\`
${fileList.slice(0, 5000)} ${fileList.length > 5000 ? '\n... (truncated)' : ''}
\`\`\`

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
}

module.exports = OrionAgent;
