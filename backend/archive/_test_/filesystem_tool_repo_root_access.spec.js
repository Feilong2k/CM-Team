/**
 * @jest-environment node
 */

jest.mock('../../src/services/trace/TraceService', () => ({
  logEvent: jest.fn(),
  getEvents: jest.fn(),
}));

const path = require('path');
const fileSystemTool = require('../../tools/FileSystemTool');

describe('FileSystemTool repo-root normalization', () => {
  test('can read .Docs prompt file even when process.cwd() is backend/', async () => {
    const originalCwd = process.cwd();
    const repoRoot = path.resolve(__dirname, '../../..');
    const backendDir = path.join(repoRoot, 'backend');

    // Simulate server being launched from ./backend
    process.chdir(backendDir);

    try {
      const content = await fileSystemTool.tools.read_file({
        path: 'docs/01-AGENTS/01-Orion/prompts/SystemPrompt_Orion.md',
      });

      expect(typeof content).toBe('string');
      expect(content).toMatch(/Orion/i);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
