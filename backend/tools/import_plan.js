// CLI Import Tool for JSON Plans (MVP, JSON-only)
// Usage: node tools/import_plan.js path/to/plan.json

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { importPlan } = require('../src/utils/jsonImporter');

function printUsageAndExit() {
  console.error('Usage: node tools/import_plan.js path/to/plan.json');
  process.exit(1);
}

async function main() {
  // Argument parsing
  const [, , filePath] = process.argv;
  if (!filePath || !filePath.endsWith('.json')) {
    printUsageAndExit();
  }

  // Resolve and read file
  const absPath = path.resolve(process.cwd(), filePath);
  let fileContent;
  try {
    fileContent = fs.readFileSync(absPath, 'utf8');
  } catch (err) {
    console.error(`Error: Could not read file "${absPath}": ${err.message}`);
    process.exit(1);
  }

  // Parse JSON
  let planData;
  try {
    planData = JSON.parse(fileContent);
  } catch (err) {
    console.error(`Error: Invalid JSON in "${absPath}": ${err.message}`);
    process.exit(1);
  }

  // Import plan
  importPlan(planData)
    .then((result) => {
      console.log(`✅ Import successful: ${result.message}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`❌ Import failed: ${err.message}`);
      if (err.stack) {
        console.error(err.stack);
      }
      process.exit(1);
    });
}

if (require.main === module) {
  main();
}
