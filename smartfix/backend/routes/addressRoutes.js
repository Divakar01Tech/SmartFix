const express = require('express');
const router = express.Router();
const { normalizeAddress, confirmAddress, reverseGeocode } = require('../controllers/addressController');
const { protect } = require('../middleware/authMiddleware');
const { aiRateLimiter } = require('../services/aiService');

// POST /api/address/normalize - AI cleans free-text, geocodes, validates
router.post('/normalize', protect, aiRateLimiter, normalizeAddress);

// POST /api/address/confirm - final server-side re-validation before storing
router.post('/confirm', protect, confirmAddress);

// POST /api/address/reverse - server-side reverse geocode (keeps API key on server)
router.post('/reverse', protect, reverseGeocode);

module.exports = router;
