const reportsService = require('../services/reports.service');
const aiService = require('../services/ai.service');

function getMyReport(req, res) {
  try {
    const data = reportsService.getMyReport(req.user.id);

    if (!data) {
      return res.json({ success: true, data: null, message: 'No assessment data found' });
    }

    res.json({ success: true, data });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    console.error('[Report] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getExecutiveSummary(req, res) {
  try {
    const data = await aiService.generateExecutiveSummary(req.user.id, req.user.company);
    res.json({ success: true, data });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    console.error('[Report] Executive summary error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

function getStats(req, res) {
  try {
    const data = reportsService.getStats(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { getMyReport, getExecutiveSummary, getStats };
