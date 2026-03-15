const { getDb } = require('../config/database');
const { callClaude } = require('../config/claude');

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

function buildExecutiveSummaryPrompt(company, overallScore, rows, gaps, strengths) {
  const gapSummary = gaps.map(g =>
    `- [${g.standard_name} ${g.clause_number}] ${g.category}: ${g.question_text} (AI Score: ${g.ai_score || 'N/A'})`
  ).join('\n');

  const strengthSummary = strengths.map(s =>
    `- [${s.standard_name} ${s.clause_number}] ${s.category}: ${s.question_text}`
  ).join('\n');

  return `You are a senior GRC consultant writing a board-level executive report for "${company}".

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
}

async function generateAnalysisForUser(user, insertedResponses) {
  const db = getDb();

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

async function generateExecutiveSummary(userId, company) {
  const db = getDb();

  const rows = db.prepare(
    `SELECT ar.answer, q.standard_name, q.category, q.clause_number, q.question_text,
            aa.ai_score, aa.gap_analysis
     FROM audit_responses ar
     JOIN questions q ON q.id = ar.question_id
     LEFT JOIN ai_analysis aa ON aa.response_id = ar.id
     WHERE ar.user_id = ?`
  ).all(userId);

  if (rows.length === 0) {
    const err = new Error('No assessment data found');
    err.statusCode = 404;
    throw err;
  }

  const gaps = rows.filter(r => !r.answer);
  const strengths = rows.filter(r => r.answer);
  const overallScore = Math.round((strengths.length / rows.length) * 100);

  const prompt = buildExecutiveSummaryPrompt(company, overallScore, rows, gaps, strengths);
  const aiResponse = await callClaude(prompt);

  let parsed;
  try {
    const clean = aiResponse.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    parsed = { executiveSummary: aiResponse };
  }

  return parsed;
}

module.exports = { generateAnalysisForUser, generateExecutiveSummary };
