/**
 * @typedef {Object} TraceEvent
 * @property {string|number} id
 * @property {string} timestamp // ISO 8601 UTC
 * @property {string} projectId // e.g. "P1"
 * @property {('user'|'orion'|'tool'|'system')} source
 * @property {(
 *   'user_message'|
 *   'orion_response'|
 *   'tool_call'|
 *   'tool_result'|
 *   'llm_call'|
 *   'llm_result'|
 *   'system_error'|
 *   'llm_stream_chunk'|
 *   'tool_result_stream'|
 *   'tool_registration'
 * )} type
 * @property {('inbound'|'outbound'|'internal')=} direction
 * @property {string=} toolName
 * @property {string=} requestId
 * @property {string} summary
 * @property {Object} details
 * @property {{ message: string, code?: string }=} error
 * @property {Object=} metadata
 */

/**
 * Trace event sources.
 * @readonly
 * @enum {string}
 */
const TRACE_SOURCES = ['user', 'orion', 'tool', 'system'];

/**
 * Trace event types.
 * @readonly
 * @enum {string}
 */
const TRACE_TYPES = [
  'user_message',
  'orion_response',
  'tool_call',
  'tool_result',
  // Duplicate / soft-stop events
  'duplicate_tool_call',
  'llm_call',
  'llm_result',
  'system_error',
  // Streaming / advanced trace types
  'llm_stream_chunk',
  'tool_result_stream',
  'tool_registration'
];

/**
 * Creates an empty TraceEvent shape object.
 * @returns {TraceEvent}
 */
function createTraceEventShape() {
  return {
    id: '',
    timestamp: '',
    projectId: '',
    source: '',
    type: '',
    direction: undefined,
    toolName: undefined,
    requestId: undefined,
    summary: '',
    details: {},
    error: undefined,
    metadata: undefined
  };
}

module.exports = {
  TRACE_SOURCES,
  TRACE_TYPES,
  createTraceEventShape
};
