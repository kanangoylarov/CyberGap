const express = require('express');
const { authenticateToken } = require('../middleware/auth');

module.exports = function (db, callClaude) {
  const router = express.Router();

  // Submit audit responses (batch) and trigger AI analysis
  router.post('/submit', authenticateToken, (req, res) => {
    const { responses } = req.body;

    if (!responses || !Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({ success: false, error: 'responses array is required' });
    }

    try {
      const insertResponses = db.transaction(() => {
        // Delete old responses for this user (fresh assessment each time)
        db.prepare('DELETE FROM audit_responses WHERE user_id = ?').run(req.user.id);

        const insertStmt = db.prepare(
          `INSERT INTO audit_responses (user_id, question_id, answer, comment, file_path)
           VALUES (?, ?, ?, ?, ?)`
        );

        const insertedIds = [];
        for (const r of responses) {
          const result = insertStmt.run(
            req.user.id, r.questionId, r.answer ? 1 : 0, r.comment || null, r.filePath || null
          );
          insertedIds.push({ responseId: result.lastInsertRowid, questionId: r.questionId, answer: r.answer });
        }
        return insertedIds;
      });

      const insertedIds = insertResponses();

      // Trigger AI analysis in the background
      generateAIAnalysis(db, callClaude, req.user, insertedIds).catch(err => {
        console.error('[AI] Background analysis error:', err.message);
      });

      res.json({
        success: true,
        data: {
          totalResponses: insertedIds.length,
          message: 'Responses saved. AI analysis is being generated...'
        }
      });
    } catch (err) {
      console.error('[Audit] Submit error:', err.message);
      res.status(500).json({ success: false, error: 'Failed to save responses' });
    }
  });

  // Get user's responses with questions
  router.get('/my-responses', authenticateToken, (req, res) => {
    try {
      const rows = db.prepare(
        `SELECT ar.id, ar.question_id, ar.answer, ar.comment, ar.file_path, ar.created_at,
                q.standard_name, q.category, q.clause_number, q.question_text
         FROM audit_responses ar
         JOIN questions q ON q.id = ar.question_id
         WHERE ar.user_id = ?
         ORDER BY q.standard_name, q.category, q.id`
      ).all(req.user.id);

      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get AI analysis for user's responses
  router.get('/my-analysis', authenticateToken, (req, res) => {
    try {
      const rows = db.prepare(
        `SELECT aa.*, ar.question_id, ar.answer, ar.comment,
                q.standard_name, q.category, q.clause_number, q.question_text
         FROM ai_analysis aa
         JOIN audit_responses ar ON ar.id = aa.response_id
         JOIN questions q ON q.id = ar.question_id
         WHERE ar.user_id = ?
         ORDER BY aa.ai_score ASC`
      ).all(req.user.id);

      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Check if AI analysis is complete
  router.get('/analysis-status', authenticateToken, (req, res) => {
    try {
      const totalRow = db.prepare(
        'SELECT COUNT(*) as total FROM audit_responses WHERE user_id = ?'
      ).get(req.user.id);

      const doneRow = db.prepare(
        `SELECT COUNT(*) as total FROM ai_analysis aa
         JOIN audit_responses ar ON ar.id = aa.response_id
         WHERE ar.user_id = ?`
      ).get(req.user.id);

      const total = totalRow.total;
      const done = doneRow.total;

      res.json({
        success: true,
        data: {
          totalResponses: total,
          analyzedCount: done,
          isComplete: done >= total && total > 0,
          progress: total > 0 ? Math.round((done / total) * 100) : 0
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};

// Background AI analysis function
async function generateAIAnalysis(db, callClaude, user, insertedResponses) {
  console.log(`[AI] Starting analysis for user ${user.id} (${user.company}) — ${insertedResponses.length} responses`);

  const responses = db.prepare(
    `SELECT ar.id as response_id, ar.answer, ar.comment, ar.question_id,
            q.standard_name, q.category, q.clause_number, q.question_text
     FROM audit_responses ar
     JOIN questions q ON q.id = ar.question_id
     WHERE ar.user_id = ?
     ORDER BY q.standard_name, q.category`
  ).all(user.id);

  const gaps = responses.filter(r => !r.answer);
  const strengths = responses.filter(r => r.answer);

  // Delete old analysis for this user
  db.prepare(
    `DELETE FROM ai_analysis WHERE response_id IN (
       SELECT id FROM audit_responses WHERE user_id = ?
     )`
  ).run(user.id);

  const insertAnalysis = db.prepare(
    `INSERT INTO ai_analysis (response_id, ai_score, gap_analysis, recommendation)
     VALUES (?, ?, ?, ?)`
  );

  // Analyze each gap with Claude
  for (const gap of gaps) {
    try {
      const prompt = buildAnalysisPrompt(gap, user.company, strengths.length, gaps.length, responses.length);
      const aiResponse = await callClaude(prompt);

      let parsed;
      try {
        const clean = aiResponse.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(clean);
      } catch {
        parsed = { score: 30, gapAnalysis: aiResponse, recommendation: 'See full analysis above.' };
      }

      insertAnalysis.run(
        gap.response_id,
        parsed.score || 30,
        parsed.gapAnalysis || parsed.gap_analysis || aiResponse,
        parsed.recommendation || ''
      );

      console.log(`[AI] Analyzed gap: ${gap.clause_number} - ${gap.category} (score: ${parsed.score || 30})`);
    } catch (err) {
      console.error(`[AI] Error analyzing ${gap.clause_number}:`, err.message);
      insertAnalysis.run(
        gap.response_id, 20,
        `Gap identified in ${gap.category}: ${gap.question_text}`,
        'AI analysis could not be completed. Manual review recommended.'
      );
    }
  }

  // Also create entries for strengths (high scores)
  for (const strength of strengths) {
    insertAnalysis.run(
      strength.response_id, 85,
      `Strength: ${strength.category} - ${strength.question_text} is properly implemented.`,
      'Continue maintaining this control and conduct periodic reviews.'
    );
  }

  console.log(`[AI] Analysis complete for user ${user.id}: ${gaps.length} gaps, ${strengths.length} strengths`);
}

function buildAnalysisPrompt(gap, company, strengthCount, gapCount, totalCount) {
  const overallScore = Math.round((strengthCount / totalCount) * 100);

  return `You are a senior GRC (Governance, Risk, Compliance) consultant with 25 years of experience at a Big 4 firm. Analyze this specific security gap for "${company}".

CONTEXT:
- Company: ${company}
- Overall compliance: ${overallScore}% (${strengthCount}/${totalCount} controls met)
- Total gaps identified: ${gapCount}
- Standard: ${gap.standard_name}
- Category: ${gap.category}
- Clause: ${gap.clause_number}
- Control question: ${gap.question_text}
- Answer: NO (gap identified)
${gap.comment ? `- User comment: ${gap.comment}` : ''}

Provide a detailed JSON analysis. Respond ONLY with valid JSON:

{
  "score": <number 0-100, where 0=critical gap, 100=no concern>,
  "gapAnalysis": "<3-4 paragraphs explaining: 1) WHY this gap is dangerous — what specific attack vectors or compliance violations it enables. 2) HOW attackers can exploit this gap — describe realistic attack scenarios step by step. 3) WHAT real-world incidents have occurred due to this gap — name specific breaches, fines, or incidents. 4) WHAT the business impact could be — financial losses, regulatory penalties, reputational damage, operational disruption.>",
  "recommendation": "<Detailed remediation plan with: 1) Immediate actions (this week). 2) Short-term fixes (1-3 months). 3) Long-term strategy (3-12 months). 4) Specific tools and frameworks to implement. 5) Who should be responsible (CISO, IT Manager, etc.). 6) Success metrics to verify the gap is closed. 7) Estimated cost and effort.>"
}

IMPORTANT RULES:
- Be extremely specific and technical, not generic
- Reference the exact ${gap.standard_name} clause ${gap.clause_number}
- Describe realistic attack scenarios that exploit THIS specific gap
- Name real tools attackers use and real tools for defense
- Include specific compliance penalties (GDPR fines, etc.)
- The score should reflect severity: access control gaps = 10-25, policy gaps = 30-50, monitoring gaps = 20-40`;
}
