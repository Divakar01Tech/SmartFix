const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const KYC_DIR = path.join(__dirname, '..', 'storage', 'kyc');

// Ensure directory exists
if (!fs.existsSync(KYC_DIR)) {
  fs.mkdirSync(KYC_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, KYC_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomName = `${crypto.randomUUID()}${ext}`;
    cb(null, randomName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type (${file.mimetype}). Only JPG, PNG, and PDF files under 5MB are permitted.`), false);
  }
};

const uploadKycMulter = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB maximum
  },
  fileFilter,
}).fields([
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
  { name: 'secondId', maxCount: 1 },
]);

const handleKycUpload = (req, res, next) => {
  uploadKycMulter(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File too large. Maximum file size allowed is 5 MB.' });
      }
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

module.exports = {
  handleKycUpload,
  KYC_DIR,
};
