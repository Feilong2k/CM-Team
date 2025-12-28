/**
 * Trace configuration.
 * Always enabled - no environment toggles allowed.
 */
function isTraceEnabled() {
  // Trace is always enabled (no environment toggle)
  return true;
}

module.exports = {
  isTraceEnabled,
};
