function isTraceEnabled() {
  // Default OFF to avoid extra overhead/files.
  // Enable by setting TRACE_ENABLED=true
  return process.env.TRACE_ENABLED === 'true';
}

function isDupProbeEnabled() {
  // Separate switch for on-disk probe files.
  // Enable by setting ORION_DUP_PROBE_ENABLED=true
  return process.env.ORION_DUP_PROBE_ENABLED === 'true';
}

module.exports = {
  isTraceEnabled,
  isDupProbeEnabled,
};
