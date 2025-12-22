const { Pool } = require('pg');
const path = require('path');
// Ensure we load the backend .env even when running from repo root or ad-hoc scripts
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Lazy initialization - pool is created on first use, not on require
let pool = null;

/**
 * Get the database pool (lazy initialization)
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  if (!pool) {
    // Hard safety guard: tests must never run against the dev database.
    if (process.env.NODE_ENV === 'test') {
      if (!process.env.DATABASE_URL_TEST) {
        throw new Error('NODE_ENV=test requires DATABASE_URL_TEST to be set');
      }
    } else {
      if (!process.env.DATABASE_URL) {
        throw new Error('Missing required env var: DATABASE_URL');
      }
    }

    const connectionString =
      process.env.NODE_ENV === 'test'
        ? process.env.DATABASE_URL_TEST
        : process.env.DATABASE_URL;

    pool = new Pool({
      connectionString,
      max: parseInt(process.env.PG_MAX, 10) || 10,
      min: parseInt(process.env.PG_MIN, 10) || 0,
      idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT_MS, 10) || 10000,
      connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT_MS, 10) || 5000,
      // Disable SSL for local/LAN Postgres that does not support SSL
      ssl: false,
    });
  }
  return pool;
}

/**
 * Health check: runs a simple query to verify database connectivity.
 * @returns {Promise<boolean>} true if the database is reachable, false otherwise.
 */
async function healthCheck() {
  try {
    await getPool().query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return false;
  }
}

/**
 * Creates a new subtask record.
 * @param {Object} data - The subtask data.
 * @param {string} data.id - The subtask ID (e.g., '2-2').
 * @param {string} data.title - The title of the subtask.
 * @param {string} [data.status='pending'] - The status of the subtask.
 * @param {string} [data.branch] - The associated git branch.
 * @param {string[]} [data.dependencies=[]] - Array of dependency IDs.
 * @returns {Promise<Object>} The created subtask.
 */
async function createSubtask(data) {
  const {
    id,
    title,
    status = 'pending',
    branch = null,
    dependencies = [],
  } = data;

  const query = `
    INSERT INTO subtasks (id, title, status, branch, dependencies)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const values = [id, title, status, branch, dependencies];

  const result = await getPool().query(query, values);
  return result.rows[0];
}

/**
 * Retrieves a subtask by its ID.
 * @param {string} id - The subtask ID.
 * @returns {Promise<Object|null>} The subtask or null if not found.
 */
async function getSubtask(id) {
  const query = 'SELECT * FROM subtasks WHERE id = $1;';
  const result = await getPool().query(query, [id]);
  return result.rows[0] || null;
}

/**
 * Updates an existing subtask.
 * @param {string} id - The subtask ID.
 * @param {Object} updates - The fields to update.
 * @returns {Promise<Object>} The updated subtask.
 */
async function updateSubtask(id, updates) {
  const allowedFields = ['title', 'status', 'branch', 'dependencies'];
  const setClauses = [];
  const values = [];
  let paramCount = 1;

  allowedFields.forEach(field => {
    if (updates.hasOwnProperty(field)) {
      setClauses.push(`${field} = $${paramCount}`);
      values.push(updates[field]);
      paramCount++;
    }
  });

  if (setClauses.length === 0) {
    throw new Error('No valid fields provided for update');
  }

  values.push(id);
  const query = `
    UPDATE subtasks
    SET ${setClauses.join(', ')}, updated_at = NOW()
    WHERE id = $${paramCount}
    RETURNING *;
  `;

  const result = await getPool().query(query, values);
  if (result.rows.length === 0) {
    throw new Error(`Subtask with id ${id} not found`);
  }
  return result.rows[0];
}

/**
 * Deletes a subtask by its ID.
 * @param {string} id - The subtask ID.
 * @returns {Promise<Object>} The deleted subtask.
 */
async function deleteSubtask(id) {
  const query = 'DELETE FROM subtasks WHERE id = $1 RETURNING *;';
  const result = await getPool().query(query, [id]);
  if (result.rows.length === 0) {
    throw new Error(`Subtask with id ${id} not found`);
  }
  return result.rows[0];
}

/**
 * Lists all subtasks, ordered by creation date (newest first).
 * @returns {Promise<Array>} Array of subtask objects.
 */
async function listSubtasks() {
  const query = 'SELECT * FROM subtasks ORDER BY created_at DESC;';
  const result = await getPool().query(query);
  return result.rows;
}

/**
 * Runs all pending migrations.
 * @returns {Promise<void>}
 */
async function runMigrations() {
  const p = getPool();
  
  // Create migrations table if it doesn't exist
  await p.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Get already applied migrations
  const appliedResult = await p.query('SELECT name FROM migrations ORDER BY name;');
  const applied = new Set(appliedResult.rows.map(row => row.name));

  // Read migration files from the migrations directory
  const fs = require('fs');
  const path = require('path');
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Migration ${file} already applied, skipping.`);
      continue;
    }

    console.log(`Running migration ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await p.query('BEGIN');
    try {
      await p.query(sql);
      await p.query('INSERT INTO migrations (name) VALUES ($1);', [file]);
      await p.query('COMMIT');
      console.log(`Migration ${file} applied successfully.`);
    } catch (error) {
      await p.query('ROLLBACK');
      console.error(`Migration ${file} failed:`, error.message);
      throw error;
    }
  }
}

/**
 * Rolls back the most recent migration.
 * @returns {Promise<void>}
 */
async function rollbackMigration() {
  const p = getPool();
  
  // Note: This is a simple implementation that rolls back the last applied migration.
  // In a real scenario, you would have down scripts. Here we just delete the last record.
  const result = await p.query(`
    DELETE FROM migrations
    WHERE id = (SELECT id FROM migrations ORDER BY applied_at DESC LIMIT 1)
    RETURNING name;
  `);

  if (result.rows.length === 0) {
    console.log('No migrations to rollback.');
    return;
  }

  const rolledBack = result.rows[0].name;
  console.log(`Rolled back migration: ${rolledBack}`);
}

/**
 * Close the pool (for cleanup in tests)
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ===== Project Management Functions =====

/**
 * Creates a new project record.
 * @param {Object} data - The project data.
 * @param {string} data.name - The project name.
 * @param {string} [data.description] - The project description.
 * @param {string} [data.path] - The local filesystem path.
 * @param {string} [data.git_url] - The git repository URL.
 * @returns {Promise<Object>} The created project.
 */
async function createProject(data) {
  const {
    name,
    description = null,
    path = null,
    git_url = null,
  } = data;

  const query = `
    INSERT INTO projects (name, description, path, git_url)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const values = [name, description, path, git_url];

  const result = await getPool().query(query, values);
  return result.rows[0];
}

/**
 * Retrieves a project by its ID.
 * @param {number} id - The project ID.
 * @returns {Promise<Object|null>} The project or null if not found.
 */
async function getProject(id) {
  const query = 'SELECT * FROM projects WHERE id = $1;';
  const result = await getPool().query(query, [id]);
  return result.rows[0] || null;
}

/**
 * Updates an existing project.
 * @param {number} id - The project ID.
 * @param {Object} updates - The fields to update.
 * @returns {Promise<Object>} The updated project.
 */
async function updateProject(id, updates) {
  const allowedFields = ['name', 'description', 'path', 'git_url'];
  const setClauses = [];
  const values = [];
  let paramCount = 1;

  allowedFields.forEach(field => {
    if (updates.hasOwnProperty(field)) {
      setClauses.push(`${field} = $${paramCount}`);
      values.push(updates[field]);
      paramCount++;
    }
  });

  if (setClauses.length === 0) {
    throw new Error('No valid fields provided for update');
  }

  values.push(id);
  const query = `
    UPDATE projects
    SET ${setClauses.join(', ')}, updated_at = NOW()
    WHERE id = $${paramCount}
    RETURNING *;
  `;

  const result = await getPool().query(query, values);
  if (result.rows.length === 0) {
    throw new Error(`Project with id ${id} not found`);
  }
  return result.rows[0];
}

/**
 * Deletes a project by its ID.
 * @param {number} id - The project ID.
 * @returns {Promise<Object>} The deleted project.
 */
async function deleteProject(id) {
  const query = 'DELETE FROM projects WHERE id = $1 RETURNING *;';
  const result = await getPool().query(query, [id]);
  if (result.rows.length === 0) {
    throw new Error(`Project with id ${id} not found`);
  }
  return result.rows[0];
}

/**
 * Lists all active projects, ordered by creation date (newest first).
 * @returns {Promise<Array>} Array of project objects.
 */
async function listProjects() {
  const query = "SELECT * FROM projects WHERE status = 'active' ORDER BY created_at DESC;";
  const result = await getPool().query(query);
  return result.rows;
}

/**
 * Generic query function for custom SQL
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(sql, params = []) {
  return getPool().query(sql, params);
}

module.exports = {
  get pool() { return getPool(); }, // Lazy getter for backward compatibility
  getPool,
  query,
  healthCheck,
  createSubtask,
  getSubtask,
  updateSubtask,
  deleteSubtask,
  listSubtasks,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  listProjects,
  runMigrations,
  rollbackMigration,
  closePool,
};
