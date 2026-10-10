const express = require('express');
const router = express.Router();
const { register, login, getMe, resetPassword, updateProfile, deleteAccount, uploadExperienceVideo } = require('../controllers/authController');
const { sendOtp, verifyOtp } = require('../controllers/otpController');
const { protect } = require('../middleware/authMiddleware');
const { otpSendRateLimiter, otpVerifyRateLimiter, emailOtpSendLimiter, emailOtpVerifyLimiter } = require('../middleware/rateLimiter');
const { googleAuth } = require('../controllers/googleAuthController');
const { sendEmailOtp, verifyEmailOtp, emailRegister } = require('../controllers/emailAuthController');

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);  // ← Google OAuth Sign-In
router.post('/send-otp', otpSendRateLimiter, sendOtp);
router.post('/verify-otp', otpVerifyRateLimiter, verifyOtp);

// New Email signup flow
router.post('/email/send-otp', emailOtpSendLimiter, sendEmailOtp);
router.post('/email/verify-otp', emailOtpVerifyLimiter, verifyEmailOtp);
router.post('/email/register', emailRegister);

router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/experience-video', protect, uploadExperienceVideo);
router.delete('/delete-account', protect, deleteAccount);

const { getNotifications, markNotificationsRead } = require('../controllers/authController');
router.get('/notifications', protect, getNotifications);
router.patch('/notifications/read', protect, markNotificationsRead);

module.exports = router;
