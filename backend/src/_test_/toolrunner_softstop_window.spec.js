/**
 * @jest-environment node
 */

jest.mock('../services/trace/TraceService', () => ({
  logEvent: jest.fn(),
  getEvents: jest.fn(),
}));

const ToolRunner = require('../../tools/ToolRunner');

describe('ToolRunner enhanced soft-stop window', () => {
  test('blocks duplicate tool calls within 10s window, allows after window', async () => {
    process.env.TOOL_SOFTSTOP_WINDOW_MS = '10000';
    const tools = {
      DatabaseTool: {
        get_subtask_full_context: jest.fn().mockResolvedValue({ ok: true, v: 1 }),
      },
    };

    const toolCall = {
      id: 'call_1',
      type: 'function',
      function: {
        name: 'DatabaseTool_get_subtask_full_context',
        arguments: JSON.stringify({ subtask_id: '2-1-13' }),
      },
    };

    const baseContext = { projectId: 'P1', requestId: 'req-softstop-window' };

    // First call at t=0 executes
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
    let results = await ToolRunner.executeToolCalls(tools, [toolCall], baseContext);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(tools.DatabaseTool.get_subtask_full_context).toHaveBeenCalledTimes(1);

    // Second call at t=+5s gets blocked
    Date.now.mockReturnValue(1_000 + 5_000);
    results = await ToolRunner.executeToolCalls(tools, [toolCall], baseContext);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toBe('DUPLICATE_BLOCKED');
    expect(tools.DatabaseTool.get_subtask_full_context).toHaveBeenCalledTimes(1);

    // Third call at t=+11s executes again
    Date.now.mockReturnValue(1_000 + 11_000);
    results = await ToolRunner.executeToolCalls(tools, [toolCall], baseContext);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(tools.DatabaseTool.get_subtask_full_context).toHaveBeenCalledTimes(2);

    Date.now.mockRestore();
  });
});
