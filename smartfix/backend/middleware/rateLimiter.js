const rateLimit = require('express-rate-limit');

// 1. General API Rate Limiter — Disabled as per user request
const apiRateLimiter = (req, res, next) => next();

// 2. OTP Send Request Limiter — Disabled as per user request
const otpSendRateLimiter = (req, res, next) => next();

// 3. OTP Verification Attempt Limiter — Disabled as per user request
const otpVerifyRateLimiter = (req, res, next) => next();

// Email OTP Limiters
const emailOtpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many OTP requests from this IP, please try again after 15 minutes.' }
});

const emailOtpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many OTP verification attempts, please try again after 15 minutes.' }
});


module.exports = {
  apiRateLimiter,
  otpSendRateLimiter,
  otpVerifyRateLimiter,
  emailOtpSendLimiter,
  emailOtpVerifyLimiter,
};
