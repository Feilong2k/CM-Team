
const fs = require('fs');
const path = require('path');
const { listFiles } = require('./list_files');
const { searchFiles } = require('./search_files');

class FileSystemTool {
  constructor() {
    // Define the tool methods map
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
    // Delegate to existing list_files tool logic
    return listFiles(args.path, args.recursive);
  }

  async search_files(args) {
    // Delegate to existing search_files tool logic
    return searchFiles(args.path, args.regex, args.file_pattern);
  }
}

const fileSystemTool = new FileSystemTool();
module.exports = fileSystemTool;
