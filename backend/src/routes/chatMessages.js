const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const OrionAgent = require('../agents/OrionAgent');
const dbTool = require('../../tools/DatabaseTool');
const DS_ChatAdapter = require('../adapters/DS_ChatAdapter');

const validSenders = ['user', 'orion', 'system'];

function validateSender(sender) {
  return validSenders.includes(sender);
}

function parsePaginationParams(limit, offset) {
  const parsedLimit = parseInt(limit, 10);
  const parsedOffset = parseInt(offset, 10);
  return {
    limit: isNaN(parsedLimit) || parsedLimit < 1 ? 50 : parsedLimit,
    offset: isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset,
  };
}

const adapter = new DS_ChatAdapter({
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const orionAgent = new OrionAgent(adapter, dbTool);

router.post('/messages', async (req, res) => {
  const { external_id, sender, content, metadata } = req.body;

  if (!external_id || !sender || !content) {
    return res.status(400).json({ error: 'external_id, sender, and content are required' });
  }

  if (!validateSender(sender)) {
    return res.status(400).json({ error: 'Invalid sender value' });
  }

  try {
    if (sender === 'user') {
      // Delegate processing to OrionAgent
      // Use mode from metadata if available, default to 'plan'
      const mode = (metadata && metadata.mode) || 'plan';
      const response = await orionAgent.process(external_id, content, { mode });
      return res.status(200).json({
        message: response.content,
        metadata: response.metadata,
      });
    } else {
      // For other senders, just store the message
      const result = await query(
        `INSERT INTO chat_messages (external_id, sender, content, metadata)
         VALUES ($1, $2, $3, $4)
         RETURNING id, external_id, sender, content, metadata, created_at, updated_at`,
        [external_id, sender, content, metadata || null]
      );
      return res.status(201).json(result.rows[0]);
    }
  } catch (err) {
    console.error('Error processing chat message:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message, stack: err.stack });
  }
});

router.get('/messages', async (req, res) => {
  const { project_id, limit, offset } = req.query;

  if (!project_id) {
    return res.status(400).json({ error: 'project_id query parameter is required' });
  }

  const { limit: limitNum, offset: offsetNum } = parsePaginationParams(limit, offset);

  try {
    const result = await query(
      `SELECT * FROM chat_messages
       WHERE external_id LIKE $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [`${project_id}%`, limitNum, offsetNum]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Error fetching chat messages:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
