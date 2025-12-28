const { runProbe } = require('./probe_runner');
const functionDefinitions = require('../../tools/functionDefinitions');

// Filter for only FileSystem tools
const fsTools = functionDefinitions.filter(t => t.function.name.startsWith('FileSystemTool_'));

const systemPrompt = `
You are a FileSystem Probe Agent.
You solve tasks by **calling tools**. When you need information or need to make changes, call tools instead of guessing.
Only after tools are done, provide a brief natural-language summary.

Preferred reasoning pattern:
1. Decide which tools are needed and in what order.
2. Call tools with precise arguments (no placeholders).
3. Use tool results as ground truth.
4. Avoid repeating the same tool call (same target path) unless the user changed the request.

You have a limited number of tool calls per turn. Use as few as needed.
`.trim();

const task = `
Using only the filesystem tools provided:
1. List files in the current working directory.
2. Create a new text file named 'deepseek_fs_probe.txt' containing a short message of your choice.
3. Read the file you just created and confirm its contents.
4. Delete the file you just created (note: if a delete tool is not available, just mention that you cannot delete it).
`.trim();

(async () => {
  await runProbe('FileSystem Probe', systemPrompt, fsTools, task);
})();
