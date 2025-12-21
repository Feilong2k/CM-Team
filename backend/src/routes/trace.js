const express = require('express');
const router = express.Router();
const TraceService = require('../services/trace/TraceService');

// Parse limit/offset with sane defaults
function parsePaginationParams(limit, offset) {
  const parsedLimit = parseInt(limit, 10);
  const parsedOffset = parseInt(offset, 10);
  return {
    limit: isNaN(parsedLimit) || parsedLimit < 1 ? 50 : parsedLimit,
    offset: isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset,
  };
}

// GET /api/trace/logs
// Query params:
// - projectId (required)
// - type (optional)
// - source (optional)
// - limit (optional)
// - offset (optional)
router.get('/logs', async (req, res) => {
  const { projectId, type, source, limit, offset } = req.query;

  if (!projectId) {
    return res.status(400).json({ error: 'projectId query parameter is required' });
  }

  const { limit: limitNum, offset: offsetNum } = parsePaginationParams(limit, offset);

  try {
    const { events, total } = await TraceService.getEvents({
      projectId,
      type,
      source,
      limit: limitNum,
      offset: offsetNum,
    });

    return res.status(200).json({ events, total });
  } catch (err) {
    console.error('Error fetching trace logs:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
