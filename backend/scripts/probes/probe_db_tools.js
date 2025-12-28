const { runProbe } = require('./probe_runner');
const functionDefinitions = require('../../tools/functionDefinitions');

// Filter for only Database tools
const dbTools = functionDefinitions.filter(t => t.function.name.startsWith('DatabaseTool_'));

const systemPrompt = `
You are a Database Probe Agent.
You solve tasks by **calling tools**.
Do not guess IDs or schema. Use tools to find them.

Preferred reasoning pattern:
1. **THINK**: Plan the sequence of database operations.
2. **ACT**: Execute tools to find a parent task ID.
3. **THINK**: Verify the parent task ID and plan the creation.
4. **ACT**: Create the subtask.
5. **THINK**: Plan verification and cleanup.
6. **ACT**: Verify creation, delete the subtask, and verify deletion.

Use as few tool calls as possible per turn, but be thorough in verification.
`.trim();

const task = `
Using only database tools:
1. Create a new task under Feature 3 (F3) with the title "PROBE_DB_TEST_TASK".
2. Create a new subtask under this newly created task with the title "PROBE_TEST_SUBTASK".
3. Confirm the subtask was created by fetching it.
4. Delete the subtask you just created.
5. Verify the subtask is gone by attempting to fetch it again.
`.trim();

(async () => {
  await runProbe('Database Probe', systemPrompt, dbTools, task);
})();
