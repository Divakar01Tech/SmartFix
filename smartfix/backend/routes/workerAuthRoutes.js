const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  sendEmailOtp,
  verifyEmailOtp,
  registerWorker,
  loginWorker,
  logoutWorker,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
} = require('../controllers/workerAuthController');
const { handleKycUpload } = require('../middleware/kycUploadMiddleware');

// IP-based Rate limiters
const workerLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts from this network. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const workerOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: {
    success: false,
    message: 'Too many OTP requests. Please wait 15 minutes before requesting more codes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// A) Worker Signup Flow
router.post('/email/send-otp', workerOtpLimiter, sendEmailOtp);
router.post('/email/verify-otp', verifyEmailOtp);
router.post('/register', handleKycUpload, registerWorker);

// B) Worker Login Flow
router.post('/login', workerLoginLimiter, loginWorker);
router.post('/logout', logoutWorker);

// Forgot Password Flow
router.post('/forgot-password/send-otp', workerOtpLimiter, forgotPasswordSendOtp);
router.post('/forgot-password/verify-otp', forgotPasswordVerifyOtp);
router.post('/forgot-password/reset', forgotPasswordReset);

module.exports = router;
