const express = require('express');
const router = express.Router();
const { register, login, getMe, resetPassword, updateProfile, deleteAccount, uploadExperienceVideo } = require('../controllers/authController');
const { sendOtp, verifyOtp } = require('../controllers/otpController');
const { protect } = require('../middleware/authMiddleware');
const { otpSendRateLimiter, otpVerifyRateLimiter } = require('../middleware/rateLimiter');

router.post('/register', register);
router.post('/login', login);
router.post('/send-otp', otpSendRateLimiter, sendOtp);
router.post('/verify-otp', otpVerifyRateLimiter, verifyOtp);

router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/experience-video', protect, uploadExperienceVideo);
router.delete('/delete-account', protect, deleteAccount);

const { getNotifications, markNotificationsRead } = require('../controllers/authController');
router.get('/notifications', protect, getNotifications);
router.patch('/notifications/read', protect, markNotificationsRead);

module.exports = router;
