const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadJobAttachment } = require('../controllers/jobUploadController');

// Multer memory storage (keeps server disk empty)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30 MB maximum file size limit
  },
  fileFilter: (req, file, cb) => {
    // Whitelisted MIME types for photos, invoices, and documents
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type (${file.mimetype}). Only images (JPEG/PNG/WEBP) and documents (PDF/DOCX/TXT) are allowed.`
        ),
        false
      );
    }
  },
});

// Middleware to catch Multer file validation and limit errors cleanly
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds 30MB limit.',
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

/**
 * @route   POST /api/jobs/:jobId/upload
 * @desc    Upload file to Google Drive & append attachment metadata to Job
 */
router.post(
  '/:jobId/upload',
  upload.single('file'),
  handleMulterError,
  uploadJobAttachment
);

module.exports = router;
