const multer = require('multer');
const path = require('path');
const fs = require('fs');

const applianceStorageDir = path.join(__dirname, '../storage/appliances');
if (!fs.existsSync(applianceStorageDir)) {
  fs.mkdirSync(applianceStorageDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, applianceStorageDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const unique = `app_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WEBP image files are allowed.'));
    }
  },
});

module.exports = upload.single('photo');
