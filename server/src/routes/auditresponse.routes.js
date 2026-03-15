import { Router } from 'express';
const router = Router();
import  AuditController  from "../controllers/auditresponse.controller.js";
import AuthMiddleware from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";



router.post("/bulk-submit", AuthMiddleware.protect, AuditController.bulkSubmit);
router.post("/upload-file/:questionId", AuthMiddleware.protect, upload.single("file"), AuditController.uploadFile);

router.post(
  "/submit",
  AuthMiddleware.protect,
  upload.single("filePath"), 
  AuditController.create,
);

router.get("/responses", AuthMiddleware.protect, AuditController.getResponses);

router.put("/update/:id", AuthMiddleware.protect, AuditController.update);

router.delete("/delete/:id", AuthMiddleware.protect, AuditController.delete);

export default router;
