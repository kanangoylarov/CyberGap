const express = require('express');
const cors = require('cors');
const config = require('./config');
const mountRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { getDb } = require('./config/database');
const { isClaudeConfigured } = require('./config/claude');

const app = express();

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '10mb' }));

// ─── ROUTES ─────────────────────────────────────────────────────────────────
mountRoutes(app);

// Health check
app.get('/api/health', (_req, res) => {
  try {
    getDb().prepare('SELECT 1').get();
    res.json({
      success: true,
      data: {
        database: 'connected',
        claudeApi: isClaudeConfigured() ? 'configured' : 'not configured',
        uptime: process.uptime(),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      data: { database: 'disconnected', error: err.message },
    });
  }
});

// ─── ERROR HANDLING ─────────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
