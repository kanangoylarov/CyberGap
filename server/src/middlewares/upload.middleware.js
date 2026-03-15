import multer from 'multer';
import path from 'path';

/**
 * Configure Multer to use Memory Storage for Supabase uploads.
 */
const storage = multer.memoryStorage();

/**
 * File filter to restrict file types.
 * Allowed: PDF, Excel (.xlsx, .xls), and Word (.docx, .doc).
 */
const fileFilter = (req, file, cb) => {
    // 1. Check extensions using regex
    const allowedExtensions = /pdf|xlsx|xls|doc|docx/;
    const extName = allowedExtensions.test(path.extname(file.originalname).toLowerCase());

    // 2. Comprehensive MIME types list
    const allowedMimeTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel',                                         // .xls
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/vnd.ms-word',                                           // .doc
        'application/x-zip-compressed', // Sometimes used for docx/xlsx
        'application/octet-stream'      // Generic binary type often used for office files
    ];

    const mimeType = allowedMimeTypes.includes(file.mimetype);

    if (extName && mimeType) {
        return cb(null, true);
    } else {
        // Log the rejected file's details to debug exactly what's failing
        console.log(`Rejected File: MIME=${file.mimetype}, Name=${file.originalname}`);
        cb(new Error('Error: Only PDF, Excel, and Word files are allowed!'), false);
    }
};
/**
 * Initialize Multer
 */
export const upload = multer({
    storage: storage,
    limits: {
        fileSize: 15 * 1024 * 1024 // Increased to 15MB for larger documents
    },
    fileFilter: fileFilter
});