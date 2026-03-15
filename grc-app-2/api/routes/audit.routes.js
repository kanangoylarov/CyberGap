const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const auditController = require('../controllers/audit.controller');

const router = express.Router();

router.post('/submit', authenticateToken, auditController.submit);
router.get('/my-responses', authenticateToken, auditController.getMyResponses);
router.get('/my-analysis', authenticateToken, auditController.getMyAnalysis);
router.get('/analysis-status', authenticateToken, auditController.getAnalysisStatus);

module.exports = router;
