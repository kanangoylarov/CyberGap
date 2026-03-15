import { Router } from 'express';
import AuthRoutes from "./auth.routes.js"
import QuestionRoutes from "./question.routes.js"
import AuditRoutes from "./auditresponse.routes.js"
import ReportRoutes from "./report.routes.js"

const router = Router();

// Mount routes
router.use("/auth",AuthRoutes)
router.use("/question",QuestionRoutes)
router.use("/audit",AuditRoutes)
router.use("/report",ReportRoutes)

export default router;
