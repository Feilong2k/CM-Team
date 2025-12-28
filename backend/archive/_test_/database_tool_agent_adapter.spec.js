/**
 * Tests for F2-T1: DatabaseToolAgentAdapter.get_subtask_full_context
 *
 * RED stage: These tests define the expected behavior of the thin agent adapter
 * that bridges DeepSeek/OpenAI-style tool calls (single args object) to the
 * existing DatabaseTool positional API.
 *
 * The adapter is expected to:
 * - Accept a single arguments object: { subtask_id, project_id?, context? }
 * - Derive projectId from args.project_id or context.projectId (in that order)
 * - Delegate to DatabaseTool.get_subtask_full_context(subtaskId, projectId)
 * - Propagate DatabaseTool errors without masking their messages
 * - Throw clear, adapter-level errors when required inputs are missing
 *
 * These tests MUST fail until Devon implements DatabaseToolAgentAdapter with
 * the correct behavior and wiring.
 */

// Mock the underlying DatabaseTool default instance so we can assert how the
// adapter calls it, without hitting a real database.
jest.mock('../../tools/DatabaseTool', () => {
  return {
    // The adapter is expected to import this default export and call
    // get_subtask_full_context(subtaskId, projectId)
    get_subtask_full_context: jest.fn(),
  };
});

const DatabaseTool = require('../../tools/DatabaseTool');

// The adapter under test: should expose get_subtask_full_context(args)
const adapter = require('../../tools/DatabaseToolAgentAdapter');

describe('DatabaseToolAgentAdapter.get_subtask_full_context', () => {
  beforeEach(() => {
    if (DatabaseTool.get_subtask_full_context && DatabaseTool.get_subtask_full_context.mockReset) {
      DatabaseTool.get_subtask_full_context.mockReset();
    }
  });

  it('forwards subtask_id and explicit project_id as positional arguments', async () => {
    // Arrange: underlying DatabaseTool returns a realistic-looking payload
    const dbResult = {
      ok: true,
      subtask: {
        external_id: 'P1-F2-T0-S7',
        title: 'Test subtask',
      },
    };
    DatabaseTool.get_subtask_full_context.mockResolvedValueOnce(dbResult);

    const args = {
      subtask_id: '2-1-1',
      project_id: 'P1',
      context: {
        projectId: 'IGNORED_CONTEXT_PROJECT', // should be ignored when project_id is explicit
      },
    };

    // Act
    const result = await adapter.get_subtask_full_context(args);

    // Assert: adapter must delegate correctly and return the DB result
    expect(DatabaseTool.get_subtask_full_context).toHaveBeenCalledTimes(1);
    expect(DatabaseTool.get_subtask_full_context).toHaveBeenCalledWith('2-1-1', 'P1');
    expect(result).toEqual(dbResult);
  });

  it('derives project_id from context.projectId when not provided explicitly', async () => {
    DatabaseTool.get_subtask_full_context.mockResolvedValueOnce({ ok: true });

    const args = {
      subtask_id: '2-1-1',
      // no project_id here
      context: {
        projectId: 'P1',
      },
    };

    await adapter.get_subtask_full_context(args);

    expect(DatabaseTool.get_subtask_full_context).toHaveBeenCalledTimes(1);
    expect(DatabaseTool.get_subtask_full_context).toHaveBeenCalledWith('2-1-1', 'P1');
  });

  it('propagates DatabaseTool errors without masking their messages', async () => {
    DatabaseTool.get_subtask_full_context.mockRejectedValueOnce(
      new Error('MISSING_PROJECT_CONTEXT'),
    );

    const args = {
      subtask_id: '2-1-1',
      // no project_id and no context.projectId → underlying tool decides how to fail
    };

    await expect(adapter.get_subtask_full_context(args)).rejects.toThrow(
      /MISSING_PROJECT_CONTEXT/,
    );
  });

  it('throws a clear error when subtask_id is missing', async () => {
    const args = {
      project_id: 'P1',
      context: { projectId: 'P1' },
    };

    await expect(adapter.get_subtask_full_context(args)).rejects.toThrow(
      /subtask_id.*required/i,
    );

    // Underlying DatabaseTool must NOT be called when the adapter-level
    // validation fails.
    expect(DatabaseTool.get_subtask_full_context).not.toHaveBeenCalled();
  });

  it('throws a clear error when args is not an object', async () => {
    await expect(adapter.get_subtask_full_context(null)).rejects.toThrow(
      /args.*object/i,
    );
    await expect(
      // @ts-expect-error – intentionally passing a non-object
      adapter.get_subtask_full_context('not-an-object'),
    ).rejects.toThrow(/args.*object/i);

    expect(DatabaseTool.get_subtask_full_context).not.toHaveBeenCalled();
  });
});
