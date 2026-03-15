const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

module.exports = function (db) {
  const router = express.Router();

  // Get all questions grouped by standard and category
  router.get('/', authenticateToken, (req, res) => {
    try {
      const rows = db.prepare(
        'SELECT * FROM questions ORDER BY standard_name, category, id'
      ).all();

      // Group by standard -> category
      const grouped = {};
      for (const q of rows) {
        const std = q.standard_name || 'General';
        const cat = q.category || 'Uncategorized';
        if (!grouped[std]) grouped[std] = {};
        if (!grouped[std][cat]) grouped[std][cat] = [];
        grouped[std][cat].push({
          id: q.id,
          clauseNumber: q.clause_number,
          text: q.question_text
        });
      }

      res.json({ success: true, data: grouped, total: rows.length });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get questions flat list (for assessment flow)
  router.get('/flat', authenticateToken, (req, res) => {
    try {
      const { standard } = req.query;
      let rows;

      if (standard) {
        rows = db.prepare(
          'SELECT * FROM questions WHERE standard_name = ? ORDER BY standard_name, category, id'
        ).all(standard);
      } else {
        rows = db.prepare(
          'SELECT * FROM questions ORDER BY standard_name, category, id'
        ).all();
      }

      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin: Add a new question
  router.post('/', authenticateToken, requireAdmin, (req, res) => {
    const { standardName, category, clauseNumber, questionText } = req.body;
    if (!questionText) {
      return res.status(400).json({ success: false, error: 'questionText is required' });
    }
    try {
      const result = db.prepare(
        `INSERT INTO questions (standard_name, category, clause_number, question_text)
         VALUES (?, ?, ?, ?)`
      ).run(standardName, category, clauseNumber, questionText);

      const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin: Delete a question
  router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
