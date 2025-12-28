const DS_ChatAdapter = require('../adapters/DS_ChatAdapter');

function makeFakeSseResponse(lines) {
  const encoder = new TextEncoder();

  // Simple reader that returns each line as a separate chunk
  let i = 0;
  return {
    ok: true,
    body: {
      getReader() {
        return {
          async read() {
            if (i >= lines.length) {
              return { done: true, value: undefined };
            }
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

describe('DS_ChatAdapter duplicate delta guard', () => {
  test('drops exact consecutive duplicate delta.content chunks', async () => {
    const adapter = new DS_ChatAdapter({ apiKey: 'test-key', baseURL: 'https://example.invalid' });

    const originalFetch = global.fetch;

    const mkData = (content) =>
      `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n`;

    // Two identical deltas in a row should be collapsed
    const lines = [
      mkData('Hello '),
      mkData('Hello '),
      mkData('World'),
      'data: [DONE]\n',
    ];

    global.fetch = jest.fn(async () => makeFakeSseResponse(lines));

    const chunks = [];
    let doneEvent = null;

    const stream = adapter.sendMessagesStreaming(
      [{ role: 'user', content: 'hi' }],
      { tools: null }
    );

    for await (const evt of stream) {
      if (evt.chunk) chunks.push(evt.chunk);
      if (evt.done) doneEvent = evt;
    }

    // Restore fetch
    global.fetch = originalFetch;

    expect(chunks.join('')).toBe('Hello World');
    expect(doneEvent).toBeTruthy();
    expect(doneEvent.fullContent).toBe('Hello World');
  });
});
