// JSON Plan Importer - Implementation for Subtask 1-2-1
// Imports JSON plans according to JSON Plan Schema v1.1
// Uses Zod for validation and PostgreSQL for storage

const db = require('../../config/db');
const { jsonPlanSchema, normalizeStatus, parseExternalId } = require('../schemas/planSchema');

/**
 * Format Zod validation errors into a readable string
 * @param {import('zod').ZodError} zodError - The Zod error object
 * @returns {string} - Formatted error message
 */
function formatZodError(zodError) {
  if (zodError.errors && Array.isArray(zodError.errors)) {
    return zodError.errors.map(err => {
      const path = err.path?.join?.('.') || 'unknown';
      const message = err.message || 'Unknown error';
      return `${path}: ${message}`;
    }).join('; ');
  }
  return zodError.toString();
}

/**
 * Safely stringify JSON with default value
 * @param {any} data - The data to stringify
 * @param {any} defaultValue - Default value if data is undefined/null
 * @returns {string} - JSON string
 */
function safeStringify(data, defaultValue = {}) {
  return JSON.stringify(data || defaultValue);
}

/**
 * Execute an UPSERT query with ON CONFLICT clause
 * @param {Object} client - Database client
 * @param {string} table - Table name
 * @param {string} conflictColumn - Column name for ON CONFLICT
 * @param {Array} values - Query parameter values
 * @param {Array} columns - Column names
 * @returns {Promise<number>} - Inserted/updated row ID
 */
async function upsertWithConflict(client, table, conflictColumn, values, columns) {
  // Build placeholders: $1, $2, ...
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  
  // Build SET clause for UPDATE part
  const setClause = columns
    .filter(col => col !== conflictColumn) // Don't update the conflict column
    .map((col, i) => `${col} = EXCLUDED.${col}`)
    .join(', ');
  
  const query = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (${conflictColumn}) DO UPDATE SET
      ${setClause},
      updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `;
  
  const result = await client.query(query, values);
  return result.rows[0].id;
}

/**
 * Import a JSON plan into the database
 * @param {Object} planData - The JSON plan data
 * @returns {Promise<Object>} - Result of the import operation
 * @throws {Error} - If validation fails or database operation fails
 */
async function importPlan(planData) {
  // Step 1: Validate against Zod schema
  const validationResult = jsonPlanSchema.safeParse(planData);
  
  if (!validationResult.success) {
    throw new Error(`Validation failed: ${formatZodError(validationResult.error)}`);
  }
  
  const validatedData = validationResult.data;
  
  // Step 2: Import using transaction
  return await db.withTransaction(async (client) => {
    // Step 3: Import plan (planning_docs table)
    const planId = await importPlanningDoc(client, validatedData.plan);
    
    // Step 4: Import features recursively
    for (const feature of validatedData.plan.features) {
      await importFeature(client, feature, planId);
    }
    
    return {
      success: true,
      planId,
      message: `Successfully imported plan: ${validatedData.plan.title}`
    };
  });
}

/**
 * Import a planning document (planning_docs table)
 */
async function importPlanningDoc(client, plan) {
  const normalizedStatus = normalizeStatus(plan.status);
  
  const columns = [
    'external_id',
    'project_id',
    'title',
    'type',
    'status',
    'revision',
    'content_md'
  ];
  
  const values = [
    plan.externalId,
    plan.projectId,
    plan.title,
    plan.type || 'implementation_requirements',
    normalizedStatus,
    plan.revision || 1,
    plan.contentMd || ''
  ];
  
  return await upsertWithConflict(
    client,
    'planning_docs',
    'external_id',
    values,
    columns
  );
}

/**
 * Import a feature with its tasks and subtasks
 */
async function importFeature(client, feature, planId) {
  const normalizedStatus = normalizeStatus(feature.status);
  
  const columns = [
    'external_id',
    'project_id',
    'title',
    'status',
    'basic_info',
    'activity_log',
    'pcc',
    'cap',
    'red',
    'order_index'
  ];
  
  const values = [
    feature.externalId,
    planId, // project_id from planning_docs
    feature.title,
    normalizedStatus,
    safeStringify(feature.basic_info, {}),
    safeStringify(feature.activity_log, []),
    safeStringify(feature.pcc, {}),
    safeStringify(feature.cap, {}),
    safeStringify(feature.red, {}),
    feature.order_index || 0
  ];
  
  const featureId = await upsertWithConflict(
    client,
    'features',
    'external_id',
    values,
    columns
  );
  
  // Import tasks for this feature
  for (const task of feature.tasks || []) {
    await importTask(client, task, featureId);
  }
  
  return featureId;
}

/**
 * Import a task with its subtasks
 */
async function importTask(client, task, featureId) {
  const normalizedStatus = normalizeStatus(task.status);
  
  const columns = [
    'external_id',
    'feature_id',
    'title',
    'status',
    'linked_plan_id',
    'basic_info',
    'activity_log',
    'pcc',
    'cap',
    'order_index'
  ];
  
  // Parse externalId to get plan reference if needed
  const parsedId = parseExternalId(task.externalId);
  let linkedPlanId = null;
  
  // If task has linked_plan_externalId, we would need to look it up
  // For now, we'll store the externalId reference
  // In a real implementation, we would look up the plan ID
  
  const values = [
    task.externalId,
    featureId,
    task.title,
    normalizedStatus,
    linkedPlanId,
    safeStringify(task.basic_info, {}),
    safeStringify(task.activity_log, []),
    safeStringify(task.pcc, {}),
    safeStringify(task.cap, {}),
    task.order_index || 0
  ];
  
  const taskId = await upsertWithConflict(
    client,
    'tasks',
    'external_id',
    values,
    columns
  );
  
  // Import subtasks for this task
  for (const subtask of task.subtasks || []) {
    await importSubtask(client, subtask, taskId, null); // null parent_id for top-level subtasks
  }
  
  return taskId;
}

/**
 * Import a subtask (recursive)
 */
async function importSubtask(client, subtask, taskId, parentId) {
  const normalizedStatus = normalizeStatus(subtask.status);
  
  const columns = [
    'external_id',
    'task_id',
    'parent_id',
    'title',
    'status',
    'workflow_stage',
    'basic_info',
    'instruction',
    'activity_log',
    'pcc',
    'tests',
    'implementations',
    'review',
    'order_index'
  ];
  
  const values = [
    subtask.externalId,
    taskId,
    parentId,
    subtask.title,
    normalizedStatus,
    subtask.workflow_stage || 'planning',
    safeStringify(subtask.basic_info, {}),
    safeStringify(subtask.instruction, {}),
    safeStringify(subtask.activity_log, []),
    safeStringify(subtask.pcc, {}),
    safeStringify(subtask.tests, {}),
    safeStringify(subtask.implementations, {}),
    safeStringify(subtask.review, {}),
    subtask.order_index || 0
  ];
  
  const subtaskId = await upsertWithConflict(
    client,
    'subtasks',
    'external_id',
    values,
    columns
  );
  
  // Import child subtasks recursively
  for (const childSubtask of subtask.subtasks || []) {
    await importSubtask(client, childSubtask, taskId, subtaskId);
  }
  
  return subtaskId;
}

// Export the main import function
module.exports = { importPlan };
