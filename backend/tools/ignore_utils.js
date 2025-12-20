/**
 * Utilities for loading .gitignore patterns and creating ignore instances.
 */

const fs = require('fs');
const path = require('path');
const ignore = require('ignore');

/**
 * Load ignore patterns from .gitignore files following git's hierarchy.
 * Starts from startDir and walks up parent directories.
 * 
 * @param {string} startDir - Directory to start searching from
 * @returns {Object} An ignore instance with loaded patterns
 */
function loadIgnorePatterns(startDir) {
  const ig = ignore();
  const defaultPatterns = [
    'node_modules/',
    '.git/',
    '*.log',
    '*.tmp',
    '*.temp',
    '.DS_Store',
    'Thumbs.db'
  ];
  
  // Add default patterns
  ig.add(defaultPatterns);
  
  // Walk up from startDir to root
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;
  const gitignorePaths = [];
  
  while (currentDir !== root) {
    const gitignorePath = path.join(currentDir, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      gitignorePaths.unshift(gitignorePath); // Collect from parent to child (lower priority to higher)
    }
    currentDir = path.dirname(currentDir);
  }
  
  // Add patterns from each .gitignore file (parent first, then child)
  for (const gitignorePath of gitignorePaths) {
    try {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      const patterns = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      ig.add(patterns);
    } catch (err) {
      // Silently skip unreadable .gitignore files
      console.warn(`Warning: Could not read ${gitignorePath}: ${err.message}`);
    }
  }
  
  return ig;
}

/**
 * Create an ignore instance with optional patterns.
 * If no patterns provided, returns an instance that ignores nothing.
 * 
 * @param {Array<string>} patterns - Optional array of ignore patterns
 * @returns {Object} An ignore instance
 */
function createIgnore(patterns = []) {
  const ig = ignore();
  if (patterns.length > 0) {
    ig.add(patterns);
  }
  return ig;
}

module.exports = {
  loadIgnorePatterns,
  createIgnore
};
