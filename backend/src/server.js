const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const chatMessagesRouter = require('./routes/chatMessages');
const featuresRouter = require('./routes/features');
const traceRouter = require('./routes/trace');
const { isTraceEnabled } = require('./services/trace/TraceConfig');

const app = express();

const port = process.env.PORT;
if (!port) {
  throw new Error('Missing required env var: PORT');
}

const corsOriginRegexRaw = process.env.CORS_ORIGIN_REGEX;
if (!corsOriginRegexRaw) {
  throw new Error('Missing required env var: CORS_ORIGIN_REGEX');
}
const corsOriginRegex = new RegExp(corsOriginRegexRaw);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || corsOriginRegex.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(helmet());
app.use(express.json());

// Register chatMessages and features routes
app.use('/api/chat', chatMessagesRouter);
app.use('/api/features', featuresRouter);

// Trace route is opt-in (TRACE_ENABLED=true)
if (isTraceEnabled()) {
  app.use('/api/trace', traceRouter);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

module.exports = app;
