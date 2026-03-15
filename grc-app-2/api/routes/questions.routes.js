const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const questionsController = require('../controllers/questions.controller');

const router = express.Router();

router.get('/', authenticateToken, questionsController.getGrouped);
router.get('/flat', authenticateToken, questionsController.getFlat);
router.post('/', authenticateToken, requireAdmin, questionsController.create);
router.delete('/:id', authenticateToken, requireAdmin, questionsController.remove);

module.exports = router;
