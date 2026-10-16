const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const {
  login,
  sendLoginOtp,
  verifyLoginOtp,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPassword,
  getMe,
} = require('../controllers/customerAuthController');
const { protect, requireCustomer } = require('../middleware/authMiddleware');

// Input validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
};

// Rate limiter for customer login attempts: max 10 per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this network. Please try again after 15 minutes.',
  },
});

// Rate limiter for OTP requests: max 5 per 15 minutes per IP
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests. Please wait before trying again.',
  },
});

// Routes
router.post(
  '/login',
  loginLimiter,
  [
    body('identifier').notEmpty().withMessage('Identifier (email or +91 phone) is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  handleValidationErrors,
  login
);

router.post(
  '/login-otp/send',
  otpLimiter,
  [body('email').isEmail().withMessage('Valid email address is required')],
  handleValidationErrors,
  sendLoginOtp
);

router.post(
  '/login-otp/verify',
  [
    body('email').isEmail().withMessage('Valid email address is required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('6-digit OTP code is required'),
  ],
  handleValidationErrors,
  verifyLoginOtp
);

router.post(
  '/forgot-password/send-otp',
  otpLimiter,
  [body('email').isEmail().withMessage('Valid email address is required')],
  handleValidationErrors,
  sendForgotPasswordOtp
);

router.post(
  '/forgot-password/verify-otp',
  [
    body('email').isEmail().withMessage('Valid email address is required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('6-digit OTP code is required'),
  ],
  handleValidationErrors,
  verifyForgotPasswordOtp
);

router.post(
  '/forgot-password/reset',
  [
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
      .withMessage('Password must contain at least one letter and one number'),
  ],
  handleValidationErrors,
  resetPassword
);

router.get('/me', protect, requireCustomer, getMe);

module.exports = router;
