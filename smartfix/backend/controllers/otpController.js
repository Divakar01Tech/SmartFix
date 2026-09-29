/**
 * SmartFix OTP Controller
 *
 * Routes:
 *   POST /api/otp/send    — send verification code
 *   POST /api/otp/verify  — verify code, return phoneVerifyToken + JWT (for OTP-login)
 *
 * Primary flow:  Twilio Verify API v2
 * Fallback flow: DB-hash OTP (via otpService + Fast2SMS / twilioService SMS)
 *
 * The phoneVerifyToken is a short-lived signed JWT returned after successful verification.
 * The /api/auth/register endpoint validates this token server-side — it never trusts
 * a client-supplied phoneVerified=true flag.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const otpService = require('../services/otpService');
const twilioVerifyService = require('../services/twilioVerifyService');
const { formatPhoneE164, isTwilioVerifyConfigured } = require('../config/twilio');

const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_secret_key_2026';
const ADMIN_PHONE = '+917604975206';

const generateToken = (id, role) => {
  return jwt.sign({ userId: id, id, role }, JWT_SECRET, { expiresIn: '7d' });
};

/**
 * Generate a short-lived phone verification token.
 * This is returned to the frontend after successful OTP verification
 * and must be passed back to /api/auth/register to prove the phone was verified.
 *
 * @param {string} phone - E.164 formatted phone number
 * @param {string} purpose - 'register' | 'login' | 'reset_password'
 */
const generatePhoneVerifyToken = (phone, purpose) => {
  return jwt.sign(
    { phone, purpose, type: 'phone_verify' },
    JWT_SECRET,
    { expiresIn: '10m' } // short-lived: 10 minutes
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/otp/send  &  POST /api/auth/send-otp
// ─────────────────────────────────────────────────────────────────────────────
exports.sendOtp = async (req, res) => {
  try {
    const { phone, purpose, role } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const formattedPhone = formatPhoneE164(phone);

    if (!formattedPhone) {
      return res.status(400).json({ success: false, message: 'Enter a valid Indian mobile number.' });
    }

    // Admin security restriction
    if (role === 'admin' && formattedPhone !== ADMIN_PHONE) {
      return res.status(403).json({ success: false, message: 'Admin access is restricted to the authorized phone number.' });
    }

    // Duplicate-phone check for registration
    if (purpose === 'register') {
      const existingUser = await User.findOne({ phone: formattedPhone });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'This phone number is already registered. Please log in instead.',
        });
      }
    }

    // ── 1. Primary: Twilio Verify (if properly configured) ─────────────────
    if (isTwilioVerifyConfigured()) {
      try {
        const result = await twilioVerifyService.sendVerificationCode(formattedPhone);
        return res.status(200).json({
          success: true,
          message: 'Verification code sent to your phone via SMS.',
          status: result.status,
          phone: formattedPhone,
          provider: 'twilio_verify',
        });
      } catch (err) {
        if (err.message !== 'TWILIO_NOT_CONFIGURED') {
          // A real Twilio error (e.g. invalid number, rate limit) — surface it safely
          return res.status(err.message.includes('wait') || err.message.includes('Too many') ? 429 : 400).json({
            success: false,
            message: err.message,
          });
        }
        // TWILIO_NOT_CONFIGURED — fall through to DB fallback
        console.log('ℹ️ Twilio Verify not configured — using DB/SMS fallback');
      }
    }

    // ── 2. Persistent DB-hash OTP via Fast2SMS ────────────────────────────
    const result = await otpService.generateOtp(formattedPhone, purpose || 'login');
    const response = {
      success: true,
      message: 'Verification code sent to your phone.',
      status: 'pending',
      phone: formattedPhone,
      provider: 'fast2sms',
      smsStatus: result.smsStatus,
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error('Send OTP Error:', err.message);
    const statusCode = err.message?.includes('wait') || err.message?.includes('Too many') ? 429 : 500;
    return res.status(statusCode).json({
      success: false,
      message: err.message || 'Failed to send verification code. Please try again.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/otp/verify  &  POST /api/auth/verify-otp
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, purpose, otp, role, name, trade, subServices, location, ratePerHour } = req.body;

    if (!phone || otp === undefined || otp === null || otp === '') {
      return res.status(400).json({ success: false, message: 'Phone number and OTP code are required.' });
    }

    const formattedPhone = formatPhoneE164(phone);
    const code = otp.toString().trim();
    let isApproved = false;

    // ── 1. Twilio Verify (if properly configured) ───────────────────────────
    if (isTwilioVerifyConfigured()) {
      try {
        const result = await twilioVerifyService.checkVerificationCode(formattedPhone, code);
        if (result.approved) {
          isApproved = true;
        }
      } catch (err) {
        if (err.message !== 'TWILIO_NOT_CONFIGURED') {
          // Real Twilio error (wrong code, expired, too many attempts)
          return res.status(400).json({ success: false, message: err.message });
        }
        console.log('ℹ️ Twilio Verify not configured — trying DB fallback');
      }
    }

    // ── 2. Persistent DB-hash OTP verification (No bypasses, strictly bcrypt check) ──
    if (!isApproved) {
      try {
        const { record } = await otpService.verifyOtp(formattedPhone, purpose || 'login', code);
        if (record) isApproved = true;
      } catch (dbErr) {
        return res.status(400).json({
          success: false,
          message: dbErr.message || 'Invalid or expired verification code.',
        });
      }
    }

    if (!isApproved) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code. Please check and try again.',
      });
    }


    // Determine what we're doing: pure phone-verify (for signup step) vs login
    const isSignupVerify = purpose === 'register';

    if (isSignupVerify) {
      // Signup step: just return a short-lived phoneVerifyToken.
      // The frontend will pass this to /api/auth/register.
      // We do NOT create the user account here — that happens at /register.

      // Consume/mark OTP in DB if it exists (for fallback path)
      await otpService.consumeVerifiedOtp(formattedPhone, 'register').catch(() => {});

      const phoneVerifyToken = generatePhoneVerifyToken(formattedPhone, 'register');

      return res.status(200).json({
        success: true,
        verified: true,
        message: '✅ Phone number verified successfully.',
        phoneVerifyToken,
        phone: formattedPhone,
      });
    }

    // Login / OTP-login path: find or create user, issue JWT
    let user = await User.findOne({ phone: formattedPhone });

    if (!user) {
      // Auto-create account from OTP login (quick-login flow)
      const userRole = role === 'worker' ? 'handyman' : (role || 'customer');
      const isHandyman = userRole === 'handyman';
      const defaultPassword = req.body.password || `SmartFix@${Math.floor(100000 + Math.random() * 900000)}`;

      user = await User.create({
        name: name || (isHandyman ? 'Service Partner' : 'SmartFix Customer'),
        phone: formattedPhone,
        password: defaultPassword,
        role: userRole,
        trade: isHandyman ? (trade || 'Plumbing') : undefined,
        subServices: isHandyman ? (subServices || []) : undefined,
        location: location || 'Sivagangai, Tamil Nadu',
        ratePerHour: isHandyman ? (Number(ratePerHour) || 350) : undefined,
        verificationStatus: isHandyman ? 'Pending' : 'Verified',
        isAvailable: isHandyman ? false : true,
        isOnline: isHandyman ? false : true,
        phoneVerified: true,
      });
      console.log(`✅ Auto-created user via OTP login: ${user.name} (${user.phone})`);
    } else {
      user.phoneVerified = true;
      await user.save();
    }

    // Security checks
    if ((user.role === 'admin' || role === 'admin') && formattedPhone !== ADMIN_PHONE) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin login is restricted to the authorized number.',
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: '🚫 Your account has been suspended. Please contact support.',
      });
    }

    await otpService.consumeVerifiedOtp(formattedPhone, purpose || 'login').catch(() => {});

    const token = generateToken(user._id, user.role);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        trade: user.trade,
        subServices: user.subServices,
        location: user.location,
        ratePerHour: user.ratePerHour,
        verificationStatus: user.verificationStatus,
        rejectionReason: user.rejectionReason,
        preferredLanguage: user.preferredLanguage || 'en',
        theme: user.theme || 'light',
        phoneVerified: user.phoneVerified,
      },
    });
  } catch (err) {
    console.error('Verify OTP Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'OTP verification failed. Please try again.',
    });
  }
};
