const express = require('express');
const { authenticateToken } = require('../middleware/auth');

module.exports = function (db, callClaude) {
  const router = express.Router();

  // Get full report for current user
  router.get('/my-report', authenticateToken, (req, res) => {
    try {
      const user = db.prepare(
        'SELECT id, first_name, last_name, email, company FROM users WHERE id = ?'
      ).get(req.user.id);

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const rows = db.prepare(
        `SELECT ar.id as response_id, ar.answer, ar.comment, ar.file_path, ar.created_at,
                q.id as question_id, q.standard_name, q.category, q.clause_number, q.question_text,
                aa.ai_score, aa.gap_analysis, aa.recommendation
         FROM audit_responses ar
         JOIN questions q ON q.id = ar.question_id
         LEFT JOIN ai_analysis aa ON aa.response_id = ar.id
         WHERE ar.user_id = ?
         ORDER BY q.standard_name, q.category, q.id`
      ).all(req.user.id);

      if (rows.length === 0) {
        return res.json({ success: true, data: null, message: 'No assessment data found' });
      }

      const totalQuestions = rows.length;
      const gaps = rows.filter(r => !r.answer);
      const strengths = rows.filter(r => r.answer);
      const overallScore = Math.round((strengths.length / totalQuestions) * 100);

      // Group by category
      const categories = {};
      for (const r of rows) {
        const key = `${r.standard_name} - ${r.category}`;
        if (!categories[key]) {
          categories[key] = { standard: r.standard_name, category: r.category, questions: [], gaps: 0, strengths: 0 };
        }
        categories[key].questions.push(r);
        if (r.answer) categories[key].strengths++;
        else categories[key].gaps++;
      }

      const categoryScores = Object.entries(categories).map(([key, cat]) => ({
        name: key,
        standard: cat.standard,
        category: cat.category,
        score: Math.round((cat.strengths / cat.questions.length) * 100),
        total: cat.questions.length,
        gaps: cat.gaps,
        strengths: cat.strengths
      }));

      const riskLevel = overallScore >= 71 ? 'Low Risk' : overallScore >= 41 ? 'Medium Risk' : 'High Risk';
      const maturity = overallScore >= 81 ? 'Optimizing' : overallScore >= 61 ? 'Managed'
        : overallScore >= 41 ? 'Defined' : overallScore >= 21 ? 'Developing' : 'Initial';

      const criticalGaps = rows
        .filter(r => !r.answer && r.ai_score !== null)
        .sort((a, b) => (a.ai_score || 0) - (b.ai_score || 0))
        .map(g => ({
          questionId: g.question_id,
          standard: g.standard_name,
          category: g.category,
          clause: g.clause_number,
          question: g.question_text,
          aiScore: g.ai_score,
          gapAnalysis: g.gap_analysis,
          recommendation: g.recommendation,
          comment: g.comment
        }));

      res.json({
        success: true,
        data: {
          company: user.company,
          assessedBy: `${user.first_name} ${user.last_name}`,
          email: user.email,
          date: rows[0].created_at,
          overallScore,
          riskLevel,
          maturityLevel: maturity,
          totalQuestions,
          totalGaps: gaps.length,
          totalStrengths: strengths.length,
          categoryScores,
          criticalGaps,
          strengths: strengths.map(s => ({
            questionId: s.question_id,
            standard: s.standard_name,
            category: s.category,
            clause: s.clause_number,
            question: s.question_text
          }))
        }
      });
    } catch (err) {
      console.error('[Report] Error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Generate executive summary via Claude
  router.get('/executive-summary', authenticateToken, async (req, res) => {
    try {
      const rows = db.prepare(
        `SELECT ar.answer, q.standard_name, q.category, q.clause_number, q.question_text,
                aa.ai_score, aa.gap_analysis
         FROM audit_responses ar
         JOIN questions q ON q.id = ar.question_id
         LEFT JOIN ai_analysis aa ON aa.response_id = ar.id
         WHERE ar.user_id = ?`
      ).all(req.user.id);

      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'No assessment data found' });
      }

      const gaps = rows.filter(r => !r.answer);
      const strengths = rows.filter(r => r.answer);
      const overallScore = Math.round((strengths.length / rows.length) * 100);

      const gapSummary = gaps.map(g =>
        `- [${g.standard_name} ${g.clause_number}] ${g.category}: ${g.question_text} (AI Score: ${g.ai_score || 'N/A'})`
      ).join('\n');

      const strengthSummary = strengths.map(s =>
        `- [${s.standard_name} ${s.clause_number}] ${s.category}: ${s.question_text}`
      ).join('\n');

      const prompt = `You are a senior GRC consultant writing a board-level executive report for "${req.user.company}".

ASSESSMENT RESULTS:
- Overall Score: ${overallScore}/100
- Total Controls Assessed: ${rows.length}
- Gaps Found: ${gaps.length}
- Controls Met: ${strengths.length}

GAPS:
${gapSummary}

STRENGTHS:
${strengthSummary}

Write a comprehensive executive report in JSON format:

{
  "boardStatement": "3-4 sentence urgent statement to the board with specific numbers",
  "executiveSummary": "5-6 sentence overview of the GRC posture, critical risks, and strategic priorities",
  "topRisks": [
    {
      "risk": "risk name",
      "severity": "Critical|High|Medium",
      "description": "how attackers can exploit this",
      "businessImpact": "financial/operational/legal impact",
      "immediateAction": "what to do this week"
    }
  ],
  "attackScenarios": [
    {
      "scenario": "scenario name",
      "description": "step-by-step how an attacker would exploit the identified gaps",
      "gapsExploited": ["clause numbers"],
      "likelihood": "High|Medium|Low",
      "impact": "estimated damage"
    }
  ],
  "complianceRisks": [
    {
      "regulation": "GDPR/ISO 27001/NIST/etc",
      "status": "Non-Compliant|Partially Compliant",
      "gaps": ["specific gaps"],
      "penalty": "potential fine or sanction",
      "deadline": "when to fix"
    }
  ],
  "roadmap": {
    "immediate": ["actions for this week"],
    "shortTerm": ["actions for 1-3 months"],
    "longTerm": ["actions for 3-12 months"]
  },
  "investmentEstimate": {
    "minimum": "min budget",
    "maximum": "max budget",
    "roi": "return on investment narrative"
  }
}

Be extremely specific. Name real attack tools, real incidents, real penalties. This report must be actionable.`;

      const aiResponse = await callClaude(prompt);
      let parsed;
      try {
        const clean = aiResponse.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(clean);
      } catch {
        parsed = { executiveSummary: aiResponse };
      }

      res.json({ success: true, data: parsed });
    } catch (err) {
      console.error('[Report] Executive summary error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Dashboard stats
  router.get('/stats', authenticateToken, (req, res) => {
    try {
      const totalRow = db.prepare(
        'SELECT COUNT(*) as total FROM audit_responses WHERE user_id = ?'
      ).get(req.user.id);

      const gapsRow = db.prepare(
        'SELECT COUNT(*) as total FROM audit_responses WHERE user_id = ? AND answer = 0'
      ).get(req.user.id);

      const avgRow = db.prepare(
        `SELECT AVG(aa.ai_score) as avg_score FROM ai_analysis aa
         JOIN audit_responses ar ON ar.id = aa.response_id
         WHERE ar.user_id = ? AND ar.answer = 0`
      ).get(req.user.id);

      const totalResponses = totalRow.total;
      const totalGaps = gapsRow.total;
      const totalStrengths = totalResponses - totalGaps;
      const overallScore = totalResponses > 0 ? Math.round((totalStrengths / totalResponses) * 100) : 0;

      res.json({
        success: true,
        data: {
          totalResponses,
          totalGaps,
          totalStrengths,
          overallScore,
          avgGapScore: Math.round(avgRow.avg_score || 0),
          riskLevel: overallScore >= 71 ? 'Low Risk' : overallScore >= 41 ? 'Medium Risk' : 'High Risk'
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
