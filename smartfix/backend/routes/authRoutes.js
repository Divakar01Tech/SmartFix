const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, deleteAccount, uploadExperienceVideo } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { emailOtpSendLimiter, emailOtpVerifyLimiter, authLoginLimiter } = require('../middleware/rateLimiter');
const { googleAuth, completeGoogleProfile } = require('../controllers/googleAuthController');
const {
  sendEmailOtp,
  verifyEmailOtp,
  emailRegister,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
} = require('../controllers/emailAuthController');

// Public Authentication Endpoints
router.post('/login', authLoginLimiter, login);
router.post('/google', googleAuth); // Google Identity Services OAuth
router.post('/complete-profile', protect, completeGoogleProfile);

// Email Signup Verification Flow
router.post('/email/send-otp', emailOtpSendLimiter, sendEmailOtp);
router.post('/email/verify-otp', emailOtpVerifyLimiter, verifyEmailOtp);
router.post('/email/register', emailRegister);

// Email Password Reset Flow
router.post('/forgot-password/send-otp', emailOtpSendLimiter, forgotPasswordSendOtp);
router.post('/forgot-password/verify-otp', emailOtpVerifyLimiter, forgotPasswordVerifyOtp);
router.post('/forgot-password/reset', forgotPasswordReset);

router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/experience-video', protect, uploadExperienceVideo);
router.delete('/delete-account', protect, deleteAccount);

const { getNotifications, markNotificationsRead } = require('../controllers/authController');
router.get('/notifications', protect, getNotifications);
router.patch('/notifications/read', protect, markNotificationsRead);

module.exports = router;
