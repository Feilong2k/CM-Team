const { executeToolCalls } = require('../../tools/ToolRunner');

// Minimal tool registry that always throws a deterministic NOT_FOUND style error.
const tools = {
  DatabaseTool: {
    get_subtask_full_context: async () => {
      throw new Error('Tool "DatabaseTool_get_subtask_full_context" execution failed: Subtask with ID 2-1-199 not found');
    },
  },
};

describe('ToolRunner retry policy', () => {
  test('does not retry deterministic not-found errors (prevents spam)', async () => {
    const toolCalls = [
      {
        id: 'call_1',
        type: 'function',
        function: {
          name: 'DatabaseTool_get_subtask_full_context',
          arguments: JSON.stringify({ subtask_id: '2-1-199' }),
        },
      },
    ];

    const results = await executeToolCalls(tools, toolCalls, { projectId: 'P1' });

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);

    // We should have attempted exactly once.
    expect(results[0].attempts).toBe(1);
    expect(results[0].error).toMatch(/not found/i);
  });
});
