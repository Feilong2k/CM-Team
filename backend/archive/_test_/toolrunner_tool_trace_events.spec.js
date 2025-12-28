/**
 * @jest-environment node
 */

jest.mock('../services/trace/TraceService', () => ({
  logEvent: jest.fn(),
}));

const TraceService = require('../services/trace/TraceService');
const ToolRunner = require('../../tools/ToolRunner');
const { getToolsForRole } = require('../../tools/registry');

describe('ToolRunner centralized tool_call/tool_result tracing', () => {
  beforeEach(() => {
    TraceService.logEvent.mockClear();
    ToolRunner.perRequestDuplicateTracker.clear();
  });

  test('emits tool_call and tool_result for FileSystemTool_list_files success', async () => {
    const tools = getToolsForRole('Orion', 'act');

    const toolCalls = [
      {
        id: 'tc1',
        type: 'function',
        function: {
          name: 'FileSystemTool_list_files',
          arguments: JSON.stringify({ path: '.', recursive: false }),
        },
      },
    ];

    const context = { projectId: 'P1', requestId: 'trace-test-1' };

    const results = await ToolRunner.executeToolCalls(tools, toolCalls, context);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);

    const calls = TraceService.logEvent.mock.calls.map((c) => c[0]);

    const toolCallEvent = calls.find((e) => e.type === 'tool_call' && e.toolName === 'FileSystemTool.list_files');
    const toolResultEvent = calls.find((e) => e.type === 'tool_result' && e.toolName === 'FileSystemTool.list_files');

    expect(toolCallEvent).toBeTruthy();
    expect(toolCallEvent.projectId).toBe('P1');
    expect(toolCallEvent.requestId).toBe('trace-test-1');

    expect(toolResultEvent).toBeTruthy();
    expect(toolResultEvent.details).toMatchObject({
      success: true,
      toolCallId: 'tc1',
    });
  });

  test('emits tool_call and tool_result for DUPLICATE_BLOCKED', async () => {
    const tools = getToolsForRole('Orion', 'act');

    // Use a distinct projectId to avoid the legacy cachedToolResults reuse window
    // leaking across tests (it is process-global inside ToolRunner).
    const context = { projectId: 'P1_DUP', requestId: 'trace-test-dup' };

    const toolCall = {
      id: 'tc_dup',
      type: 'function',
      function: {
        name: 'FileSystemTool_list_files',
        arguments: JSON.stringify({ path: '.', recursive: false }),
      },
    };

    const first = await ToolRunner.executeToolCalls(tools, [toolCall], context);
    expect(first[0].success).toBe(true);
    // Guard: ensure this was a real execution, not a legacy reuse shortcut.
    expect(first[0].result && first[0].result.warning).toBeFalsy();

    TraceService.logEvent.mockClear();

    const second = await ToolRunner.executeToolCalls(tools, [toolCall], context);
    expect(second[0].success).toBe(false);
    expect(second[0].error).toBe('DUPLICATE_BLOCKED');

    const calls = TraceService.logEvent.mock.calls.map((c) => c[0]);

    const toolCallEvent = calls.find((e) => e.type === 'tool_call' && e.toolName === 'FileSystemTool.list_files');
    const toolResultEvent = calls.find((e) => e.type === 'tool_result' && e.toolName === 'FileSystemTool.list_files');

    expect(toolCallEvent).toBeTruthy();
    expect(toolResultEvent).toBeTruthy();
    expect(toolResultEvent.details.blocked).toBe(true);
    expect(toolResultEvent.details.error).toBe('DUPLICATE_BLOCKED');
  });
});
