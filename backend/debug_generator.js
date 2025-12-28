const TwoStageProtocol = require('./src/agents/protocols/TwoStageProtocol');
const { ProtocolEventTypes } = require('./archive/agents/protocols/ProtocolStrategy');

const mockAdapter = {
  sendMessagesStreaming: async function* () {
    yield { chunk: 'Hello' };
    yield { done: true, fullContent: 'Hello' };
  }
};

const mockTools = {
  FileSystemTool: {
    write_to_file: () => {},
    read_file: () => {},
    list_files: () => {},
    search_files: () => {}
  }
};

const mockTraceService = {
  logEvent: async () => { throw new Error('Trace DB error'); }
};

const protocol = new TwoStageProtocol({ adapter: mockAdapter, tools: mockTools, traceService: mockTraceService });

const context = {
  messages: [
    { role: 'system', content: 'You are Orion' },
    { role: 'user', content: 'Hello' }
  ],
  mode: 'plan',
  projectId: 'test-project',
  requestId: 'test-request-123',
  config: {
    maxPhaseCycles: 3,
    maxDuplicateAttempts: 2,
    debugShowToolResults: false,
    MAX_SEARCH_EXECUTIONS_PER_TURN: 2
  }
};

async function run() {
  const events = [];
  console.log('Starting loop');
  for await (const event of protocol.executeStreaming(context)) {
    console.log('Loop iteration, event:', event);
    events.push(event);
  }
  console.log('Loop finished, events length:', events.length);
  console.log('Events:', events);
}
run().catch(console.error);
