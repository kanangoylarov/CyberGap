import { PrismaClient } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();

class ReportController {

  static async getMyReport(req, res) {
    try {
      const userId = req.user.userId;

      const [questions, responses, user] = await Promise.all([
        prisma.question.findMany({ orderBy: [{ category: 'asc' }, { clauseNumber: 'asc' }] }),
        prisma.auditResponse.findMany({
          where: { userId },
          include: { question: true }
        }),
        prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, company: true, email: true } })
      ]);

      // Build response map
      const responseMap = {};
      for (const r of responses) {
        responseMap[r.questionId] = r;
      }

      // Group by category and calculate scores
      const categoryMap = {};
      let totalCompliant = 0;
      const gaps = [];
      const strengths = [];

      for (const q of questions) {
        const cat = q.category || 'Uncategorized';
        if (!categoryMap[cat]) {
          categoryMap[cat] = { name: cat, standard: q.standardName, total: 0, compliant: 0, gaps: 0 };
        }
        categoryMap[cat].total++;

        const resp = responseMap[q.id];
        if (resp && resp.answer === true) {
          categoryMap[cat].compliant++;
          totalCompliant++;
          strengths.push({
            questionId: q.id,
            questionText: q.questionText,
            category: cat,
            clauseNumber: q.clauseNumber,
            standardName: q.standardName,
            comment: resp.comment,
          });
        } else {
          categoryMap[cat].gaps++;
          gaps.push({
            questionId: q.id,
            questionText: q.questionText,
            category: cat,
            clauseNumber: q.clauseNumber,
            standardName: q.standardName,
            comment: resp?.comment || null,
            answered: !!resp,
          });
        }
      }

      // Calculate category scores
      const categories = Object.values(categoryMap).map(c => ({
        ...c,
        score: c.total > 0 ? Math.round((c.compliant / c.total) * 100) : 0,
      }));

      const totalQuestions = questions.length;
      const totalAnswered = responses.length;
      const overallScore = totalQuestions > 0 ? Math.round((totalCompliant / totalQuestions) * 100) : 0;

      let riskLevel = 'High';
      if (overallScore >= 80) riskLevel = 'Low';
      else if (overallScore >= 50) riskLevel = 'Medium';

      return res.status(StatusCodes.OK).json({
        company: user?.company || 'N/A',
        assessedBy: user ? `${user.firstName} ${user.lastName}` : 'N/A',
        email: user?.email,
        date: new Date().toISOString(),
        overallScore,
        riskLevel,
        totalQuestions,
        totalAnswered,
        totalCompliant,
        totalGaps: gaps.length,
        categories,
        gaps,
        strengths,
      });
    } catch (error) {
      console.error("Report error:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Failed to generate report." });
    }
  }
  static async analyze(req, res) {
    try {
      const userId = req.user.userId;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: "GEMINI_API_KEY not configured." });
      }

      // Fetch all data
      const [questions, responses, user] = await Promise.all([
        prisma.question.findMany({ orderBy: [{ category: 'asc' }] }),
        prisma.auditResponse.findMany({ where: { userId }, include: { question: true } }),
        prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, company: true } })
      ]);

      const responseMap = {};
      for (const r of responses) {
        responseMap[r.questionId] = r;
      }

      // Build assessment data for prompt
      const assessmentData = [];
      const evidenceFiles = [];
      for (const q of questions) {
        const resp = responseMap[q.id];
        const entry = {
          category: q.category || 'Uncategorized',
          standard: q.standardName,
          clause: q.clauseNumber,
          question: q.questionText,
          compliant: resp ? resp.answer : false,
          comment: resp?.comment || 'No comment provided',
          hasEvidence: !!resp?.filePath,
          evidenceUrl: resp?.filePath || null,
        };
        assessmentData.push(entry);
        if (resp?.filePath) {
          evidenceFiles.push({
            question: q.questionText,
            category: q.category,
            clause: q.clauseNumber,
            standard: q.standardName,
            url: resp.filePath,
            compliant: resp.answer,
          });
        }
      }

      const totalQuestions = questions.length;
      const totalCompliant = assessmentData.filter(a => a.compliant).length;
      const overallScore = totalQuestions > 0 ? Math.round((totalCompliant / totalQuestions) * 100) : 0;

      // Try to fetch evidence file contents for AI analysis
      let evidenceAnalysisSection = '';
      if (evidenceFiles.length > 0) {
        evidenceAnalysisSection = `\n\n=== UPLOADED EVIDENCE FILES (${evidenceFiles.length} files) ===
The following evidence documents were uploaded by the assessor. Analyze whether the evidence adequately supports the compliance claim:

${evidenceFiles.map((f, i) => `Evidence ${i + 1}:
  For: [${f.standard}] ${f.category} - Clause ${f.clause}
  Question: ${f.question}
  Compliance Claim: ${f.compliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
  File URL: ${f.url}
  NOTE: Evaluate whether having this evidence file is sufficient for this control. Consider if the evidence type matches what ISO/NIST standards require for this specific clause.`).join('\n\n')}`;
      }

      const prompt = `You are a senior cybersecurity GRC (Governance, Risk, and Compliance) analyst specializing in ISO 27001, ISO 27002, NIST CSF, SOC 2, GDPR, and other international security standards.

Perform a COMPREHENSIVE audit evaluation of the following security assessment. Your analysis must:
1. Reference specific ISO 27001/27002 clauses and NIST CSF categories where applicable
2. Identify gaps against the specific standard requirements
3. Evaluate the quality and sufficiency of provided evidence
4. Assess whether uploaded documents adequately support compliance claims
5. Provide actionable, standard-specific remediation steps

Company: ${user?.company || 'Unknown'}
Assessor: ${user?.firstName || ''} ${user?.lastName || ''}
Overall Compliance: ${overallScore}% (${totalCompliant}/${totalQuestions} controls met)

=== ASSESSMENT RESULTS ===
${assessmentData.map((a, i) => `${i + 1}. [${a.standard}] ${a.category} - Clause ${a.clause}
   Question: ${a.question}
   Status: ${a.compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}
   Assessor Comment: ${a.comment}
   Evidence Document: ${a.hasEvidence ? 'UPLOADED - ' + a.evidenceUrl : '⚠️ NO EVIDENCE PROVIDED'}
   ${!a.hasEvidence && a.compliant ? '⚠️ WARNING: Marked compliant but no evidence uploaded' : ''}`).join('\n\n')}
${evidenceAnalysisSection}

Provide your comprehensive analysis as valid JSON with this exact structure:
{
  "overallScore": <0-100 expert risk-adjusted score>,
  "riskLevel": "<Critical|High|Medium|Low>",
  "executiveSummary": "<4-5 sentence board-level summary covering: current security posture, major risk areas, compliance gaps against ISO/NIST standards, and urgency of remediation>",
  "isoCompliance": {
    "iso27001Score": <0-100>,
    "nistScore": <0-100>,
    "majorNonConformities": ["<list of major non-conformities against ISO 27001 Annex A controls>"],
    "minorNonConformities": ["<list of minor non-conformities>"],
    "observationsForImprovement": ["<list of improvement opportunities>"]
  },
  "evidenceAssessment": {
    "totalEvidenceProvided": <number>,
    "totalEvidenceRequired": <number>,
    "evidenceGaps": [
      {
        "control": "<clause number and name>",
        "issue": "<what evidence is missing or insufficient>",
        "requiredEvidence": "<what ISO/NIST standard requires as evidence for this control>"
      }
    ],
    "evidenceQuality": "<Overall assessment of evidence quality: Insufficient|Partial|Adequate|Comprehensive>"
  },
  "categoryAnalysis": [
    {
      "category": "<category name>",
      "score": <0-100>,
      "status": "<Critical|Needs Improvement|Acceptable|Strong>",
      "isoReference": "<relevant ISO 27001/27002 clause references>",
      "findings": "<3-4 sentence detailed analysis referencing specific standard requirements>",
      "recommendation": "<specific actionable recommendation with ISO clause reference>",
      "evidenceStatus": "<Missing|Insufficient|Adequate>"
    }
  ],
  "topRisks": [
    {
      "risk": "<risk title>",
      "severity": "<Critical|High|Medium>",
      "isoClause": "<relevant ISO/NIST clause>",
      "description": "<detailed description of the risk>",
      "impact": "<specific business and compliance impact>",
      "attackVector": "<how an attacker could exploit this gap>",
      "mitigation": "<step-by-step immediate action to take>"
    }
  ],
  "recommendations": [
    {
      "priority": "<Immediate|Short-term|Long-term>",
      "isoClause": "<relevant standard clause>",
      "action": "<specific recommendation>",
      "rationale": "<why this matters from compliance and security perspective>",
      "expectedOutcome": "<what this will achieve>"
    }
  ]
}

IMPORTANT: Return ONLY valid JSON, no markdown formatting or code blocks.`;

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Parse JSON from response
      let evaluation;
      try {
        const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        evaluation = JSON.parse(cleanJson);
      } catch {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Failed to parse AI response.", raw: text });
      }

      // Generate full text report using the JSON analysis
      const reportPrompt = `You are a senior GRC auditor. Based on the following security assessment analysis, generate a comprehensive, professional TEXT-BASED AUDIT REPORT that can be saved and printed.

Company: ${user?.company || 'Unknown'}
Assessor: ${user?.firstName || ''} ${user?.lastName || ''}
Date: ${new Date().toLocaleDateString('en-GB')}
Assessment Data: ${JSON.stringify(evaluation, null, 2)}

Generate a detailed, well-structured audit report in plain text (Markdown format). The report MUST include:

1. **EXECUTIVE SUMMARY** - Board-level overview
2. **SCOPE & METHODOLOGY** - What was assessed and how
3. **OVERALL COMPLIANCE STATUS** - Scores, risk level
4. **ISO 27001 / NIST COMPLIANCE ASSESSMENT** - Detailed clause-by-clause analysis
5. **EVIDENCE REVIEW** - Assessment of uploaded documents, what's missing
6. **CATEGORY-BY-CATEGORY FINDINGS** - For each security domain, detail findings, gaps, and scores
7. **TOP SECURITY RISKS** - Ranked by severity with attack vectors and business impact
8. **NON-CONFORMITY REGISTER** - Major and minor non-conformities with ISO clause references
9. **REMEDIATION ROADMAP** - Immediate (0-30 days), Short-term (1-3 months), Long-term (3-12 months)
10. **CONCLUSION & SIGN-OFF** - Final assessment statement

Make it professional, detailed, and actionable. Use specific ISO 27001 Annex A and NIST CSF references throughout. This should read like a real GRC audit report from a Big 4 consulting firm.`;

      let fullReport = '';
      try {
        const reportResult = await model.generateContent(reportPrompt);
        fullReport = reportResult.response.text();
      } catch (reportErr) {
        console.error("Full report generation failed:", reportErr);
        fullReport = `# Security Assessment Report\n\n## Executive Summary\n${evaluation.executiveSummary}\n\n## Risk Level: ${evaluation.riskLevel}\n## Overall Score: ${evaluation.overallScore}/100`;
      }

      // Store evaluation + full report
      await prisma.aiEvaluation.create({
        data: {
          userId,
          overallScore: evaluation.overallScore || overallScore,
          riskLevel: evaluation.riskLevel || 'Unknown',
          summary: JSON.stringify({
            executiveSummary: evaluation.executiveSummary,
            isoCompliance: evaluation.isoCompliance,
            evidenceAssessment: evaluation.evidenceAssessment,
          }),
          categoryScores: JSON.stringify(evaluation.categoryAnalysis || []),
          gaps: JSON.stringify(evaluation.topRisks || []),
          recommendations: JSON.stringify(evaluation.recommendations || []),
          fullReport,
        }
      });

      return res.status(StatusCodes.OK).json({ ...evaluation, fullReport });
    } catch (error) {
      console.error("Analysis error:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Failed to generate AI analysis." });
    }
  }

  static async getLatestEvaluation(req, res) {
    try {
      const userId = req.user.userId;
      const evaluation = await prisma.aiEvaluation.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      if (!evaluation) {
        return res.status(StatusCodes.NOT_FOUND).json({ error: "No AI evaluation found. Run analysis first." });
      }

      let summaryData = {};
      try { summaryData = JSON.parse(evaluation.summary || '{}'); } catch { summaryData = { executiveSummary: evaluation.summary }; }

      return res.status(StatusCodes.OK).json({
        overallScore: evaluation.overallScore,
        riskLevel: evaluation.riskLevel,
        executiveSummary: summaryData.executiveSummary || evaluation.summary,
        isoCompliance: summaryData.isoCompliance || null,
        evidenceAssessment: summaryData.evidenceAssessment || null,
        categoryAnalysis: JSON.parse(evaluation.categoryScores || '[]'),
        topRisks: JSON.parse(evaluation.gaps || '[]'),
        recommendations: JSON.parse(evaluation.recommendations || '[]'),
        fullReport: evaluation.fullReport || null,
        createdAt: evaluation.createdAt,
      });
    } catch (error) {
      console.error("Get evaluation error:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Failed to fetch evaluation." });
    }
  }
}

export default ReportController;
