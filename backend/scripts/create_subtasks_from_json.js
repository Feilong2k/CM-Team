#!/usr/bin/env node

/**
 * Bulk-create subtasks for a given task from a JSON file.
 *
 * Usage (from repo root):
 *   cd backend
 *   node scripts/create_subtasks_from_json.js template/F2-T1-S2_subtasks.json
 */

const fs = require('fs');
const path = require('path');

// Ensure DB connection config is loaded
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const db = require('../src/db/connection');
const DatabaseTool = require('../tools/DatabaseTool');

async function main() {
  const relativeJsonPath = process.argv[2] || 'template/F2-T1-S2_subtasks.json';
  const jsonPath = path.resolve(__dirname, '..', relativeJsonPath);

  console.log('Using JSON file:', jsonPath);

  if (!fs.existsSync(jsonPath)) {
    console.error('JSON file not found:', jsonPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  let items;
  try {
    items = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse JSON:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(items)) {
    console.error('JSON root must be an array of subtask definitions');
    process.exit(1);
  }

  console.log(`Creating ${items.length} subtasks...`);

  const created = [];

  try {
    for (const [index, item] of items.entries()) {
      const {
        task_id = '2-1',
        title,
        status = 'pending',
        workflow_stage = 'orion_planning',
        basic_info = {},
        instruction = {},
        pcc = {},
        tests = {},
        implementation = {},
        review = {},
        reason = '',
      } = item;

      if (!title || typeof title !== 'string') {
        console.warn(`Skipping item #${index}: missing or invalid title`);
        continue;
      }

      console.log(`\n[${index + 1}/${items.length}] Creating subtask for task ${task_id}: ${title}`);

      try {
        // Pass external_id = null so DatabaseTool auto-assigns Px-Fy-Tz-Sn
        const subtask = await DatabaseTool.create_subtask(
          task_id,
          null,
          title,
          status,
          workflow_stage,
          basic_info,
          instruction,
          pcc,
          tests,
          implementation,
          review,
          reason || 'Bulk subtask import for F2-T1-S2'
        );

        console.log('  -> Created:', {
          id: subtask.id,
          external_id: subtask.external_id,
          status: subtask.status,
        });
        created.push(subtask);
      } catch (err) {
        console.error('  !! Failed to create subtask:', err.message);
        if (err.stack) {
          console.error(err.stack);
        }
      }
    }
  } finally {
    // Cleanly close DB pool
    try {
      await db.getPool().end();
    } catch (e) {
      // ignore
    }
  }

  console.log(`\nDone. Successfully created ${created.length} subtasks.`);
}

main().catch((err) => {
  console.error('Fatal error in create_subtasks_from_json:', err.message);
  process.exit(1);
});
