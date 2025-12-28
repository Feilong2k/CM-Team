const GPT41Adapter = require('../adapters/GPT41Adapter');

function makeFakeSseResponse(lines) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    body: {
      getReader() {
        return {
          async read() {
            if (i >= lines.length) return { done: true, value: undefined };
            const value = encoder.encode(lines[i]);
            i++;
            return { done: false, value };
          },
          releaseLock() {},
        };
      },
    },
  };
}

describe('GPT41Adapter streaming tool calls', () => {
  test('yields toolCalls when delta.tool_calls appears', async () => {
    const adapter = new GPT41Adapter({ apiKey: 'test-key', baseURL: 'https://example.invalid' });

    const originalFetch = global.fetch;

    const mkData = (delta) =>
      `data: ${JSON.stringify({ choices: [{ delta }] })}\n`;

    const lines = [
      mkData({ tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '{"path":"README.md"}' } }] }),
      mkData({ content: 'Hello ' }),
      mkData({ content: 'World' }),
      'data: [DONE]\n',
    ];

    global.fetch = jest.fn(async () => makeFakeSseResponse(lines));

    const seen = { toolCalls: null, text: '', done: null };

    const stream = adapter.sendMessagesStreaming(
      [{ role: 'user', content: 'hi' }],
      { tools: [{ type: 'function', function: { name: 'read_file', description: 'x', parameters: { type: 'object', properties: {} } } }] }
    );

    for await (const evt of stream) {
      if (evt.toolCalls && !seen.toolCalls) seen.toolCalls = evt.toolCalls;
      if (evt.chunk) seen.text += evt.chunk;
      if (evt.done) seen.done = evt;
    }

    global.fetch = originalFetch;

    expect(Array.isArray(seen.toolCalls)).toBe(true);
    expect(seen.toolCalls[0].function.name).toBe('read_file');
    expect(seen.text).toBe('Hello World');
    expect(seen.done).toBeTruthy();
    expect(seen.done.fullContent).toBe('Hello World');
  });
});
