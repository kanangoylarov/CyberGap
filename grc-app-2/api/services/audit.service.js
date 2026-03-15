const { getDb } = require('../config/database');
const { generateAnalysisForUser } = require('./ai.service');

function submitResponses(userId, user, responses) {
  const db = getDb();

  const insertResponses = db.transaction(() => {
    // Delete old responses for this user (fresh assessment each time)
    db.prepare('DELETE FROM audit_responses WHERE user_id = ?').run(userId);

    const insertStmt = db.prepare(
      `INSERT INTO audit_responses (user_id, question_id, answer, comment, file_path)
       VALUES (?, ?, ?, ?, ?)`
    );

    const insertedIds = [];
    for (const r of responses) {
      const result = insertStmt.run(
        userId, r.questionId, r.answer ? 1 : 0, r.comment || null, r.filePath || null
      );
      insertedIds.push({ responseId: result.lastInsertRowid, questionId: r.questionId, answer: r.answer });
    }
    return insertedIds;
  });

  const insertedIds = insertResponses();

  // Trigger AI analysis in the background
  generateAnalysisForUser(user, insertedIds).catch(err => {
    console.error('[AI] Background analysis error:', err.message);
  });

  return { totalResponses: insertedIds.length };
}

function getMyResponses(userId) {
  const db = getDb();

  return db.prepare(
    `SELECT ar.id, ar.question_id, ar.answer, ar.comment, ar.file_path, ar.created_at,
            q.standard_name, q.category, q.clause_number, q.question_text
     FROM audit_responses ar
     JOIN questions q ON q.id = ar.question_id
     WHERE ar.user_id = ?
     ORDER BY q.standard_name, q.category, q.id`
  ).all(userId);
}

function getMyAnalysis(userId) {
  const db = getDb();

  return db.prepare(
    `SELECT aa.*, ar.question_id, ar.answer, ar.comment,
            q.standard_name, q.category, q.clause_number, q.question_text
     FROM ai_analysis aa
     JOIN audit_responses ar ON ar.id = aa.response_id
     JOIN questions q ON q.id = ar.question_id
     WHERE ar.user_id = ?
     ORDER BY aa.ai_score ASC`
  ).all(userId);
}

function getAnalysisStatus(userId) {
  const db = getDb();

  const totalRow = db.prepare(
    'SELECT COUNT(*) as total FROM audit_responses WHERE user_id = ?'
  ).get(userId);

  const doneRow = db.prepare(
    `SELECT COUNT(*) as total FROM ai_analysis aa
     JOIN audit_responses ar ON ar.id = aa.response_id
     WHERE ar.user_id = ?`
  ).get(userId);

  const total = totalRow.total;
  const done = doneRow.total;

  return {
    totalResponses: total,
    analyzedCount: done,
    isComplete: done >= total && total > 0,
    progress: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

module.exports = { submitResponses, getMyResponses, getMyAnalysis, getAnalysisStatus };
