const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  askSmartFixAi,
  diagnoseProblem,
  analyzeImage,
  createServiceRequestFromAi,
  matchWorkers,
  detectIntentAction,
  getTaxonomy,
} = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');
const { aiRateLimiter } = require('../services/aiService');
const multer = require('multer');

const upload = multer({ 
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP allowed.'));
    }
  }
});

// Optional authentication middleware to populate req.user if token is supplied
const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.user = await User.findById(decoded.id).select('-password');
    } catch (e) {
      // Ignore token failure for optional auth
    }
  }
  next();
};

router.get('/taxonomy', getTaxonomy);
router.post('/chat', optionalAuth, askSmartFixAi);
router.post('/detect-intent', optionalAuth, detectIntentAction);
const { diagnoseCustomerIssue } = require('../controllers/diagnosisController');
router.post('/diagnose', protect, aiRateLimiter, upload.single('image'), diagnoseCustomerIssue);
router.post('/analyze-image', analyzeImage);
router.post('/create-service-request', protect, createServiceRequestFromAi);
router.post('/match-workers', matchWorkers);
router.post('/verify-kyc', protect, require('../controllers/aiController').verifyKycImage);

module.exports = router;

