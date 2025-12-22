function isTraceEnabled() {
  // Default ON so TraceDashboard works without extra setup.
  // Disable by setting TRACE_ENABLED=false
  const raw = process.env.TRACE_ENABLED;
  if (raw === undefined || raw === null || raw === '') return true;
  return raw === 'true';
}

module.exports = {
  isTraceEnabled,
};
