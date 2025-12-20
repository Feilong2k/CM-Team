/**
 * Utility to recursively search files for a regex pattern for ContextBuilder.
 * Usage: node search_files.js [rootDir] [pattern] [--json]
 */

const fs = require('fs');
const path = require('path');

function searchFiles(dir, regex, base = dir, results = [], ignore = null) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(base, fullPath);
    
    // Check if this entry should be ignored
    if (ignore && typeof ignore.ignores === 'function') {
      // For directories, also check with trailing slash to match directory-specific patterns
      const ignorePath = entry.isDirectory() ? relPath + '/' : relPath;
      if (ignore.ignores(ignorePath)) {
        continue; // Skip this entry entirely (directory or file)
      }
    }
    
    if (entry.isDirectory()) {
      searchFiles(fullPath, regex, base, results, ignore);
    } else {
      let content;
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue; // Skip unreadable/binary files
      }
      content.split('\n').forEach((line, idx) => {
        if (regex.test(line)) {
          results.push({
            file: relPath,
            line: idx + 1,
            match: line.trim()
          });
        }
      });
    }
  }
  return results;
}

// CLI usage
if (require.main === module) {
  const { loadIgnorePatterns } = require('./ignore_utils');
  const rootDir = process.argv[2] || process.cwd();
  const pattern = process.argv[3];
  const asJson = process.argv.includes('--json');
  const noIgnore = process.argv.includes('--no-ignore');
  
  if (!pattern) {
    console.error('Usage: node search_files.js [rootDir] [pattern] [--json] [--no-ignore]');
    process.exit(1);
  }
  
  let ignoreInstance = null;
  if (!noIgnore) {
    ignoreInstance = loadIgnorePatterns(rootDir);
  }
  
  const regex = new RegExp(pattern, 'i');
  const results = searchFiles(rootDir, regex, rootDir, [], ignoreInstance);
  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const r of results) {
      console.log(`${r.file}:${r.line}: ${r.match}`);
    }
  }
}

module.exports = { searchFiles };
