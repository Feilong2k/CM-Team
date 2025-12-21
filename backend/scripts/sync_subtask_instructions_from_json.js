#!/usr/bin/env node

/**
 * Sync instruction (Tara/Devon TDD guidance) from a JSON template
 * into existing subtasks for task 2-1 (P1-F2-T1-S4..S18).
 *
 * Usage from repo root:
 *   node backend/scripts/sync_subtask_instructions_from_json.js backend/template/F2-T1-S2_subtasks.json
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const db = require('../src/db/connection');
const DatabaseTool = require('../tools/DatabaseTool');

async function main() {
  const relativeJsonPath = process.argv[2] || 'backend/template/F2-T1-S2_subtasks.json';
  const jsonPath = path.resolve(process.cwd(), relativeJsonPath);

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
    console.error('JSON root must be an array');
    process.exit(1);
  }

  // We already created 15 subtasks S4..S18 for task 2-1 previously.
  // Map index 0..14 -> shorthand IDs 2-1-4 .. 2-1-18.
  const baseSubtaskNumber = 4;

  console.log(`Syncing instructions for ${items.length} items...`);

  try {
    for (const [index, item] of items.entries()) {
      const subtaskNumber = baseSubtaskNumber + index;
      const shorthandId = `2-1-${subtaskNumber}`; // normalizeId will map this

      if (!item.instruction) {
        console.log(`Skipping item #${index} (${shorthandId}) - no instruction field in JSON`);
        continue;
      }

      console.log(`\n[${index + 1}/${items.length}] Updating instruction for subtask ${shorthandId}`);

      try {
        const updated = await DatabaseTool.update_subtask_sections(
          shorthandId,
          { instruction: item.instruction },
          'Sync Tara/Devon instructions from F2-T1-S2_subtasks.json'
        );

        console.log('  -> Updated subtask:', {
          id: updated.id,
          external_id: updated.external_id,
        });
      } catch (err) {
        console.error('  !! Failed to update subtask', shorthandId, ':', err.message);
      }
    }
  } finally {
    try {
      await db.getPool().end();
    } catch (e) {
      // ignore
    }
  }

  console.log('\nDone syncing instructions.');
}

main().catch((err) => {
  console.error('Fatal error in sync_subtask_instructions_from_json:', err.message);
  process.exit(1);
});
