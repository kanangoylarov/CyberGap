import { Router } from 'express';
const router = Router();
import QuestionController from '../controllers/question.controller.js';
import AuthMiddleware from '../middlewares/auth.middleware.js';


router.post('/create', AuthMiddleware.protect, AuthMiddleware.checkRole, QuestionController.create);
router.delete('/delete/:id', AuthMiddleware.protect, AuthMiddleware.checkRole, QuestionController.delete);
router.put('/update/:id', AuthMiddleware.protect, AuthMiddleware.checkRole, QuestionController.update);
router.get('/all-grouped', AuthMiddleware.protect, QuestionController.getAllGrouped);
router.get('/questions', AuthMiddleware.protect, QuestionController.getQuestions);
export default router;