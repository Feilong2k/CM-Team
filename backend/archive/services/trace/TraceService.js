// Minimal TraceService implementation for B2.
// For now this is an in-memory store so that tools and routes can depend on it
// without crashing. B2 can later replace this with a DB-backed implementation.

const { createTraceEventShape } = require('./TraceEvent');
const { isTraceEnabled } = require('./TraceConfig');

// In-memory event store (test-only / dev-only for now)
let events = [];

/**
 * Log a TraceEvent.
 * Ensures each event has a stable id and timestamp so UIs can key and select correctly.
 * @param {import('./TraceEvent').TraceEvent} event
 */
async function logEvent(event) {
  // Default OFF
  if (!isTraceEnabled()) return;
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
  // If tracing is disabled, behave as empty.
  if (!isTraceEnabled()) {
    return { events: [], total: 0 };
  }

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

  // Default UX expectation for trace timelines: show the MOST RECENT events.
  // We keep the returned slice in chronological order (oldest->newest) so the UI
  // renders a natural timeline, but we window from the tail by default.
  const total = result.length;

  const limitNum = (limit | 0) || 50;
  const offsetNum = Math.max(0, offset | 0);

  // Interpret offset as "offset from the most recent" (tail window), not from the start.
  // offset=0,limit=50 => last 50
  // offset=50,limit=50 => prior 50, etc.
  const end = Math.max(0, total - offsetNum);
  const start = Math.max(0, end - limitNum);

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
