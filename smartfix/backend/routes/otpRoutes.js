const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp } = require('../controllers/otpController');
const { otpSendRateLimiter, otpVerifyRateLimiter } = require('../middleware/rateLimiter');

router.post('/send', otpSendRateLimiter, sendOtp);
router.post('/verify', otpVerifyRateLimiter, verifyOtp);

module.exports = router;
