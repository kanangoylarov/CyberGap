const { getDb } = require('../config/database');

function getRiskLevel(score) {
  if (score >= 71) return 'Low Risk';
  if (score >= 41) return 'Medium Risk';
  return 'High Risk';
}

function getMaturityLevel(score) {
  if (score >= 81) return 'Optimizing';
  if (score >= 61) return 'Managed';
  if (score >= 41) return 'Defined';
  if (score >= 21) return 'Developing';
  return 'Initial';
}

function getMyReport(userId) {
  const db = getDb();

  const user = db.prepare(
    'SELECT id, first_name, last_name, email, company FROM users WHERE id = ?'
  ).get(userId);

  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
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
  ).all(userId);

  if (rows.length === 0) {
    return null;
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
    strengths: cat.strengths,
  }));

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
      comment: g.comment,
    }));

  return {
    company: user.company,
    assessedBy: `${user.first_name} ${user.last_name}`,
    email: user.email,
    date: rows[0].created_at,
    overallScore,
    riskLevel: getRiskLevel(overallScore),
    maturityLevel: getMaturityLevel(overallScore),
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
      question: s.question_text,
    })),
  };
}

function getStats(userId) {
  const db = getDb();

  const totalRow = db.prepare(
    'SELECT COUNT(*) as total FROM audit_responses WHERE user_id = ?'
  ).get(userId);

  const gapsRow = db.prepare(
    'SELECT COUNT(*) as total FROM audit_responses WHERE user_id = ? AND answer = 0'
  ).get(userId);

  const avgRow = db.prepare(
    `SELECT AVG(aa.ai_score) as avg_score FROM ai_analysis aa
     JOIN audit_responses ar ON ar.id = aa.response_id
     WHERE ar.user_id = ? AND ar.answer = 0`
  ).get(userId);

  const totalResponses = totalRow.total;
  const totalGaps = gapsRow.total;
  const totalStrengths = totalResponses - totalGaps;
  const overallScore = totalResponses > 0 ? Math.round((totalStrengths / totalResponses) * 100) : 0;

  return {
    totalResponses,
    totalGaps,
    totalStrengths,
    overallScore,
    avgGapScore: Math.round(avgRow.avg_score || 0),
    riskLevel: getRiskLevel(overallScore),
  };
}

module.exports = { getMyReport, getStats };
