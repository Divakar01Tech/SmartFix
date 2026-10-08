const rateLimit = require('express-rate-limit');

// 1. General API Rate Limiter — Disabled as per user request
const apiRateLimiter = (req, res, next) => next();

// 2. OTP Send Request Limiter — Disabled as per user request
const otpSendRateLimiter = (req, res, next) => next();

// 3. OTP Verification Attempt Limiter — Disabled as per user request
const otpVerifyRateLimiter = (req, res, next) => next();


module.exports = {
  apiRateLimiter,
  otpSendRateLimiter,
  otpVerifyRateLimiter,
};
