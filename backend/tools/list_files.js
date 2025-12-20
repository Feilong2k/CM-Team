/**
 * Utility to recursively list files and directories for ContextBuilder.
 * Returns a directory tree structure, optionally filtered by extension or ignore patterns.
 * Usage: node list_files.js [rootDir] [--json]
 */

const fs = require('fs');
const path = require('path');

function listFiles(dir, base = dir, ignore = null) {
  const result = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(base, fullPath);
    
    // Check if this entry should be ignored
    if (ignore && typeof ignore.ignores === 'function') {
      // For directories, also check with trailing slash to match directory-specific patterns
      const ignorePath = entry.isDirectory() ? relPath + '/' : relPath;
      if (ignore.ignores(ignorePath)) {
        continue; // Skip this entry entirely
      }
    }
    
    if (entry.isDirectory()) {
      result.push({
        type: 'directory',
        name: entry.name,
        path: relPath,
        children: listFiles(fullPath, base, ignore)
      });
    } else {
      result.push({
        type: 'file',
        name: entry.name,
        path: relPath
      });
    }
  }
  return result;
}

// CLI usage
if (require.main === module) {
  const { loadIgnorePatterns } = require('./ignore_utils');
  const rootDir = process.argv[2] || process.cwd();
  const asJson = process.argv.includes('--json');
  const noIgnore = process.argv.includes('--no-ignore');
  
  let ignoreInstance = null;
  if (!noIgnore) {
    ignoreInstance = loadIgnorePatterns(rootDir);
  }
  
  const tree = listFiles(rootDir, rootDir, ignoreInstance);
  if (asJson) {
    console.log(JSON.stringify(tree, null, 2));
  } else {
    function printTree(nodes, prefix = '') {
      for (const node of nodes) {
        console.log(prefix + (node.type === 'directory' ? '📁 ' : '📄 ') + node.name);
        if (node.type === 'directory') {
          printTree(node.children, prefix + '  ');
        }
      }
    }
    printTree(tree);
  }
}

module.exports = { listFiles };
