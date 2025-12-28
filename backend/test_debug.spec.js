const TwoStageProtocol = require('./src/agents/protocols/TwoStageProtocol');
const { ProtocolEventTypes } = require('./archive/agents/protocols/ProtocolStrategy');

describe('Debug test', () => {
  let mockAdapter;
  let mockTools;
  let mockTraceService;
  let mockProtocol;

  beforeEach(() => {
    mockAdapter = {
      sendMessagesStreaming: jest.fn()
    };
    mockTools = {};
    mockTraceService = {
      logEvent: jest.fn()
    };
    mockProtocol = new TwoStageProtocol({
      adapter: mockAdapter,
      tools: mockTools,
      traceService: mockTraceService
    });
  });

  test('should not crash when TraceService.logEvent throws', async () => {
    // Trace service throws error
    mockTraceService.logEvent.mockRejectedValue(new Error('Trace DB error'));
    
    mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
      yield { chunk: 'Hello' };
      yield { done: true, fullContent: 'Hello' };
    });

    const context = {
      messages: [
        { role: 'system', content: 'You are Orion' },
        { role: 'user', content: 'Hello' }
      ],
      mode: 'plan',
      projectId: 'test-project',
      requestId: 'test-request-123',
      adapter: mockAdapter,
      tools: mockTools,
      traceService: mockTraceService,
      config: {}
    };

    // Should not throw
    const events = [];
    console.log('Before expect, events:', events);
    await expect(async () => {
      console.log('Inside expect, before loop');
      for await (const event of mockProtocol.executeStreaming(context)) {
        console.log('Loop iteration, event:', event);
        events.push(event);
      }
      console.log('After loop, events:', events);
    }).not.toThrow();
    
    console.log('After expect, events:', events);
    // Should still produce protocol events
    expect(events.length).toBeGreaterThan(0);
    expect(events).toContainEqual(expect.objectContaining({
      type: ProtocolEventTypes.DONE
    }));
  });
});
