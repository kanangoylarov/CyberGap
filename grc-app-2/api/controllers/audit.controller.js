const auditService = require('../services/audit.service');

function submit(req, res) {
  const { responses } = req.body;

  if (!responses || !Array.isArray(responses) || responses.length === 0) {
    return res.status(400).json({ success: false, error: 'responses array is required' });
  }

  try {
    const result = auditService.submitResponses(req.user.id, req.user, responses);
    res.json({
      success: true,
      data: {
        totalResponses: result.totalResponses,
        message: 'Responses saved. AI analysis is being generated...',
      },
    });
  } catch (err) {
    console.error('[Audit] Submit error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to save responses' });
  }
}

function getMyResponses(req, res) {
  try {
    const data = auditService.getMyResponses(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function getMyAnalysis(req, res) {
  try {
    const data = auditService.getMyAnalysis(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function getAnalysisStatus(req, res) {
  try {
    const data = auditService.getAnalysisStatus(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { submit, getMyResponses, getMyAnalysis, getAnalysisStatus };
