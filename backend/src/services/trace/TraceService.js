// Minimal TraceService implementation for B2.
// For now this is an in-memory store so that tools and routes can depend on it
// without crashing. B2 can later replace this with a DB-backed implementation.

const { createTraceEventShape } = require('./TraceEvent');

// In-memory event store (test-only / dev-only for now)
let events = [];

/**
 * Log a TraceEvent.
 * Ensures each event has a stable id and timestamp so UIs can key and select correctly.
 * @param {import('./TraceEvent').TraceEvent} event
 */
async function logEvent(event) {
  if (!event || typeof event !== 'object') return;

  const base = createTraceEventShape();
  const now = new Date().toISOString();
  const merged = { ...base, ...event };

  // Ensure a unique id if caller didn't provide one
  if (!merged.id) {
    merged.id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // Ensure a string timestamp if caller didn't provide one
  if (!merged.timestamp) {
    merged.timestamp = now;
  }

  events.push(merged);
}

/**
 * Get TraceEvents filtered by projectId/type/source with basic pagination.
 * This is a minimal implementation to support early B2 work and tests.
 *
 * @param {Object} filters
 * @param {string} filters.projectId
 * @param {string} [filters.type]
 * @param {string} [filters.source]
 * @param {number} [filters.limit]
 * @param {number} [filters.offset]
 * @returns {Promise<{ events: import('./TraceEvent').TraceEvent[], total: number }>}
 */
async function getEvents({ projectId, type, source, limit = 50, offset = 0 } = {}) {
  let result = events;

  if (projectId) {
    result = result.filter((e) => e.projectId === projectId);
  }

  if (type) {
    result = result.filter((e) => e.type === type);
  }

  if (source) {
    result = result.filter((e) => e.source === source);
  }

  const total = result.length;
  const start = Math.max(0, offset | 0);
  const end = start + (limit | 0 || 50);

  return { events: result.slice(start, end), total };
}

/**
 * Utility for tests to clear the in-memory store.
 */
function _resetForTests() {
  events = [];
}

module.exports = {
  logEvent,
  getEvents,
  _resetForTests,
};
