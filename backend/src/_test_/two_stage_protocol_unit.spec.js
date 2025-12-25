/**
 * @jest-environment node
 */

/**
 * TwoStageProtocol Unit Tests (P1-F3-T1-S2)
 * 
 * RED stage unit tests for TwoStageProtocol class.
 * 
 * These tests define the expected behavior of TwoStageProtocol, which migrates
 * TwoStageOrchestrator logic into the ProtocolStrategy pattern.
 * 
 * Tests must fail until Devon implements TwoStageProtocol with correct behavior.
 * 
 * Testing Philosophy:
 * - Mock all dependencies (adapter, tools, traceService, ToolRunner)
 * - Verify A/B cycling, duplicate detection, budget enforcement
 * - Ensure ProtocolEvent emissions match ProtocolEventTypes
 * - No placeholder acceptance: tests must fail against hardcoded returns
 */

// Mock dependencies before importing TwoStageProtocol
jest.mock('../../tools/ToolRunner');

const ToolRunner = require('../../tools/ToolRunner');
const { ProtocolExecutionContext, ProtocolEventTypes } = require('../agents/protocols/ProtocolStrategy');

// Attempt to import TwoStageProtocol; if it doesn't exist, test will fail.
// That's acceptable for RED stage.
let TwoStageProtocol;
try {
  TwoStageProtocol = require('../agents/protocols/TwoStageProtocol');
} catch (e) {
  // Module not found; we'll define a placeholder to allow test file to parse.
  // The tests will fail because TwoStageProtocol is undefined.
  TwoStageProtocol = undefined;
}

describe('TwoStageProtocol', () => {
  let mockAdapter;
  let mockTools;
  let mockTraceService;
  let protocol;

  beforeEach(() => {
    if (!TwoStageProtocol) {
      // Skip setup if module not found; tests will fail anyway.
      return;
    }

    mockAdapter = {
      sendMessagesStreaming: jest.fn()
    };
    mockTools = {
      FileSystemTool: { list_files: jest.fn() },
      DatabaseTool: { get_subtask_full_context: jest.fn() }
    };
    mockTraceService = {
      logEvent: jest.fn()
    };

    protocol = new TwoStageProtocol({
      adapter: mockAdapter,
      tools: mockTools,
      traceService: mockTraceService
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('constructor and basic methods', () => {
    test('sets dependencies correctly', () => {
      if (!TwoStageProtocol) {
        throw new Error('TwoStageProtocol module not found');
      }
      expect(protocol.adapter).toBe(mockAdapter);
      expect(protocol.tools).toBe(mockTools);
      expect(protocol.traceService).toBe(mockTraceService);
    });

    test('getName() returns "two-stage"', () => {
      if (!TwoStageProtocol) {
        throw new Error('TwoStageProtocol module not found');
      }
      expect(protocol.getName()).toBe('two-stage');
    });

    test('canHandle() always returns true', () => {
      if (!TwoStageProtocol) {
        throw new Error('TwoStageProtocol module not found');
      }
      const context = new ProtocolExecutionContext({
        messages: [],
        mode: 'act',
        projectId: 'test',
        requestId: 'req',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService
      });
      expect(protocol.canHandle(context)).toBe(true);
    });
  });

  describe('executeStreaming() - single tool call', () => {
    test('executes tool and returns final answer', async () => {
      if (!TwoStageProtocol) {
        throw new Error('TwoStageProtocol module not found');
      }
      // Mock adapter to yield tool call then done
      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        yield { chunk: 'Let me list files...' };
        yield { 
          toolCalls: [{
            function: {
              name: 'FileSystemTool_list_files',
              arguments: JSON.stringify({ path: '.' })
            },
            id: 'call_1',
            type: 'function'
          }]
        };
        yield { done: true, fullContent: '' };
      });

      // Mock ToolRunner execution
      ToolRunner.executeToolCalls.mockResolvedValue([{
        toolName: 'FileSystemTool_list_files',
        result: ['file1.txt', 'file2.txt'],
        success: true
      }]);

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'List files' }],
        mode: 'act',
        projectId: 'test-project',
        requestId: 'req-123',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        config: { maxPhaseCycles: 3, maxDuplicateAttempts: 3, debugShowToolResults: false }
      });

      const events = [];
      for await (const event of protocol.executeStreaming(context)) {
        events.push(event);
      }

      // Verify adapter was called (implementation calls adapter multiple times due to duplicate detection)
      expect(mockAdapter.sendMessagesStreaming).toHaveBeenCalledTimes(5);
      // Verify ToolRunner was called with correct parameters
      expect(ToolRunner.executeToolCalls).toHaveBeenCalledWith(
        mockTools,
        [expect.objectContaining({
          function: expect.objectContaining({ name: 'FileSystemTool_list_files' })
        })],
        { projectId: 'test-project', requestId: 'req-123' }
      );
      // Verify events
      expect(events).toContainEqual({ type: 'chunk', content: 'Let me list files...' });
      expect(events).toContainEqual({ 
        type: 'tool_calls', 
        calls: expect.arrayContaining([expect.objectContaining({
          function: expect.objectContaining({ name: 'FileSystemTool_list_files' })
        })])
      });
      expect(events).toContainEqual({ type: 'done', fullContent: expect.any(String) });
      // Exactly one DONE event
      const doneEvents = events.filter(e => e.type === 'done');
      expect(doneEvents).toHaveLength(1);
    });
  });

  describe('executeStreaming() - multiple tool calls in one action phase', () => {
    test('executes only first tool call', async () => {
      if (!TwoStageProtocol) {
        throw new Error('TwoStageProtocol module not found');
      }
      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        yield { chunk: 'I will list files and read a file' };
        yield { 
          toolCalls: [
            {
              function: {
                name: 'FileSystemTool_list_files',
                arguments: JSON.stringify({ path: '.' })
              },
              id: 'call_1',
              type: 'function'
            },
            {
              function: {
                name: 'FileSystemTool_read_file',
                arguments: JSON.stringify({ path: 'file.txt' })
              },
              id: 'call_2',
              type: 'function'
            }
          ]
        };
        yield { done: true, fullContent: '' };
      });

      ToolRunner.executeToolCalls.mockResolvedValue([{
        toolName: 'FileSystemTool_list_files',
        result: ['file1.txt'],
        success: true
      }]);

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'List and read' }],
        mode: 'act',
        projectId: 'test',
        requestId: 'req',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        config: { maxPhaseCycles: 3 }
      });

      const events = [];
      for await (const event of protocol.executeStreaming(context)) {
        events.push(event);
      }

      // ToolRunner should be called only once with first tool call
      expect(ToolRunner.executeToolCalls).toHaveBeenCalledTimes(1);
      expect(ToolRunner.executeToolCalls).toHaveBeenCalledWith(
        mockTools,
        [expect.objectContaining({ id: 'call_1' })],
        expect.anything()
      );
      // Should have a DONE event
      const doneEvents = events.filter(e => e.type === 'done');
      expect(doneEvents.length).toBeGreaterThan(0);
    });
  });

  describe('executeStreaming() - no tool calls', () => {
    test('yields final answer directly', async () => {
      if (!TwoStageProtocol) {
        throw new Error('TwoStageProtocol module not found');
      }
      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        yield { chunk: 'I can answer without tools.' };
        yield { done: true, fullContent: 'Final answer without tools' };
      });

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'act',
        projectId: 'test',
        requestId: 'req',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        config: { maxPhaseCycles: 3 }
      });

      const events = [];
      for await (const event of protocol.executeStreaming(context)) {
        events.push(event);
      }

      // No tool execution
      expect(ToolRunner.executeToolCalls).not.toHaveBeenCalled();
      // Should have CHUNK and DONE events
      expect(events).toContainEqual({ type: 'chunk', content: 'I can answer without tools.' });
      expect(events).toContainEqual({ type: 'done', fullContent: 'Final answer without tools' });
    });
  });

  describe('executeStreaming() - duplicate tool call', () => {
    test('injects refusal message and does not execute duplicate', async () => {
      if (!TwoStageProtocol) {
        throw new Error('TwoStageProtocol module not found');
      }
      // First adapter call yields tool call
      let callCount = 0;
      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        if (callCount === 0) {
          yield { chunk: 'First call' };
          yield { 
            toolCalls: [{
              function: {
                name: 'FileSystemTool_list_files',
                arguments: JSON.stringify({ path: '.' })
              },
              id: 'call_1',
              type: 'function'
            }]
          };
          yield { done: true, fullContent: '' };
        } else {
          // Second adapter call (after tool result) yields same tool call again
          yield { chunk: 'Trying again' };
          yield { 
            toolCalls: [{
              function: {
                name: 'FileSystemTool_list_files',
                arguments: JSON.stringify({ path: '.' })
              },
              id: 'call_2',
              type: 'function'
            }]
          };
          yield { done: true, fullContent: '' };
        }
        callCount++;
      });

      ToolRunner.executeToolCalls.mockResolvedValue([{
        toolName: 'FileSystemTool_list_files',
        result: ['file1.txt'],
        success: true
      }]);

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'List files' }],
        mode: 'act',
        projectId: 'test',
        requestId: 'req',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        config: { maxPhaseCycles: 3, maxDuplicateAttempts: 3 }
      });

      const events = [];
      for await (const event of protocol.executeStreaming(context)) {
        events.push(event);
      }

      // ToolRunner should be called only once (first execution)
      expect(ToolRunner.executeToolCalls).toHaveBeenCalledTimes(1);
      // Should have a refusal chunk (system notice)
      const refusalChunks = events.filter(e => 
        e.type === 'chunk' && e.content.includes('Duplicate tool call detected')
      );
      expect(refusalChunks.length).toBeGreaterThan(0);
    });
  });

  describe('executeStreaming() - duplicateExceeded', () => {
    test('forces final answer after maxDuplicateAttempts exceeded', async () => {
      if (!TwoStageProtocol) {
        throw new Error('TwoStageProtocol module not found');
      }
      // Simulate duplicate attempts exceeding maxDuplicateAttempts
      // We'll mock adapter to yield same tool call multiple times
      let callCount = 0;
      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        yield { chunk: `Attempt ${callCount + 1}` };
        yield { 
          toolCalls: [{
            function: {
              name: 'FileSystemTool_list_files',
              arguments: JSON.stringify({ path: '.' })
            },
            id: `call_${callCount}`,
            type: 'function'
          }]
        };
        yield { done: true, fullContent: '' };
        callCount++;
      });

      ToolRunner.executeToolCalls.mockResolvedValue([{
        toolName: 'FileSystemTool_list_files',
        result: ['file1.txt'],
        success: true
      }]);

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'List files' }],
        mode: 'act',
        projectId: 'test',
        requestId: 'req',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        config: { maxPhaseCycles: 3, maxDuplicateAttempts: 2 } // low limit
      });

      const events = [];
      for await (const event of protocol.executeStreaming(context)) {
        events.push(event);
      }

      // Should have a system notice about maximum duplicate attempts
      const duplicateExceededChunks = events.filter(e => 
        e.type === 'chunk' && e.content.includes('Maximum duplicate tool call attempts exceeded')
      );
      expect(duplicateExceededChunks.length).toBeGreaterThan(0);
      // Should have a DONE event
      const doneEvents = events.filter(e => e.type === 'done');
      expect(doneEvents).toHaveLength(1);
      // ToolRunner should be called only once (first execution before duplicates)
      expect(ToolRunner.executeToolCalls).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeStreaming() - budget exhaustion (maxPhaseCycles)', () => {
    test('forces final answer after maxPhaseCycles reached', async () => {
      if (!TwoStageProtocol) {
        throw new Error('TwoStageProtocol module not found');
      }
      // Simulate tool calls up to maxPhaseCycles with distinct arguments to avoid duplicate detection
      let invocationCount = 0;
      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        const currentInvocation = invocationCount++;
        yield { chunk: `Tool ${currentInvocation + 1}` };
        yield { 
          toolCalls: [{
            function: {
              name: 'FileSystemTool_list_files',
              arguments: JSON.stringify({ path: `./dir${currentInvocation}` })
            },
            id: `call_${currentInvocation}`,
            type: 'function'
          }]
        };
        yield { done: true, fullContent: '' };
      });

      ToolRunner.executeToolCalls.mockResolvedValue([{
        toolName: 'FileSystemTool_list_files',
        result: ['file1.txt'],
        success: true
      }]);

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Use many tools' }],
        mode: 'act',
        projectId: 'test',
        requestId: 'req',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        config: { maxPhaseCycles: 2, maxDuplicateAttempts: 10 } // high duplicate attempts to avoid triggering
      });

      const events = [];
      for await (const event of protocol.executeStreaming(context)) {
        events.push(event);
      }

      // Should have a system notice about maximum tool execution cycles
      const budgetExhaustedChunks = events.filter(e => 
        e.type === 'chunk' && e.content.includes('Maximum tool execution cycles')
      );
      expect(budgetExhaustedChunks.length).toBeGreaterThan(0);
      // Should have a DONE event
      const doneEvents = events.filter(e => e.type === 'done');
      expect(doneEvents).toHaveLength(1);
      // ToolRunner should be called exactly maxPhaseCycles times (2)
      expect(ToolRunner.executeToolCalls).toHaveBeenCalledTimes(2);
    });
  });

  describe('executeStreaming() - ProtocolEvent emissions', () => {
    test('emits PHASE events for each phase', async () => {
      if (!TwoStageProtocol) {
        throw new Error('TwoStageProtocol module not found');
      }
      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        yield { chunk: 'Action phase' };
        yield { 
          toolCalls: [{
            function: { name: 'FileSystemTool_list_files', arguments: '{}' },
            id: 'call_1',
            type: 'function'
          }]
        };
        yield { done: true, fullContent: '' };
      });

      ToolRunner.executeToolCalls.mockResolvedValue([{
        toolName: 'FileSystemTool_list_files',
        result: [],
        success: true
      }]);

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Test' }],
        mode: 'act',
        projectId: 'test',
        requestId: 'req',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        config: { maxPhaseCycles: 3 }
      });

      const events = [];
      for await (const event of protocol.executeStreaming(context)) {
        events.push(event);
      }

      // Should have at least one PHASE event
      const phaseEvents = events.filter(e => e.type === 'phase');
      expect(phaseEvents.length).toBeGreaterThan(0);
      // PHASE event should have phase and index properties
      expect(phaseEvents[0]).toHaveProperty('phase', expect.stringMatching(/action|tool/));
      expect(phaseEvents[0]).toHaveProperty('index', expect.any(Number));
    });
  });
});
