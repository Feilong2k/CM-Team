const fs = require('fs');
const path = require('path');
const { listFiles } = require('./list_files');
const { searchFiles } = require('./search_files');
const { loadIgnorePatterns } = require('./ignore_utils');

class FileSystemTool {
  constructor() {
    this.tools = {
      read_file: this.read_file.bind(this),
      write_to_file: this.write_to_file.bind(this),
      list_files: this.list_files.bind(this),
      search_files: this.search_files.bind(this)
    };
  }

  // Helper to get repo root regardless of where the server was launched from.
  // This file lives at: <repoRoot>/backend/tools/FileSystemTool.js
  // so repoRoot is two levels up from __dirname.
  _getRepoRoot() {
    return path.resolve(__dirname, '..', '..');
  }

  // Helper to check if a path is safe (prevent directory traversal)
  _isPathSafe(filePath) {
    const rootDir = this._getRepoRoot();
    const absolutePath = path.resolve(rootDir, filePath);
    return absolutePath.startsWith(rootDir);
  }

  // Common validation for path-based operations
  _validatePathOperation(filePath, operationName = 'operation') {
    if (!filePath) throw new Error('path is required');
    if (!this._isPathSafe(filePath)) {
      throw new Error('Access denied: Path outside project root');
    }
  }

  // Common logic to resolve paths and load ignore patterns
  _prepareFileOperation(filePath, no_ignore) {
    const rootDir = this._getRepoRoot();
    const absolutePath = path.resolve(rootDir, filePath);

    let ignoreInstance = null;
    if (no_ignore !== true) {
      // Load ignore patterns following git hierarchy (child .gitignore overrides parent).
      // Start from the target path so nested .gitignore files are respected.
      ignoreInstance = loadIgnorePatterns(absolutePath);
    }

    return { rootDir, absolutePath, ignoreInstance };
  }

  async read_file({ path: filePath }) {
    this._validatePathOperation(filePath, 'read_file');

    const { absolutePath } = this._prepareFileOperation(filePath, true);

    try {
      const content = await fs.promises.readFile(absolutePath, 'utf8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  async write_to_file({ path: filePath, content }) {
    if (!filePath || content === undefined) throw new Error('path and content are required');
    this._validatePathOperation(filePath, 'write_to_file');

    const { absolutePath } = this._prepareFileOperation(filePath, true);

    try {
      await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.promises.writeFile(absolutePath, content, 'utf8');
      return `Successfully wrote to ${filePath}`;
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
  }

  async list_files({ path: filePath, recursive, no_ignore, context }) {
    this._validatePathOperation(filePath, 'list_files');

    const { rootDir, absolutePath, ignoreInstance } = this._prepareFileOperation(filePath, no_ignore);

    const result = listFiles(absolutePath, rootDir, ignoreInstance);

    // If recursive is false, filter to only one level deep
    if (recursive === false) {
      return this._filterToFirstLevel(result);
    }

    return result;
  }

  async search_files({ path: filePath, regex, file_pattern, no_ignore, context }) {
    this._validatePathOperation(filePath, 'search_files');

    if (!regex) throw new Error('regex is required');
    if (typeof regex !== 'string') throw new Error('regex must be a string');

    // Compile regex with case-insensitive flag by default
    let compiledRegex;
    try {
      compiledRegex = new RegExp(regex, 'i');
    } catch (error) {
      throw new Error(`Invalid regex: ${error.message}`);
    }

    const { rootDir, absolutePath, ignoreInstance } = this._prepareFileOperation(filePath, no_ignore);

    // Note: file_pattern parameter is currently not implemented in searchFiles helper
    // but we keep it in the signature for future compatibility
    return searchFiles(absolutePath, compiledRegex, rootDir, [], ignoreInstance);
  }

  // Helper to filter tree to first level only
  _filterToFirstLevel(tree) {
    return tree.map(item => {
      if (item.type === 'directory') {
        // Return directory without children
        return {
          type: 'directory',
          name: item.name,
          path: item.path,
          children: []
        };
      }
      return item;
    });
  }
}

const fileSystemTool = new FileSystemTool();
module.exports = fileSystemTool;
