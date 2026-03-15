require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── SQLITE CONNECTION ──────────────────────────────────────────────────────
const dbPath = path.join(__dirname, 'db', 'grc.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── CLAUDE API CLIENT ──────────────────────────────────────────────────────
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

async function callClaude(prompt) {
  if (!anthropic) {
    throw new Error('ANTHROPIC_API_KEY not set in .env');
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content.map(block => block.text || '').join('');
}

// ─── ROUTES ─────────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth')(db);
const questionRoutes = require('./routes/questions')(db);
const auditRoutes = require('./routes/audit')(db, callClaude);
const reportRoutes = require('./routes/reports')(db, callClaude);

app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({
      success: true,
      data: {
        database: 'connected',
        claudeApi: anthropic ? 'configured' : 'not configured',
        uptime: process.uptime()
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      data: { database: 'disconnected', error: err.message }
    });
  }
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── DATABASE INIT ──────────────────────────────────────────────────────────
function initDatabase() {
  const fs = require('fs');
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'db', 'init.sql'), 'utf8');
    db.exec(sql);
    console.log('[DB] Tables and seed data initialized');
  } catch (err) {
    console.error('[DB] Init error:', err.message);
  }
}

// ─── START ──────────────────────────────────────────────────────────────────
function start() {
  initDatabase();

  app.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════════════╗`);
    console.log(`║  GRC Intelligence  •  http://localhost:${PORT}        ║`);
    console.log(`╠══════════════════════════════════════════════════╣`);
    console.log(`║  Database : SQLite (db/grc.db)                   ║`);
    console.log(`║  Claude   : ${anthropic ? 'Connected' : 'Not configured (add API key)'}       ║`);
    console.log(`╚══════════════════════════════════════════════════╝\n`);
  });
}

start();
