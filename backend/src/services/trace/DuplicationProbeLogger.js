const fs = require('fs');
const path = require('path');

/**
 * Debug-only duplication probe logger.
 *
 * Always writes files to a local debug folder so we can
 * quickly compare agent vs final content without extra env setup.
 *
 * Optional env:
 * - ORION_DUP_PROBE_DIR (default: backend/debug/dup_probe relative to this file)
 */
function logDuplicationProbe(kind, payload) {
  try {
    // Stable base dir: backend/debug/dup_probe relative to this file
    const defaultDir = path.join(__dirname, '../../../debug/dup_probe');
    const baseDir = process.env.ORION_DUP_PROBE_DIR || defaultDir;
    const dir = path.resolve(baseDir);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const projectId = payload.projectId || 'unknown-project';
    const requestId = payload.requestId || 'no-request-id';
    const mode = payload.mode || 'unknown-mode';

    const fileName = `${timestamp}_${projectId}_${requestId}_${mode}_${kind}.json`;
    const filePath = path.join(dir, fileName);

    const record = {
      kind,
      timestamp: new Date().toISOString(),
      projectId,
      requestId,
      mode,
      hash: payload.hash,
      length: payload.length,
      sample: payload.sample,
      fullContent: payload.fullContent || undefined,
      meta: payload.meta || undefined,
    };

    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
  } catch (err) {
    // Swallow errors: this is debug-only and must never break main flow
    console.error('DuplicationProbeLogger failed:', err.message);
  }
}

module.exports = {
  logDuplicationProbe,
};
