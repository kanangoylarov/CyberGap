const path = require('path');

const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  jwtSecret: process.env.JWT_SECRET || 'grc-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  bcryptRounds: 12,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  dbPath: path.join(__dirname, '..', 'db', 'grc.db'),
  initSqlPath: path.join(__dirname, '..', 'db', 'init.sql'),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
  claudeModel: 'claude-sonnet-4-20250514',
  claudeMaxTokens: 8000,
};

module.exports = config;
