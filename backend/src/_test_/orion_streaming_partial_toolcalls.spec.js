const OrionAgent = require('../agents/OrionAgent');
const ToolRunner = require('../../tools/ToolRunner');

jest.mock('../../tools/ToolRunner', () => ({
  executeToolCalls: jest.fn().mockResolvedValue([{ toolName: 'DatabaseTool.get_subtask_full_context', result: { ok: true } }]),
}));

describe('OrionAgent.processStreaming tolerates + merges partial streamed tool_calls', () => {
  test('does not throw when toolCalls include entries missing function.name', async () => {
    const fakeAdapter = {
      getModelName: () => 'fake',
      sendMessages: async () => ({ content: 'ok', toolCalls: [] }),
      sendMessagesStreaming: async function* () {
        // Simulate partial tool call deltas (common in OpenAI streaming)
        yield { toolCalls: [{ id: 'call_1' }] };
        yield { chunk: 'hello' };
        yield { done: true, fullContent: 'hello' };
      },
    };

    const fakeDb = {
      chatMessages: {
        addMessage: async () => {},
        getMessages: async () => [],
      },
    };

    const agent = new OrionAgent(fakeAdapter, fakeDb);

    const events = [];
    for await (const evt of agent.processStreaming('P1', 'ping', { mode: 'plan' })) {
      events.push(evt);
    }

    // Should have streamed the chunk and ended.
    expect(events.some(e => e.chunk === 'hello')).toBe(true);
  });

  test('merges streaming tool_call fragments and executes once when function.name arrives later', async () => {
    let streamTurns = 0;

    const fakeAdapter = {
      getModelName: () => 'fake',
      sendMessages: async () => ({ content: 'ok', toolCalls: [] }),
      sendMessagesStreaming: async function* () {
        streamTurns += 1;

        // First turn: emit tool_call fragments.
        if (streamTurns === 1) {
          // Fragment 1: has id + empty function
          yield { toolCalls: [{ id: 'call_1', type: 'function', function: { name: '', arguments: '' } }] };
          // Fragment 2: name arrives
          yield { toolCalls: [{ id: 'call_1', type: 'function', function: { name: 'DatabaseTool_get_subtask_full_context', arguments: '' } }] };
          // Fragment 3: arguments arrive as a fragment
          yield { toolCalls: [{ id: 'call_1', type: 'function', function: { arguments: '{"subtask_id":"2-0-6"}' } }] };
          yield { done: true, fullContent: '' };
          return;
        }

        // Second turn: after tool results are injected, model should stop calling tools.
        yield { done: true, fullContent: 'ok' };
      },
    };

    const fakeDb = {
      chatMessages: {
        addMessage: async () => {},
        getMessages: async () => [],
      },
    };

    const agent = new OrionAgent(fakeAdapter, fakeDb);

    // Drain
    for await (const _evt of agent.processStreaming('P1', 'ping', { mode: 'act' })) {
      // no-op
    }

    // ToolRunner should be called once with merged toolCalls
    expect(ToolRunner.executeToolCalls).toHaveBeenCalledTimes(1);

    const [, toolCallsArg] = ToolRunner.executeToolCalls.mock.calls[0];
    expect(Array.isArray(toolCallsArg)).toBe(true);
    expect(toolCallsArg).toHaveLength(1);
    expect(toolCallsArg[0].function.name).toBe('DatabaseTool_get_subtask_full_context');
    expect(toolCallsArg[0].function.arguments).toContain('2-0-6');
  });
});
