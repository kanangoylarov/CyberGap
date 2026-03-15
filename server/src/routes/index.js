import { Router } from 'express';
import AuthRoutes from "./auth.routes.js"
import QuestionRoutes from "./question.routes.js"
import AuditRoutes from "./auditresponse.routes.js"

const router = Router();

// Mount routes
router.use("/auth",AuthRoutes)
router.use("/question",QuestionRoutes)
router.use("/audit",AuditRoutes)

export default router;
