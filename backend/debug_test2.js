const { ProtocolEventTypes } = require('./archive/agents/protocols/ProtocolStrategy');
const TwoStageProtocol = require('./src/agents/protocols/TwoStageProtocol');

// Mock dependencies
const mockAdapter = {
  sendMessagesStreaming: jest.fn()
};

const mockTools = {
  FileSystemTool: {
    write_to_file: jest.fn(),
    read_file: jest.fn(),
    list_files: jest.fn(),
    search_files: jest.fn()
  }
};

const mockTraceService = {
  logEvent: jest.fn()
};

// Configure mock returns
mockTraceService.logEvent.mockRejectedValue(new Error('Trace DB error'));

// Mock adapter
mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
  yield { chunk: 'Hello' };
  yield { done: true, fullContent: 'Hello' };
});

const protocol = new TwoStageProtocol({
  adapter: mockAdapter,
  tools: mockTools,
  traceService: mockTraceService
});

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
  return events;
}

// Run with Jest's mocking
jest.mock('./tools/ToolRunner', () => ({
  executeToolCalls: jest.fn(),
  buildCanonicalSignature: jest.fn()
}));
jest.mock('./src/services/trace/TraceService', () => ({
  getInstance: jest.fn(() => mockTraceService)
}));

run().then(events => {
  if (events.length === 0) {
    console.error('ERROR: events array is empty!');
    process.exit(1);
  } else {
    console.log('SUCCESS: events captured');
    process.exit(0);
  }
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
