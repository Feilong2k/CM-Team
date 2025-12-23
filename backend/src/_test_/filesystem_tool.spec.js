/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');

// Mock TraceService
jest.mock('../../src/services/trace/TraceService', () => ({
  logEvent: jest.fn(),
  getEvents: jest.fn(),
}));

const fileSystemTool = require('../../tools/FileSystemTool');
const ToolRunner = require('../../tools/ToolRunner');

describe('FileSystemTool compatibility with Orion tool-calling (2-1-18)', () => {
  let repoRoot;
  let tempDir;
  let tools;

  beforeEach(() => {
    // Tests may run with cwd=backend/ depending on how npm/jest is invoked.
    // FileSystemTool treats repo root as the safe root, so compute all relative paths from repo root.
    repoRoot = path.resolve(__dirname, '../../..');

    // Create a temporary directory for test fixtures WITHIN repo root.
    tempDir = fs.mkdtempSync(path.join(repoRoot, 'test-fs-tool-'));

    // Use the exported instance
    tools = {
      FileSystemTool: fileSystemTool.tools,
    };

    // Reset ToolRunner state between tests
    ToolRunner.perRequestDuplicateTracker.clear();
  });

  afterEach(() => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // Helper to create a test file
  const createTestFile = (relativePath, content = 'test content') => {
    const fullPath = path.join(tempDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
    return fullPath;
  };

  // Helper to create .gitignore file
  const createGitignore = (patterns) => {
    const gitignorePath = path.join(tempDir, '.gitignore');
    fs.writeFileSync(gitignorePath, patterns.join('\n'), 'utf8');
    return gitignorePath;
  };

  describe('A) Single-args object contract', () => {
    test('read_file accepts single args object, rejects positional args', async () => {
      const testFile = createTestFile('test.txt', 'content');
      const relPath = path.relative(repoRoot, testFile);

      // Should work with args object
      const result = await fileSystemTool.tools.read_file({ path: relPath });
      expect(result).toBe('content');

      // Should fail with positional args
      await expect(fileSystemTool.tools.read_file(relPath)).rejects.toThrow();
    });

    test('write_to_file accepts single args object, rejects positional args', async () => {
      const testFile = path.join(tempDir, 'write-test.txt');
      const relPath = path.relative(repoRoot, testFile);

      // Should work with args object
      const result = await fileSystemTool.tools.write_to_file({
        path: relPath,
        content: 'test content',
      });
      expect(result).toContain('Successfully wrote');

      // Should fail with positional args
      await expect(fileSystemTool.tools.write_to_file(relPath, 'content')).rejects.toThrow();
    });

    test('list_files accepts single args object, rejects positional args', async () => {
      createTestFile('dir1/file1.txt');
      createTestFile('dir1/file2.txt');
      const relPath = path.relative(repoRoot, tempDir);

      // Should work with args object
      const result = await fileSystemTool.tools.list_files({ path: relPath, recursive: true });
      expect(Array.isArray(result)).toBe(true);

      // Should fail with positional args
      await expect(fileSystemTool.tools.list_files(relPath, true)).rejects.toThrow();
    });

    test('search_files accepts single args object, rejects positional args', async () => {
      createTestFile('search-test.txt', 'find this pattern');
      const relPath = path.relative(repoRoot, tempDir);

      // Should work with args object
      const result = await fileSystemTool.tools.search_files({
        path: relPath,
        regex: 'find this',
      });
      expect(Array.isArray(result)).toBe(true);

      // Should fail with positional args
      await expect(fileSystemTool.tools.search_files(relPath, 'find this')).rejects.toThrow();
    });
  });

  describe('B) .gitignore auto-ignore by default (with opt-out)', () => {
    const flattenFiles = (items) => {
      const files = [];
      for (const item of items) {
        if (item.type === 'file') {
          files.push(item.name);
        } else if (item.type === 'directory' && item.children) {
          files.push(...flattenFiles(item.children));
        }
      }
      return files;
    };

    test('list_files respects .gitignore by default', async () => {
      createTestFile('ignored.txt', 'should be ignored');
      createTestFile('included.txt', 'should be included');

      createGitignore(['ignored.txt']);

      const relPath = path.relative(repoRoot, tempDir);

      const result = await fileSystemTool.tools.list_files({ path: relPath });
      const fileNames = flattenFiles(result);

      expect(fileNames).toContain('included.txt');
      expect(fileNames).not.toContain('ignored.txt');
    });

    test('list_files includes ignored files when no_ignore: true', async () => {
      createTestFile('ignored.txt', 'should be ignored');
      createTestFile('included.txt', 'should be included');

      createGitignore(['ignored.txt']);

      const relPath = path.relative(repoRoot, tempDir);

      const result = await fileSystemTool.tools.list_files({
        path: relPath,
        no_ignore: true,
      });

      const fileNames = flattenFiles(result);
      expect(fileNames).toContain('included.txt');
      expect(fileNames).toContain('ignored.txt');
    });

    test('search_files respects .gitignore by default', async () => {
      createTestFile('ignored.txt', 'search for this pattern');
      createTestFile('included.txt', 'search for this pattern');
      createGitignore(['ignored.txt']);

      const relPath = path.relative(repoRoot, tempDir);

      const result = await fileSystemTool.tools.search_files({
        path: relPath,
        regex: 'search for this',
      });

      const ignoredFiles = result.filter((r) => r.file.includes('ignored.txt'));
      const includedFiles = result.filter((r) => r.file.includes('included.txt'));

      expect(includedFiles.length).toBeGreaterThan(0);
      expect(ignoredFiles.length).toBe(0);
    });

    test('search_files includes ignored files when no_ignore: true', async () => {
      createTestFile('ignored.txt', 'search for this pattern');
      createTestFile('included.txt', 'search for this pattern');
      createGitignore(['ignored.txt']);

      const relPath = path.relative(repoRoot, tempDir);

      const result = await fileSystemTool.tools.search_files({
        path: relPath,
        regex: 'search for this',
        no_ignore: true,
      });

      const ignoredFiles = result.filter((r) => r.file.includes('ignored.txt'));
      const includedFiles = result.filter((r) => r.file.includes('included.txt'));

      expect(includedFiles.length).toBeGreaterThan(0);
      expect(ignoredFiles.length).toBeGreaterThan(0);
    });
  });

  describe('C) All errors are propagated to Orion', () => {
    test('read_file with missing path produces error via ToolRunner', async () => {
      const toolCall = {
        id: 'call_1',
        type: 'function',
        function: {
          name: 'FileSystemTool_read_file',
          arguments: JSON.stringify({}),
        },
      };

      const results = await ToolRunner.executeToolCalls(tools, [toolCall], {});

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('path is required');
    });

    test('search_files with invalid regex produces error via ToolRunner', async () => {
      const toolCall = {
        id: 'call_1',
        type: 'function',
        function: {
          name: 'FileSystemTool_search_files',
          arguments: JSON.stringify({
            path: '.',
            regex: '[',
          }),
        },
      };

      const results = await ToolRunner.executeToolCalls(tools, [toolCall], {});

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('regex');
    });

    test('directory traversal attempts produce clear error', async () => {
      const toolCall = {
        id: 'call_1',
        type: 'function',
        function: {
          name: 'FileSystemTool_read_file',
          arguments: JSON.stringify({
            path: '../outside.txt',
          }),
        },
      };

      const results = await ToolRunner.executeToolCalls(tools, [toolCall], {});

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Access denied');
    });
  });

  describe('D) Minimal process metadata on every ToolRunner result item', () => {
    const requiredMetadataFields = ['success', 'attempts', 'timestamp', 'toolCallId'];

    test('successful results include all metadata fields', async () => {
      const testFile = createTestFile('metadata-test.txt', 'content');
      const relPath = path.relative(repoRoot, testFile);

      const toolCall = {
        id: 'call_success',
        type: 'function',
        function: {
          name: 'FileSystemTool_read_file',
          arguments: JSON.stringify({ path: relPath }),
        },
      };

      const results = await ToolRunner.executeToolCalls(tools, [toolCall], {});

      expect(results).toHaveLength(1);
      const result = results[0];

      requiredMetadataFields.forEach((field) => {
        expect(result).toHaveProperty(field);
      });

      expect(result.success).toBe(true);
      expect(typeof result.attempts).toBe('number');
      expect(result.attempts).toBeGreaterThan(0);
      expect(typeof result.timestamp).toBe('string');
      expect(result.toolCallId).toBe('call_success');
    });

    test('error results include all metadata fields', async () => {
      const toolCall = {
        id: 'call_error',
        type: 'function',
        function: {
          name: 'FileSystemTool_read_file',
          arguments: JSON.stringify({}),
        },
      };

      const results = await ToolRunner.executeToolCalls(tools, [toolCall], {});

      expect(results).toHaveLength(1);
      const result = results[0];

      requiredMetadataFields.forEach((field) => {
        expect(result).toHaveProperty(field);
      });

      expect(result.success).toBe(false);
      expect(typeof result.attempts).toBe('number');
      expect(typeof result.timestamp).toBe('string');
      expect(result.toolCallId).toBe('call_error');
      expect(result.error).toBeDefined();
    });

    test('DUPLICATE_BLOCKED results include all metadata fields', async () => {
      const testFile = createTestFile('duplicate-test.txt', 'content');
      const relPath = path.relative(repoRoot, testFile);

      const toolCall = {
        id: 'call_duplicate',
        type: 'function',
        function: {
          name: 'FileSystemTool_read_file',
          arguments: JSON.stringify({ path: relPath }),
        },
      };

      const context = { requestId: 'dup-test' };

      const firstResults = await ToolRunner.executeToolCalls(tools, [toolCall], context);
      expect(firstResults[0].success).toBe(true);

      const secondResults = await ToolRunner.executeToolCalls(tools, [toolCall], context);

      expect(secondResults).toHaveLength(1);
      const result = secondResults[0];

      requiredMetadataFields.forEach((field) => {
        expect(result).toHaveProperty(field);
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('DUPLICATE_BLOCKED');
      expect(typeof result.attempts).toBe('number');
      expect(typeof result.timestamp).toBe('string');
      expect(result.toolCallId).toBe('call_duplicate');
    });
  });

  describe('Integration: Full tool call flow', () => {
    test('complete happy path with ToolRunner', async () => {
      const testFile = createTestFile('integration-test.txt', 'Hello World');
      const relPath = path.relative(repoRoot, testFile);

      const toolCall = {
        id: 'call_integration',
        type: 'function',
        function: {
          name: 'FileSystemTool_read_file',
          arguments: JSON.stringify({ path: relPath }),
        },
      };

      const results = await ToolRunner.executeToolCalls(tools, [toolCall], {
        projectId: 'test-project',
        requestId: 'test-request',
      });

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.success).toBe(true);
      expect(result.toolCallId).toBe('call_integration');
      expect(result.attempts).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
      expect(result.result).toBe('Hello World');
    });
  });
});
