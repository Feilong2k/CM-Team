#!/usr/bin/env node

/**
 * Sync subtask instruction sections from a JSON template into existing subtasks,
 * matching by external_id.
 *
 * Why:
 * - The existing sync_subtask_instructions_from_json.js assumes a fixed index mapping
 *   (S4..S18) and can overwrite the wrong subtasks when a JSON file has a different size.
 * - This script avoids that by requiring each item to include an external_id.
 *
 * Usage (from repo root):
 *   node backend/scripts/sync_subtask_instructions_by_external_id.js backend/template/F2-T1-softstop_and_twostage_subtasks.json
 *
 * Notes:
 * - Each JSON item must include:
 *     - external_id (e.g., "P1-F2-T1-S21")
 *     - instruction (object)
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const db = require('../src/db/connection');
const DatabaseTool = require('../tools/DatabaseTool');

async function main() {
  const jsonArg = process.argv[2];
  if (!jsonArg) {
    console.error('Usage: node backend/scripts/sync_subtask_instructions_by_external_id.js <path-to-json>');
    process.exit(1);
  }

  const jsonPath = path.resolve(process.cwd(), jsonArg);
  console.log('Using JSON file:', jsonPath);

  if (!fs.existsSync(jsonPath)) {
    console.error('JSON file not found:', jsonPath);
    process.exit(1);
  }

  let items;
  try {
    items = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    console.error('Failed to parse JSON:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(items)) {
    console.error('JSON root must be an array');
    process.exit(1);
  }

  const updates = items
    .map((item, idx) => ({ idx, item }))
    .filter(({ item }) => item && typeof item === 'object')
    .filter(({ item }) => typeof item.external_id === 'string' && item.external_id.trim() !== '')
    .filter(({ item }) => item.instruction && typeof item.instruction === 'object');

  if (updates.length === 0) {
    console.error('No valid items found. Each item must include external_id and instruction.');
    process.exit(1);
  }

  console.log(`Syncing instructions for ${updates.length} subtasks...`);

  try {
    for (const { idx, item } of updates) {
      const externalId = item.external_id.trim();
      console.log(`\n[${idx + 1}/${items.length}] Updating instruction for ${externalId}`);

      try {
        const updated = await DatabaseTool.update_subtask_sections(
          externalId,
          { instruction: item.instruction },
          `Sync instruction by external_id from ${path.basename(jsonPath)}`
        );

        console.log('  -> Updated subtask:', {
          id: updated.id,
          external_id: updated.external_id,
        });
      } catch (err) {
        console.error('  !! Failed to update subtask', externalId, ':', err.message);
      }
    }
  } finally {
    try {
      await db.getPool().end();
    } catch (e) {
      // ignore
    }
  }

  console.log('\nDone syncing instructions by external_id.');
}

main().catch((err) => {
  console.error('Fatal error in sync_subtask_instructions_by_external_id:', err.message);
  process.exit(1);
});
