import { PrismaClient } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { supabase } from '../config/supabase.js';

const prisma = new PrismaClient();

class AuditController {
  
  // 1. Create/Submit Audit Response
  static async create(req, res) {
    console.log("aaaaaaaaaaaaaa",req.user.userId);
  try {
  
    const userId = req.user.userId; 
    
    
    const { questionId, answer, comment } = req.body;
    let finalFilePath = null;

    
    if (req.file) {
      const file = req.file;
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const fullPath = `audits/${fileName}`; 

      const { data, error: uploadError } = await supabase.storage
        .from('audit_files') 
        .upload(fullPath, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        return res.status(StatusCodes.BAD_REQUEST).json({ error: "File upload failed." });
      }

      
      const { data: { publicUrl } } = supabase.storage
        .from('audit_files')
        .getPublicUrl(fullPath);

      finalFilePath = publicUrl;
    }

    
    const response = await prisma.auditResponse.create({
      data: { 
        userId, 
        questionId: parseInt(questionId), 
        answer: answer === 'true', 
        comment, 
        filePath: finalFilePath 
      }
    });

    return res.status(StatusCodes.CREATED).json(response);
  } catch (error) {
    console.error("Database error:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Failed to create audit response." });
  }
}
  // 2. Update Audit Response
  static async update(req, res) {
  try {
    const { id } = req.params;
    const { answer, comment, filePath } = req.body;

    const updated = await prisma.auditResponse.update({
      where: { id: parseInt(id) },
      data: { 
        answer: answer === 'true', 
        comment, 
        filePath 
      }
    });
    console.log(updated);
    
    return res.status(StatusCodes.OK).json(updated);
  } catch (error) {
    console.error("Update error:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Failed to update audit response." });
  }
}

  // 3. Delete Audit Response
static async delete(req, res) {
  try {
    const { id } = req.params;
    const responseId = parseInt(id);

    // 1. Retrieve the record from the database to get the file path
    const response = await prisma.auditResponse.findUnique({
      where: { id: responseId }
    });

    if (!response) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Response not found." });
    }

    // 2. If a file path exists, delete the file from Supabase storage
    if (response.filePath) {
      try {
        const bucketName = 'audit_files';
        
        // Use URL object to parse the path more reliably
        const url = new URL(response.filePath);
        // The pathname usually looks like: /storage/v1/object/public/bucket_name/folder/file.ext
        // We split by bucket name and take the part after it
        const pathSegments = url.pathname.split(`/${bucketName}/`)[1];
       
        
        if (pathSegments) {
          console.log("Attempting to delete file at path:", pathSegments);
          
          const { data, error: storageError } = await supabase.storage
            .from(bucketName)
            .remove([pathSegments]);

          if (storageError) {
            console.error("Supabase storage error:", storageError.message);
          } else {
            console.log("Supabase storage result:", data);
          }
        }
      } catch (urlError) {
        console.error("Error parsing file URL:", urlError);
      }
    }

    // 3. Delete the record from the database
    await prisma.auditResponse.delete({ where: { id: responseId } });

    return res.status(StatusCodes.OK).json({ message: "Response and file deleted successfully." });
  } catch (error) {
    console.error("Database error during deletion:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Failed to delete response." });
  }
}

  // 4. Get Audit Responses with Pagination & Filter
  static async getResponses(req, res) {
    try {
      const userId = req.user.userId; 
      const { page = 1, limit = 10, questionId } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where = {
        ...(userId && { userId: parseInt(userId) }),
        ...(questionId && { questionId: parseInt(questionId) })
      };

      const [responses, total] = await Promise.all([
        prisma.auditResponse.findMany({ 
          where, 
          skip, 
          take: parseInt(limit),
          include: { question: true } 
        }),
        prisma.auditResponse.count({ where })
      ]);

      return res.status(StatusCodes.OK).json({ data: responses, meta: { total, page: parseInt(page) } });
    } catch (error) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Failed to fetch audit responses." });
    }
  }
}

export default AuditController