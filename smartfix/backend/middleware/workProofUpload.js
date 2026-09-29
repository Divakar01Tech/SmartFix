const multer = require('multer');
const sharp = require('sharp');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed for work proof.'), false);
    }
  },
});

const stripExif = async (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();
  try {
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      // Process with sharp: .rotate() auto-orients based on EXIF, and by not calling withMetadata(), EXIF is stripped
      const cleanBuffer = await sharp(file.buffer).rotate().jpeg().toBuffer();
      file.buffer = cleanBuffer;
      file.mimetype = 'image/jpeg';
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: 'Failed to process image metadata.', error: err.message });
  }
};

// Catch multer errors cleanly
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

module.exports = {
  uploadWorkProof: upload.array('photos', 4), // max 4 photos
  stripExif,
  handleMulterError
};
