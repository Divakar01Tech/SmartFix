const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { adminLogin, adminVerifyOtp } = require('../controllers/adminAuthController');

// Strict IP Rate Limiter for Administrator Login
const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes per IP
  message: {
    success: false,
    message: 'Too many admin authorization attempts from this IP. Please wait 15 minutes before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin Authentication Endpoints (Unlinked route /admin/login)
router.post('/login', adminAuthLimiter, adminLogin);
router.post('/verify-otp', adminAuthLimiter, adminVerifyOtp);

module.exports = router;
