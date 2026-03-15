const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('./index');

let db;

function getDb() {
  if (!db) {
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDatabase() {
  try {
    const sql = fs.readFileSync(config.initSqlPath, 'utf8');
    getDb().exec(sql);
    console.log('[DB] Tables and seed data initialized');
  } catch (err) {
    console.error('[DB] Init error:', err.message);
  }
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Connection closed');
  }
}

module.exports = { getDb, initDatabase, closeDatabase };
