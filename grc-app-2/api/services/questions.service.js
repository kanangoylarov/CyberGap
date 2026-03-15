const { getDb } = require('../config/database');

function getGrouped() {
  const db = getDb();

  const rows = db.prepare(
    'SELECT * FROM questions ORDER BY standard_name, category, id'
  ).all();

  const grouped = {};
  for (const q of rows) {
    const std = q.standard_name || 'General';
    const cat = q.category || 'Uncategorized';
    if (!grouped[std]) grouped[std] = {};
    if (!grouped[std][cat]) grouped[std][cat] = [];
    grouped[std][cat].push({
      id: q.id,
      clauseNumber: q.clause_number,
      text: q.question_text,
    });
  }

  return { grouped, total: rows.length };
}

function getFlat(standard) {
  const db = getDb();

  if (standard) {
    return db.prepare(
      'SELECT * FROM questions WHERE standard_name = ? ORDER BY standard_name, category, id'
    ).all(standard);
  }

  return db.prepare(
    'SELECT * FROM questions ORDER BY standard_name, category, id'
  ).all();
}

function create({ standardName, category, clauseNumber, questionText }) {
  const db = getDb();

  const result = db.prepare(
    `INSERT INTO questions (standard_name, category, clause_number, question_text)
     VALUES (?, ?, ?, ?)`
  ).run(standardName, category, clauseNumber, questionText);

  return db.prepare('SELECT * FROM questions WHERE id = ?').get(result.lastInsertRowid);
}

function remove(id) {
  const db = getDb();
  db.prepare('DELETE FROM questions WHERE id = ?').run(id);
}

module.exports = { getGrouped, getFlat, create, remove };
