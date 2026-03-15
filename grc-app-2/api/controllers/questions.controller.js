const questionsService = require('../services/questions.service');

function getGrouped(req, res) {
  try {
    const { grouped, total } = questionsService.getGrouped();
    res.json({ success: true, data: grouped, total });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function getFlat(req, res) {
  try {
    const { standard } = req.query;
    const data = questionsService.getFlat(standard);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function create(req, res) {
  const { standardName, category, clauseNumber, questionText } = req.body;

  if (!questionText) {
    return res.status(400).json({ success: false, error: 'questionText is required' });
  }

  try {
    const data = questionsService.create({ standardName, category, clauseNumber, questionText });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function remove(req, res) {
  try {
    questionsService.remove(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { getGrouped, getFlat, create, remove };
