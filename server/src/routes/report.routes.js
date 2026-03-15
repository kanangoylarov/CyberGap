import { Router } from 'express';
const router = Router();
import ReportController from '../controllers/report.controller.js';
import AuthMiddleware from '../middlewares/auth.middleware.js';

router.get('/my-report', AuthMiddleware.protect, ReportController.getMyReport);
router.post('/analyze', AuthMiddleware.protect, ReportController.analyze);
router.get('/evaluation', AuthMiddleware.protect, ReportController.getLatestEvaluation);

export default router;
