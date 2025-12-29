const { runProbe } = require('./probe_runner');
const functionDefinitions = require('../../tools/functionDefinitions');
const registry = require('../../tools/registry');

// 1. Define Aider Tool Definition
const aiderToolDef = {
  type: 'function',
  function: {
    name: 'AiderTool_delegate',
    description: 'Delegate a single-file implementation step to Aider. Requires full file context.',
    parameters: {
      type: 'object',
      properties: {
        step_id: { type: 'string' },
        step_description: { type: 'string' },
        context_files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['path', 'content']
          }
        },
        acceptance_criteria: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['step_id', 'step_description', 'context_files', 'acceptance_criteria']
    }
  }
};

// 2. Prepare Tool List (FS Tools + Aider Tool)
const fsTools = functionDefinitions.filter(t => t.function.name.startsWith('FileSystemTool_'));
const tools = [...fsTools, aiderToolDef];

// 3. Prepare Composite Registry (Real FS + Mock Aider)
// registry.getTools() returns the map of tool instances
const compositeRegistry = { ...registry.getTools() };
compositeRegistry['AiderTool_delegate'] = async (args) => {
  console.log(`\n*** [MOCK Aider] Delegating Step: ${args.step_id} ***`);
  console.log(`Description: ${args.step_description}`);
  
  // Format the Aider command for visibility/verification
  // In a real implementation, we would write context files to a temp dir or ensure they exist.
  // Here we assume paths are relative to repo root.
  const filePaths = args.context_files ? args.context_files.map(f => f.path).join(' ') : '';
  
  // Clean message for CLI
  const cleanMessage = args.step_description.replace(/"/g, '\\"').replace(/\n/g, ' ');
  const criteria = args.acceptance_criteria ? args.acceptance_criteria.join('; ') : '';
  const fullMessage = `${cleanMessage} Acceptance Criteria: ${criteria}`;
  
  // Updated command to match the verified configuration:
  // aider --config .aider.conf.yml --env-file backend/.env --message "..." file1 file2
  const aiderCommand = `aider --config .aider.conf.yml --env-file backend/.env --message "${fullMessage}" ${filePaths}`;
  
  console.log(`Generated Command:\n${aiderCommand}`);

  if (args.context_files && Array.isArray(args.context_files)) {
    console.log(`Context Files (${args.context_files.length}):`);
    args.context_files.forEach(f => {
      console.log(`  - ${f.path} (${f.content ? f.content.length : 0} bytes)`);
    });
  } else {
    console.log('WARNING: No context_files provided!');
  }
  
  // Return success to model so it proceeds
  return `Delegated step ${args.step_id} to Aider. Command generated successfully.`;
};

// 4. System Prompt
const systemPrompt = `
You are an Aider Delegation Probe Agent.
Your job is to break a subtask into atomic steps and delegate them to Aider.
Since Aider cannot read files itself, you MUST:
1. Identify relevant files using FileSystem tools.
2. Read their content.
3. Pass the FULL content in the 'context_files' argument when calling 'AiderTool_delegate'.

Process:
1. Break subtask into 3 steps.
2. Write the plan to 'aider_subtask_steps_probe.json'.
3. For each step:
   - READ the files needed.
   - CALL 'AiderTool_delegate' with the step details and file contents.
`.trim();

// 5. Task
const task = `
Subtask: "Refactor the 'TraceService.js' file to add a new method 'getRecentErrors(limit)' that returns the last N error events."

Please:
1. Break this into 3 atomic steps (e.g., analyze/mock, implement, test).
2. Store the plan in 'aider_subtask_steps_probe.json'.
3. Delegate each step to Aider using 'AiderTool_delegate', ensuring you include the content of 'backend/src/services/trace/TraceService.js' in the context for the implementation step.
`.trim();

(async () => {
  await runProbe('Aider Delegation Probe', systemPrompt, tools, task, { toolRegistry: compositeRegistry, maxTurns: 15 });
})();
