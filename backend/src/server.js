const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
require('dotenv').config()

const app = express()

const port = Number(process.env.PORT)
if (!port) {
  // Avoid silently starting on a hardcoded port
  throw new Error('Missing required env var: PORT')
}

const corsOriginRegexRaw = process.env.CORS_ORIGIN_REGEX
if (!corsOriginRegexRaw) {
  throw new Error('Missing required env var: CORS_ORIGIN_REGEX')
}

const corsOriginRegex = new RegExp(corsOriginRegexRaw)

app.use(helmet())
app.use(
  cors({
    origin(origin, callback) {
      // allow non-browser clients (curl, server-to-server)
      if (!origin) return callback(null, true)

      const ok = corsOriginRegex.test(origin)
      return callback(ok ? null : new Error('Not allowed by CORS'), ok)
    },
  })
)
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

// Export the app for testing
module.exports = app

// Only start the server if this file is run directly (not required in tests)
if (require.main === module) {
  app.listen(port, () => {
    console.log(`[backend] listening on http://localhost:${port}`)
  })
}
