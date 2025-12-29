require('dotenv').config({ path: '../../.env' });
const DS_ReasonerAdapter = require('../../src/adapters/DS_ReasonerAdapter');
const ToolRunner = require('../../tools/ToolRunner');
const registry = require('../../tools/registry');

/**
 * Run a DeepSeek Capability Probe.
 * @param {string} probeName - Name of the probe
 * @param {string} systemPrompt - System instruction
 * @param {Array} tools - List of tool definition objects (from functionDefinitions)
 * @param {string} userMessage - Initial user message
 * @param {Object} [options] - Additional options
 * @param {number} [options.maxTurns=5] - Maximum number of turns
 * @param {Object} [options.toolRegistry] - Custom tool registry (optional)
 */
async function runProbe(probeName, systemPrompt, tools, userMessage, options = {}) {
  console.log(`\n\n=== START PROBE: ${probeName} ===\n`);
  
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('Error: DEEPSEEK_API_KEY not found in .env');
    return;
  }

  // Configure adapter with deepseek-reasoner model (supports reasoning_content)
  // Use the dedicated DS_ReasonerAdapter so behavior matches the
  // production adapter wiring while preserving the probe's semantics.
  const adapter = new DS_ReasonerAdapter({ 
    apiKey,
    model: 'deepseek-reasoner', // explicit, though this is the default
  });
  // registry.getTools() returns the map { FileSystemTool: ..., DatabaseTool: ... }
  // If options.toolRegistry is provided, use it; otherwise use default Orion tools
  const toolRegistry = options.toolRegistry || registry.getTools();
  const maxTurns = options.maxTurns || 10;
  
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];

  console.log(`[System Prompt]: ${systemPrompt.substring(0, 100)}...`);
  console.log(`[User Message]: ${userMessage}\n`);

  let turn = 0;
  while (turn < maxTurns) {
    turn++;
    console.log(`--- Turn ${turn} ---`);

    try {
      // We use non-streaming for simplicity in the probe, unless streaming is strictly required
      // But the adapter supports streaming. Let's use non-streaming for the probe log readability.
      const response = await adapter.sendMessages(messages, {
        tools: tools,
        temperature: 0.0 // Deterministic for probing
      });

      const { content, toolCalls, reasoningContent } = response;

      // Log Reasoning (Think Block)
      if (reasoningContent) {
        console.log(`[DeepSeek Reasoning]:\n${reasoningContent}\n`);
        // Note: Reasoning content is not typically sent back in message history for next turn
        // but we log it for the probe.
      }

      // Log AI response
      if (content) {
        console.log(`[DeepSeek Content]:\n${content}\n`);
      }

      // Construct a single assistant message with all components
      // DeepSeek Reasoner requires reasoning_content to be present if tool_calls are present
      const assistantMsg = { role: 'assistant' };
      if (content) assistantMsg.content = content;
      if (toolCalls && toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;
      if (reasoningContent) assistantMsg.reasoning_content = reasoningContent;
      
      messages.push(assistantMsg);

      // Handle tool calls
      if (toolCalls && toolCalls.length > 0) {
        console.log(`[DeepSeek Tool Calls]: ${toolCalls.length} calls`);

        for (const call of toolCalls) {
          console.log(`  > Calling ${call.function.name}(${call.function.arguments})`);
          
          try {
            // Execute tool
            const results = await ToolRunner.executeToolCalls(
              toolRegistry, 
              [call], 
              { projectId: 'PROBE', requestId: `probe-${Date.now()}` }
            );

            const result = results[0];
            const output = result.success ? result.result : JSON.stringify(result.error);
            
            console.log(`  < Result: ${typeof output === 'string' ? output.substring(0, 100) + (output.length > 100 ? '...' : '') : JSON.stringify(output)}`);

            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              name: call.function.name,
              content: typeof output === 'string' ? output : JSON.stringify(output)
            });

          } catch (err) {
            console.error(`  ! Tool Execution Error: ${err.message}`);
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              name: call.function.name,
              content: `Error: ${err.message}`
            });
          }
        }
      } else {
        // No tool calls - checking if we are done
        // In "tool thinking" mode, usually the final content comes AFTER tools.
        // If we got content but no tools, we might be done or just chatting.
        // We'll let the loop continue if the model wants to say more? 
        // Actually, if no tool calls, it's usually the final answer in this pattern.
        console.log('--- No tool calls, assuming sequence complete ---');
        break;
      }

    } catch (err) {
      console.error('Adapter Error:', err);
      break;
    }
  }

  console.log(`\n=== END PROBE: ${probeName} ===\n`);
}

module.exports = { runProbe };
