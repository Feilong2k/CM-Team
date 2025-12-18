/**
 * Migration Runner Script
 * Subtask 1-0-1: Create Migration Runner Script
 * 
 * Reads SQL migration files from backend/migrations/
 * Sorts by TIMESTAMP_ prefix
 * Executes in transaction (BEGIN/COMMIT/ROLLBACK)
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load environment variables from .env file
require('dotenv').config();

// Configuration
const CONFIG = {
  MIGRATIONS_DIR: path.join(__dirname, '..', 'migrations'),
  FILE_EXTENSION: '.sql',
  ENCODING: 'utf8',
  SQL_COMMANDS: {
    BEGIN: 'BEGIN',
    COMMIT: 'COMMIT',
    ROLLBACK: 'ROLLBACK'
  }
};

// Custom error types for better error handling
class MigrationError extends Error {
  constructor(message, fileName = null) {
    super(message);
    this.name = 'MigrationError';
    this.fileName = fileName;
  }
}

class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Get migrations directory path
 * @returns {string} Absolute path to migrations directory
 */
function getMigrationsDir() {
  return CONFIG.MIGRATIONS_DIR;
}

/**
 * Check if migrations directory exists
 * @returns {boolean} True if directory exists
 */
function migrationsDirExists() {
  return fs.existsSync(getMigrationsDir());
}

/**
 * Read migration files from backend/migrations/ directory
 * @returns {string[]} Sorted list of .sql file names
 * @throws {MigrationError} If directory doesn't exist
 */
function readMigrationFiles() {
  const migrationsDir = getMigrationsDir();
  
  if (!migrationsDirExists()) {
    throw new MigrationError(`Migrations directory not found: ${migrationsDir}`);
  }
  
  const allFiles = fs.readdirSync(migrationsDir);
  
  // Filter for .sql files
  const sqlFiles = allFiles.filter(file => file.endsWith(CONFIG.FILE_EXTENSION));
  
  if (sqlFiles.length === 0) {
    console.warn(`No ${CONFIG.FILE_EXTENSION} files found in ${migrationsDir}`);
    return [];
  }
  
  // Sort by TIMESTAMP_ prefix (assuming format: TIMESTAMP_description.sql)
  sqlFiles.sort((a, b) => {
    const timestampA = a.split('_')[0];
    const timestampB = b.split('_')[0];
    return timestampA.localeCompare(timestampB);
  });
  
  return sqlFiles;
}

/**
 * Validate DATABASE_URL environment variable
 * @throws {ConfigurationError} If DATABASE_URL is missing or invalid
 */
function validateDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new ConfigurationError('DATABASE_URL environment variable is required');
  }
  
  // Basic validation - could be expanded
  if (typeof process.env.DATABASE_URL !== 'string' || process.env.DATABASE_URL.trim() === '') {
    throw new ConfigurationError('DATABASE_URL must be a non-empty string');
  }
}

/**
 * Create database client with validated configuration
 * @returns {Client} PostgreSQL client instance
 * @throws {ConfigurationError} If configuration is invalid
 */
function createDatabaseClient() {
  validateDatabaseUrl();
  return new Client({ connectionString: process.env.DATABASE_URL });
}

/**
 * Execute a single SQL migration within a transaction
 * @param {string} sql - SQL to execute
 * @param {string} fileName - Name of the migration file (for error context)
 * @returns {Promise<void>}
 * @throws {MigrationError} If migration fails
 */
async function executeMigration(sql, fileName = null) {
  const client = createDatabaseClient();
  
  try {
    await client.connect();
    
    // Start transaction
    await client.query(CONFIG.SQL_COMMANDS.BEGIN);
    
    // Execute the migration SQL
    await client.query(sql);
    
    // Commit transaction
    await client.query(CONFIG.SQL_COMMANDS.COMMIT);
    
    console.log(`Migration ${fileName ? `"${fileName}"` : ''} executed successfully`);
  } catch (error) {
    // Rollback on error
    await client.query(CONFIG.SQL_COMMANDS.ROLLBACK);
    
    const errorMessage = fileName 
      ? `Migration "${fileName}" failed: ${error.message}`
      : `Migration failed: ${error.message}`;
    
    console.error(errorMessage);
    throw new MigrationError(errorMessage, fileName);
  } finally {
    await client.end();
  }
}

/**
 * Read SQL content from a migration file
 * @param {string} fileName - Name of the migration file
 * @returns {string} SQL content
 * @throws {MigrationError} If file cannot be read
 */
function readMigrationFileContent(fileName) {
  const filePath = path.join(getMigrationsDir(), fileName);
  
  try {
    return fs.readFileSync(filePath, CONFIG.ENCODING);
  } catch (error) {
    throw new MigrationError(`Failed to read migration file "${fileName}": ${error.message}`, fileName);
  }
}

/**
 * Run all migrations in sorted order
 * @returns {Promise<{success: boolean, executed: number, failed: number}>}
 * @throws {MigrationError} If migration fails and exitOnFailure is false
 */
async function runMigrations(options = {}) {
  const { exitOnFailure = true } = options;
  let executed = 0;
  let failed = 0;
  
  try {
    const migrationFiles = readMigrationFiles();
    
    if (migrationFiles.length === 0) {
      console.warn('No migration files to execute');
      return { success: true, executed: 0, failed: 0 };
    }
    
    console.log(`Found ${migrationFiles.length} migration file(s):`);
    migrationFiles.forEach(file => console.log(`  - ${file}`));
    
    for (const file of migrationFiles) {
      console.log(`\nExecuting migration: ${file}`);
      
      try {
        const sql = readMigrationFileContent(file);
        await executeMigration(sql, file);
        console.log(`✓ ${file} completed successfully`);
        executed++;
      } catch (error) {
        console.error(`✗ ${file} failed: ${error.message}`);
        failed++;
        
        if (exitOnFailure) {
          process.exit(1);
          return; // For logical consistency after exit
        } else {
          throw error;
        }
      }
    }
    
    if (failed === 0) {
      console.log(`\n✅ All ${executed} migrations completed successfully!`);
      return { success: true, executed, failed: 0 };
    }
    
  } catch (error) {
    // Re-throw with context
    throw new MigrationError(`Migration runner failed: ${error.message}`);
  }
}

/**
 * CLI entry point
 */
async function main() {
  try {
    const result = await runMigrations();
    
    if (result.success && result.failed === 0) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ ${error.message}`);
    
    if (error instanceof ConfigurationError) {
      console.error('Please check your environment configuration.');
    } else if (error instanceof MigrationError && error.fileName) {
      console.error(`Migration "${error.fileName}" needs to be fixed.`);
    }
    
    process.exit(1);
  }
}

// Export functions for testing
module.exports = {
  CONFIG,
  getMigrationsDir,
  migrationsDirExists,
  readMigrationFiles,
  validateDatabaseUrl,
  createDatabaseClient,
  executeMigration,
  readMigrationFileContent,
  runMigrations,
  MigrationError,
  ConfigurationError
};

// Run if called directly
if (require.main === module) {
  main();
}
