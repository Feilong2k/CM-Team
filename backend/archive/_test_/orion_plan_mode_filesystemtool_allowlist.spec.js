/**
 * @jest-environment node
 */

// This test guards against Orion blocking read-only FileSystemTool calls in PLAN mode.

jest.mock('../services/trace/TraceService', () => ({
  logEvent: jest.fn(),
  getEvents: jest.fn(),
}));

const OrionAgent = require('../agents/OrionAgent');
const { getToolsForRole } = require('../../tools/registry');

// Avoid DB connections during this unit test (OrionAgent writes chat messages via DatabaseToolInternal).
jest.mock('../db/connection', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  getPool: jest.fn().mockReturnValue({ end: jest.fn() }),
}));

function makeAdapterReturningToolCall(toolName, args = {}) {
  return {
    // BaseAgent requires a non-streaming sendMessages implementation even if the test
    // only exercises the streaming path.
    sendMessages: async () => ({ content: '', toolCalls: [] }),

    sendMessagesStreaming: async function* () {
      // Emit a single tool call (non-partial) and then done.
      yield {
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: toolName,
              arguments: JSON.stringify(args),
            },
          },
        ],
      };
      yield { done: true, fullContent: '' };
    },
  };
}

describe('OrionAgent PLAN mode allowlist: FileSystemTool_list_files', () => {
  test('does not block FileSystemTool_list_files in PLAN mode', async () => {
    const tools = getToolsForRole('Orion', 'act');
    // Ensure the tool exists in registry
    expect(tools.FileSystemTool).toBeTruthy();

    const adapter = makeAdapterReturningToolCall('FileSystemTool_list_files', {
      path: '.',
      recursive: false,
    });

    const agent = new OrionAgent(adapter, tools);

    // Collect streamed events
    const chunks = [];
    for await (const ev of agent.processStreaming('P1', 'List files please', {
      mode: 'plan',
      requestId: 'test-plan-fs-allow',
    })) {
      if (ev && ev.chunk) chunks.push(ev.chunk);
    }

    const combined = chunks.join('\n');

    // Should NOT have system notice saying FileSystemTool_list_files was blocked.
    expect(combined).not.toMatch(/blocked.*FileSystemTool_list_files/i);

    // Should contain a TOOL RESULT box
    expect(combined).toMatch(/TOOL RESULT:\s*FileSystemTool\.list_files/i);
  });
});
