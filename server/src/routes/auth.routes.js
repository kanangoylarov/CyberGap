import { Router } from 'express';
const router = Router();
import AuthController from '../controllers/auth.controller.js';
import AuthMiddleware from '../middlewares/auth.middleware.js';

// Signup endpointi
router.post('/signup', AuthController.signup);
router.post('/signin', AuthController.signin);
router.post('/signout',AuthMiddleware.protect, AuthController.signout);
router.get('/role',AuthMiddleware.protect, AuthController.getRole);
router.get('/users',AuthMiddleware.protect,AuthMiddleware.checkRole, AuthController.getAllUsers);
export default router;