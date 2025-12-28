const { query: dbQuery } = require('../../db/connection');

// Valid source values
const VALID_SOURCES = ['user', 'orion', 'tool', 'system'];

// Valid type values
const VALID_TYPES = [
  'user_message',
  'orion_response',
  'tool_call',
  'tool_result',
  'duplicate_tool_call',
  'llm_call',
  'system_error',
  'orchestration_phase_start',
  'orchestration_phase_end',
  'phase_transition'
];

/**
 * Validate event data and throw appropriate errors.
 */
function validateEvent(event) {
  if (!event.projectId) {
    throw new Error('Missing required field: projectId');
  }
  if (!event.source) {
    throw new Error('Missing required field: source');
  }
  if (!VALID_SOURCES.includes(event.source)) {
    throw new Error(`Invalid source: ${event.source}. Must be one of: ${VALID_SOURCES.join(', ')}`);
  }
  if (!event.type) {
    throw new Error('Missing required field: type');
  }
  if (!VALID_TYPES.includes(event.type)) {
    throw new Error(`Invalid type: ${event.type}. Must be one of: ${VALID_TYPES.join(', ')}`);
  }
  if (!event.summary) {
    throw new Error('Missing required field: summary');
  }
}

/**
 * Log a trace event to the database.
 * @param {Object} event - Event data
 * @returns {Promise<Object>} The inserted event with id and timestamp
 */
async function logEvent(event) {
  validateEvent(event);

  // Ensure details is an object (default {})
  const details = event.details !== undefined ? event.details : {};

  const query = `
    INSERT INTO trace_events (
      project_id,
      source,
      type,
      direction,
      tool_name,
      request_id,
      summary,
      details,
      error,
      metadata,
      phase_index,
      cycle_index
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `;

  const values = [
    event.projectId,
    event.source,
    event.type,
    event.direction || null,
    event.toolName || null,
    event.requestId || null,
    event.summary,
    JSON.stringify(details),
    event.error ? JSON.stringify(event.error) : null,
    event.metadata ? JSON.stringify(event.metadata) : null,
    event.phaseIndex || null,
    event.cycleIndex || null
  ];

  const result = await dbQuery(query, values);
  const row = result.rows[0];

  // Map column names to camelCase for the returned object
  return {
    id: row.id,
    timestamp: row.timestamp,
    projectId: row.project_id,
    source: row.source,
    type: row.type,
    direction: row.direction,
    toolName: row.tool_name,
    requestId: row.request_id,
    summary: row.summary,
    details: row.details,
    error: row.error,
    metadata: row.metadata,
    phaseIndex: row.phase_index,
    cycleIndex: row.cycle_index
  };
}

/**
 * Get trace events with filtering and tail-window pagination.
 * @param {Object} filters - Filter options
 * @param {string} filters.projectId - Required project ID
 * @param {string} [filters.type] - Optional type filter
 * @param {string} [filters.source] - Optional source filter
 * @param {number} [filters.limit=50] - Maximum number of events to return
 * @param {number} [filters.offset=0] - Offset from the end (tail window)
 * @returns {Promise<{events: Array, total: number}>}
 */
async function getEvents(filters) {
  const { projectId, type, source, limit = 50, offset = 0 } = filters;

  if (!projectId) {
    throw new Error('projectId is required');
  }

  // Build WHERE clause
  const whereConditions = ['project_id = $1'];
  const params = [projectId];
  let paramIndex = 2;

  if (type) {
    whereConditions.push(`type = $${paramIndex}`);
    params.push(type);
    paramIndex++;
  }

  if (source) {
    whereConditions.push(`source = $${paramIndex}`);
    params.push(source);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM trace_events ${whereClause}`;
  const countResult = await dbQuery(countQuery, params);
  const total = parseInt(countResult.rows[0].total, 10);

  // Tail-window pagination: we need to select events ordered by timestamp DESC,
  // then apply offset and limit from the end, then reverse to get oldest → newest.
  // Compute effective offset from start: total - offset - limit
  // but ensure we don't go negative.
  const startFrom = Math.max(0, total - offset - limit);
  const effectiveLimit = Math.min(limit, total - offset);

  let events = [];
  if (effectiveLimit > 0) {
    const paginationQuery = `
      SELECT * FROM trace_events
      ${whereClause}
      ORDER BY timestamp ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const paginationParams = [...params, effectiveLimit, startFrom];
    const result = await dbQuery(paginationQuery, paginationParams);
    events = result.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      projectId: row.project_id,
      source: row.source,
      type: row.type,
      direction: row.direction,
      toolName: row.tool_name,
      requestId: row.request_id,
      summary: row.summary,
      details: row.details,
      error: row.error,
      metadata: row.metadata,
      phaseIndex: row.phase_index,
      cycleIndex: row.cycle_index
    }));
  }

  return { events, total };
}

// Singleton instance (just the module functions)
function getInstance() {
  return {
    logEvent,
    getEvents
  };
}

module.exports = {
  logEvent,
  getEvents,
  getInstance
};
