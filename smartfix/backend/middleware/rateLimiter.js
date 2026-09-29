const rateLimit = require('express-rate-limit');

// 1. General API Rate Limiter — 100 requests per IP per 15 minutes
const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests from this IP. Please try again after 15 minutes. / இந்த IP முகவரியிலிருந்து பல கோரிக்கைகள் பெறப்பட்டுள்ளன. 15 நிமிடங்கள் கழித்து மீண்டும் முயற்சிக்கவும்.',
  },
});

// 2. OTP Send Request Limiter — max 5 requests per phone/IP per 15 minutes
const otpSendRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    return req.body?.phone ? `${req.ip}_${req.body.phone}` : req.ip;
  },
  message: {
    message: 'Too many OTP requests for this phone number. Please wait 15 minutes before trying again. / இந்த போன் எண்ணிற்கு பல OTP கோரிக்கைகள் பெறப்பட்டுள்ளன. 15 நிமிடங்கள் காத்திருக்கவும்.',
  },
});

// 3. OTP Verification Attempt Limiter — max 5 attempts per session/phone per 15 minutes
const otpVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    return req.body?.phone ? `${req.ip}_verify_${req.body.phone}` : req.ip;
  },
  message: {
    message: 'Too many invalid verification attempts. Session locked for 15 minutes for safety. / பல தவறான முயற்கசிகள். 15 நிமிடங்களுக்குப் பிறகு முயற்சிக்கவும்.',
  },
});


module.exports = {
  apiRateLimiter,
  otpSendRateLimiter,
  otpVerifyRateLimiter,
};
