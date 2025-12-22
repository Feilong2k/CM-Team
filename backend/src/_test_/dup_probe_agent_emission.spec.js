const fs = require('fs');
const path = require('path');

const OrionAgent = require('../agents/OrionAgent');
const StreamingService = require('../services/StreamingService');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function listProbeFiles() {
  const dir = path.resolve(__dirname, '../../debug/dup_probe');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json'));
}

describe('dup_probe: agent + final snapshots', () => {
  test('streamFromAdapter fully consumes upstream so OrionAgent can write agent probe', async () => {
    const before = new Set(listProbeFiles());

    // Fake adapter that satisfies BaseAgent interface + streaming.
    const fakeAdapter = {
      getModelName: () => 'fake-model',
      sendMessages: async () => ({ content: 'ok', toolCalls: [] }),
      sendMessagesStreaming: async function* () {
        yield { chunk: 'Hello ' };
        yield { chunk: 'World' };
        yield { done: true, fullContent: 'Hello World' };
      },
    };

    // Minimal tools + db stubs used by OrionAgent
    const fakeDb = {
      chatMessages: {
        addMessage: async () => {},
        getMessages: async () => [],
      },
    };

    const agent = new OrionAgent(fakeAdapter, fakeDb);
    const streamingService = new StreamingService();

    const upstream = agent.processStreaming('P1-test', 'ping', {
      mode: 'plan',
      requestId: 'dup-probe-test',
    });
    const stream = streamingService.streamFromAdapter(upstream);

    for await (const _evt of stream) {
      // no-op
    }

    await sleep(25);

    const after = listProbeFiles();
    const newFiles = after.filter(f => !before.has(f));

    const agentFiles = newFiles.filter(f => f.includes('_agent.json'));
    expect(agentFiles.length).toBeGreaterThan(0);
  });
});
