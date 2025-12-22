const OrionAgent = require('../agents/OrionAgent');

describe('OrionAgent.processStreaming tolerates partial streamed tool_calls', () => {
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
});
