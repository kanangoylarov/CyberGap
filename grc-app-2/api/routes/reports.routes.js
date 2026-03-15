const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const reportsController = require('../controllers/reports.controller');

const router = express.Router();

router.get('/my-report', authenticateToken, reportsController.getMyReport);
router.get('/executive-summary', authenticateToken, reportsController.getExecutiveSummary);
router.get('/stats', authenticateToken, reportsController.getStats);

module.exports = router;
