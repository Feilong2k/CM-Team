
const fs = require('fs');
const path = require('path');
const { listFiles } = require('./list_files');
const { searchFiles } = require('./search_files');

class FileSystemTool {
  constructor() {
    this.tools = {
      read_file: this.read_file.bind(this),
      write_to_file: this.write_to_file.bind(this),
      list_files: this.list_files.bind(this),
      search_files: this.search_files.bind(this)
    };
  }

  // Helper to check if a path is safe (prevent directory traversal)
  _isPathSafe(filePath) {
    const rootDir = process.cwd();
    const absolutePath = path.resolve(rootDir, filePath);
    return absolutePath.startsWith(rootDir);
  }

  async read_file({ path: filePath }) {
    if (!filePath) throw new Error('path is required');
    if (!this._isPathSafe(filePath)) throw new Error('Access denied: Path outside project root');

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  async write_to_file({ path: filePath, content }) {
    if (!filePath || content === undefined) throw new Error('path and content are required');
    if (!this._isPathSafe(filePath)) throw new Error('Access denied: Path outside project root');

    try {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, content, 'utf8');
      return `Successfully wrote to ${filePath}`;
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
  }

  async list_files(args) {
    return listFiles(args.path, args.recursive);
  }

  async search_files(args) {
    return searchFiles(args.path, args.regex, args.file_pattern);
  }
}

// Add trace logging to tool calls
const TraceService = require('../src/services/trace/TraceService');
const { TRACE_TYPES, TRACE_SOURCES } = require('../src/services/trace/TraceEvent');

const originalReadFile = FileSystemTool.prototype.read_file;
const originalWriteToFile = FileSystemTool.prototype.write_to_file;

FileSystemTool.prototype.read_file = async function(args) {
  const { path: filePath, context } = args;
  const projectId = context?.projectId;

  try {
    await TraceService.logEvent({
      projectId,
      type: TRACE_TYPES.TOOL_CALL,
      source: TRACE_SOURCES.TOOL,
      timestamp: Date.now(),
      summary: 'FileSystemTool read_file call',
      details: { filePath },
      requestId: context?.requestId,
    });
  } catch (err) {
    console.error('Trace logging failed for read_file call:', err);
  }

  const result = await originalReadFile.call(this, args);

  try {
    await TraceService.logEvent({
      projectId,
      type: TRACE_TYPES.TOOL_RESULT,
      source: TRACE_SOURCES.TOOL,
      timestamp: Date.now(),
      summary: 'FileSystemTool read_file result',
      details: { result: result.slice(0, 1000) }, // limit size
      requestId: context?.requestId,
    });
  } catch (err) {
    console.error('Trace logging failed for read_file result:', err);
  }

  return result;
};

FileSystemTool.prototype.write_to_file = async function(args) {
  const { path: filePath, content, context } = args;
  const projectId = context?.projectId;

  try {
    await TraceService.logEvent({
      projectId,
      type: TRACE_TYPES.TOOL_CALL,
      source: TRACE_SOURCES.TOOL,
      timestamp: Date.now(),
      summary: 'FileSystemTool write_to_file call',
      details: { filePath, content: content.slice(0, 1000) }, // limit size
      requestId: context?.requestId,
    });
  } catch (err) {
    console.error('Trace logging failed for write_to_file call:', err);
  }

  const result = await originalWriteToFile.call(this, args);

  try {
    await TraceService.logEvent({
      projectId,
      type: TRACE_TYPES.TOOL_RESULT,
      source: TRACE_SOURCES.TOOL,
      timestamp: Date.now(),
      summary: 'FileSystemTool write_to_file result',
      details: { result },
      requestId: context?.requestId,
    });
  } catch (err) {
    console.error('Trace logging failed for write_to_file result:', err);
  }

  return result;
};

const fileSystemTool = new FileSystemTool();
module.exports = fileSystemTool;
