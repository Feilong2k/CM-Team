const fs = require('fs');
const path = require('path');

const OrionAgent = require('../agents/OrionAgent');
const StreamingService = require('../services/StreamingService');
const { logDuplicationProbe } = require('../services/trace/DuplicationProbeLogger');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function listProbeFiles() {
  const dir = path.resolve(__dirname, '../../debug/dup_probe');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json'));
}

function computeContentHash(content) {
  let hash = 0;
  if (!content) return hash;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

function looksLikeExactDouble(text) {
  if (!text || text.length < 40) return false;
  if (text.length % 2 !== 0) return false;
  const half = text.length / 2;
  return text.slice(0, half) === text.slice(half);
}

function readProbeJson(fileName) {
  const filePath = path.resolve(__dirname, '../../debug/dup_probe', fileName);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

class FakeSseRes {
  constructor() {
    this.headers = {};
    this.body = '';
    this.ended = false;
  }
  setHeader(k, v) {
    this.headers[k] = v;
  }
  write(s) {
    this.body += s;
  }
  end() {
    this.ended = true;
  }
}

describe('dup_probe: long mock through streaming path (agent + final)', () => {
  test('long stream produces agent_* and final probes; agent and final are identical', async () => {
    const before = new Set(listProbeFiles());

    // IMPORTANT: Our previous longText was unit.repeat(N) which can be X+X (exact double)
    // whenever N is even. Use an odd repeat count + suffix to guarantee not exact-halves.
    const unit = 'The quick brown fox jumps over the lazy dog. ';
    const longText = unit.repeat(901) + 'END-SENTINEL';

    const requestId = 'dup-probe-long-test';
    const projectId = 'P1-long';

    const fakeAdapter = {
      getModelName: () => 'fake-model',
      sendMessages: async () => ({ content: 'ok', toolCalls: [] }),
      sendMessagesStreaming: async function* () {
        const chunkSize = 128;
        for (let i = 0; i < longText.length; i += chunkSize) {
          yield { chunk: longText.slice(i, i + chunkSize) };
        }
        yield { done: true, fullContent: longText };
      },
    };

    const fakeDb = {
      chatMessages: {
        addMessage: async () => {},
        getMessages: async () => [],
      },
    };

    const orionAgent = new OrionAgent(fakeAdapter, fakeDb);
    const streamingService = new StreamingService();

    const upstream = orionAgent.processStreaming(projectId, 'ping', { mode: 'plan', requestId });
    const stream = streamingService.streamFromAdapter(upstream);

    const res = new FakeSseRes();

    const onComplete = async (fullContent) => {
      const hash = computeContentHash(fullContent);
      logDuplicationProbe('final', {
        projectId,
        requestId,
        mode: 'plan',
        hash,
        length: fullContent.length,
        sample: fullContent.slice(0, 300),
      });
    };

    await streamingService.handleSSE(stream, res, onComplete);
    await sleep(50);

    const after = listProbeFiles();
    const newFiles = after.filter(f => !before.has(f));

    const agentStartFile = newFiles.find(f => f.includes(`${projectId}_${requestId}_plan_agent_start.json`));
    const agentFile = newFiles.find(f => f.includes(`${projectId}_${requestId}_plan_agent.json`));
    const agentEndFile = newFiles.find(f => f.includes(`${projectId}_${requestId}_plan_agent_end.json`));
    const finalFile = newFiles.find(f => f.includes(`${projectId}_${requestId}_plan_final.json`));

    expect(agentStartFile).toBeTruthy();
    expect(agentFile).toBeTruthy();
    expect(agentEndFile).toBeTruthy();
    expect(finalFile).toBeTruthy();

    // Sanity: input itself is NOT exact X+X
    expect(looksLikeExactDouble(longText)).toBe(false);

    // Compare agent vs final hashes/lengths. If the pipeline duplicates content, these will differ.
    const agentProbe = readProbeJson(agentFile);
    const finalProbe = readProbeJson(finalFile);

    expect(agentProbe.length).toBe(longText.length);
    expect(finalProbe.length).toBe(longText.length);
    expect(agentProbe.hash).toBe(finalProbe.hash);
  }, 20000);
});
