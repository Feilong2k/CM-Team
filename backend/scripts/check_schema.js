#!/usr/bin/env node

/**
 * Diagnostic script to check the actual column names in the features table.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  try {
    // Use the existing DatabaseTool to connect and query
    const DatabaseTool = require('../tools/DatabaseTool').DatabaseTool;
    const dbTool = new DatabaseTool('Orion');

    console.log('=== Checking features table columns ===');
    const columnRes = await dbTool.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'features' 
       ORDER BY ordinal_position`
    );
    console.log('Columns in features table:');
    columnRes.rows.forEach(row => {
      console.log(`  ${row.column_name} (${row.data_type})`);
    });

    // Also check the _migrations table to see which migrations have been applied
    console.log('\n=== Checking applied migrations ===');
    try {
      const migrationsRes = await dbTool.query(
        'SELECT version, name, applied_at FROM _migrations ORDER BY applied_at'
      );
      console.log('Applied migrations:');
      migrationsRes.rows.forEach(row => {
        console.log(`  ${row.version}: ${row.name} (applied at ${row.applied_at})`);
      });
    } catch (err) {
      console.log('Could not query _migrations table:', err.message);
    }

    // Check if there are any features already
    console.log('\n=== Checking existing features ===');
    const featuresRes = await dbTool.query(
      'SELECT external_id, title, status FROM features ORDER BY id'
    );
    console.log(`Total features: ${featuresRes.rows.length}`);
    featuresRes.rows.forEach(f => {
      console.log(`  ${f.external_id}: ${f.title} (${f.status})`);
    });

    // Check for P1-F3 specifically
    const f3Res = await dbTool.query(
      "SELECT * FROM features WHERE external_id = 'P1-F3'"
    );
    if (f3Res.rows.length > 0) {
      console.log('\nFeature 3 (P1-F3) already exists.');
    } else {
      console.log('\nFeature 3 (P1-F3) does not exist.');
    }

    // Close the database connection
    const db = require('../src/db/connection');
    await db.getPool().end();
    
    console.log('\n=== Diagnostic complete ===');
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
