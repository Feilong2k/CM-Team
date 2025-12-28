/**
 * Tests for F2-T0-S3: Filesystem Context Tools (list_files and search_files)
 * These tests verify correct directory tree output, file search, and error handling.
 */

const fs = require('fs');
const path = require('path');
const { listFiles } = require('../../tools/list_files');
const { searchFiles } = require('../../tools/search_files');

const TEST_ROOT = path.join(__dirname, '__context_tools_testdata__');

// Mock ignore instance for testing .gitignore support
function createIgnore(patterns) {
  return {
    ignores: (filePath) => {
      // Simple pattern matching for tests
      for (const pattern of patterns) {
        if (pattern.endsWith('/')) {
          // Directory pattern
          if (filePath.includes(pattern.slice(0, -1))) {
            return true;
          }
        } else if (pattern.includes('*')) {
          // Simple glob matching (just for tests)
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          if (regex.test(filePath)) {
            return true;
          }
        } else {
          // Exact match
          if (filePath === pattern || filePath.endsWith('/' + pattern)) {
            return true;
          }
        }
      }
      return false;
    }
  };
}

beforeAll(() => {
  // Setup: create a test directory structure
  fs.mkdirSync(TEST_ROOT, { recursive: true });
  fs.writeFileSync(path.join(TEST_ROOT, 'file1.txt'), 'hello world\nfoo bar');
  fs.writeFileSync(path.join(TEST_ROOT, 'file2.js'), 'const x = 42;\nfunction test() {}');
  fs.mkdirSync(path.join(TEST_ROOT, 'subdir'), { recursive: true });
  fs.writeFileSync(path.join(TEST_ROOT, 'subdir', 'file3.md'), '# Markdown\nsearch me');
});

afterAll(() => {
  // Cleanup: remove test directory recursively
  function rmDirRecursive(dir) {
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach((file) => {
        const curPath = path.join(dir, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          rmDirRecursive(curPath);
        } else {
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(dir);
    }
  }
  rmDirRecursive(TEST_ROOT);
});

describe('listFiles utility', () => {
  it('should return a correct directory tree structure', () => {
    const tree = listFiles(TEST_ROOT);
    // Root should have 3 entries: file1.txt, file2.js, subdir
    const names = tree.map(n => n.name).sort();
    expect(names).toEqual(['file1.txt', 'file2.js', 'subdir']);
    const subdir = tree.find(n => n.name === 'subdir');
    expect(subdir).toBeDefined();
    expect(subdir.type).toBe('directory');
    expect(subdir.children.length).toBe(1);
    expect(subdir.children[0].name).toBe('file3.md');
  });
});

describe('searchFiles utility', () => {
  it('should find lines matching a regex in all files', () => {
    const results = searchFiles(TEST_ROOT, /foo|const|search/i);
    const files = results.map(r => r.file);
    expect(files).toContain('file1.txt');
    expect(files).toContain('file2.js');
    expect(files).toContain(path.join('subdir', 'file3.md'));
    // Check that the correct lines are matched
    const file1Match = results.find(r => r.file === 'file1.txt');
    expect(file1Match.match).toBe('foo bar');
    const file2Match = results.find(r => r.file === 'file2.js');
    expect(file2Match.match).toMatch(/const x = 42;|function test\(\) \{\}/);
    const file3Match = results.find(r => r.file.endsWith('file3.md'));
    expect(file3Match.match).toBe('search me');
  });

  it('should return an empty array if no matches are found', () => {
    const results = searchFiles(TEST_ROOT, /notfound/);
    expect(results).toEqual([]);
  });

  it('should handle unreadable files gracefully', () => {
    // Create a binary file
    const binPath = path.join(TEST_ROOT, 'binfile.bin');
    fs.writeFileSync(binPath, Buffer.from([0, 1, 2, 3, 4]));
    // Should not throw
    expect(() => searchFiles(TEST_ROOT, /foo/)).not.toThrow();
    // Clean up
    fs.unlinkSync(binPath);
  });
});

describe('listFiles with .gitignore support', () => {
  it('should skip files matching ignore patterns', () => {
    // Create ignore instance that ignores *.js files
    const ignore = createIgnore(['*.js']);
    const tree = listFiles(TEST_ROOT, TEST_ROOT, ignore);
    const names = tree.map(n => n.name).sort();
    // Should not include file2.js
    expect(names).toEqual(['file1.txt', 'subdir']);
    // subdir should still have file3.md
    const subdir = tree.find(n => n.name === 'subdir');
    expect(subdir.children[0].name).toBe('file3.md');
  });

  it('should prune directories matching ignore patterns', () => {
    // Create ignore instance that ignores subdir/
    const ignore = createIgnore(['subdir/']);
    const tree = listFiles(TEST_ROOT, TEST_ROOT, ignore);
    const names = tree.map(n => n.name).sort();
    // Should not include subdir at all
    expect(names).toEqual(['file1.txt', 'file2.js']);
  });

  it('should handle empty ignore instance (no filtering)', () => {
    const ignore = createIgnore([]);
    const tree = listFiles(TEST_ROOT, TEST_ROOT, ignore);
    const names = tree.map(n => n.name).sort();
    // Should include all files
    expect(names).toEqual(['file1.txt', 'file2.js', 'subdir']);
  });
});

describe('searchFiles with .gitignore support', () => {
  it('should skip ignored files when searching', () => {
    // Create ignore instance that ignores *.js files
    const ignore = createIgnore(['*.js']);
    const results = searchFiles(TEST_ROOT, /foo|const|search/i, TEST_ROOT, [], ignore);
    const files = results.map(r => r.file);
    // Should not include file2.js (ignored)
    expect(files).toContain('file1.txt');
    expect(files).toContain(path.join('subdir', 'file3.md'));
    expect(files).not.toContain('file2.js');
  });

  it('should not descend into ignored directories', () => {
    // Create ignore instance that ignores subdir/
    const ignore = createIgnore(['subdir/']);
    const results = searchFiles(TEST_ROOT, /search/i, TEST_ROOT, [], ignore);
    // Should not find matches in subdir/file3.md
    expect(results).toHaveLength(0);
  });

  it('should handle empty ignore instance (no filtering)', () => {
    const ignore = createIgnore([]);
    const results = searchFiles(TEST_ROOT, /foo|const|search/i, TEST_ROOT, [], ignore);
    const files = results.map(r => r.file);
    // Should include all files
    expect(files).toContain('file1.txt');
    expect(files).toContain('file2.js');
    expect(files).toContain(path.join('subdir', 'file3.md'));
  });
});
