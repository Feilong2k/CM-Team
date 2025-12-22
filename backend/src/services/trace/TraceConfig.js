function isTraceEnabled() {
  // Default ON so TraceDashboard works without extra setup.
  // Disable by setting TRACE_ENABLED=false
  const raw = process.env.TRACE_ENABLED;
  if (raw === undefined || raw === null || raw === '') return true;
  return raw === 'true';
}

function isDupProbeEnabled() {
  // Separate switch for on-disk duplication probe files.
  // Default OFF.
  // Enable by setting ORION_DUP_PROBE_ENABLED=true
  return process.env.ORION_DUP_PROBE_ENABLED === 'true';
}

module.exports = {
  isTraceEnabled,
  isDupProbeEnabled,
};
