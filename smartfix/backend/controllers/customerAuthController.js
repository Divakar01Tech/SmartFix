const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { sendOtpEmail, sendPasswordResetOtpEmail } = require('../utils/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_secret_key_2026';

// Helper: Normalize identifier (email or phone)
const parseIdentifier = (identifier) => {
  if (!identifier) return { email: null, phone: null };
  const raw = identifier.toString().trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);

  if (isEmail) {
    return { email: raw.toLowerCase(), phone: null };
  }

  // Handle Indian phone numbers
  const digits = raw.replace(/\D/g, '');
  let phone = null;
  if (digits.length === 10) {
    phone = `+91${digits}`;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    phone = `+${digits}`;
  } else if (raw.startsWith('+91')) {
    phone = raw;
  } else {
    phone = raw;
  }
  return { email: null, phone };
};

// ==============================================================
// POST /api/customer/auth/login
// body: { identifier, password }
// ==============================================================
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Identifier (email or +91 phone) and password are required.',
      });
    }

    const { email, phone } = parseIdentifier(identifier);
    const query = [];
    if (email) {
      query.push({ email: email.toLowerCase().trim() });
    }
    if (phone) {
      query.push({ phone });
      const digits = phone.replace(/\D/g, '');
      const last10 = digits.slice(-10);
      if (last10.length === 10) {
        query.push({ phone: last10 });
        query.push({ phone: `+91${last10}` });
      }
    }

    if (query.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or phone format. Please enter a valid email or 10-digit mobile number.',
      });
    }

    // Find customer by email or phone
    const user = await User.findOne({
      $or: query,
      role: 'customer',
    }).select('+password');

    // If customer not found, check if user exists under another role (worker/admin)
    if (!user) {
      const otherUser = await User.findOne({ $or: query });
      if (otherUser) {
        if (otherUser.role === 'worker' || otherUser.role === 'handyman') {
          return res.status(403).json({
            success: false,
            roleMismatch: true,
            message: 'This account is registered as a Service Provider. Please use the Worker login.',
          });
        }
        if (otherUser.role === 'admin') {
          return res.status(403).json({
            success: false,
            roleMismatch: true,
            message: 'This account is registered as an Administrator. Please use the Admin login.',
          });
        }
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please verify your email/phone and password.',
      });
    }

    // Check account lockout status (15 min lock after 5 failed attempts)
    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        locked: true,
        remainingMinutes,
        message: `Account is temporarily locked for ${remainingMinutes} minute(s) due to multiple failed login attempts. Please try again later or reset your password.`,
      });
    }

    // Check if account has no password set (e.g., registered via Google OAuth)
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: 'This account was created with Google Sign-In and does not have a password set. Please click "Continue with Google" to sign in, or click "Forgot password?" to set a password for email login.',
      });
    }

    // Check account suspension or block
    if (user.isBlocked || user.isSuspended || user.verificationStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended by Administration. Please contact customer support.',
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lock
        user.failedLoginAttempts = 5;
        await user.save();

        return res.status(423).json({
          success: false,
          locked: true,
          remainingMinutes: 15,
          message: 'Account temporarily locked for 15 minutes due to 5 consecutive failed login attempts.',
        });
      }

      await user.save();
      const attemptsRemaining = 5 - user.failedLoginAttempts;
      return res.status(401).json({
        success: false,
        message: `Invalid credentials. (${attemptsRemaining} attempt(s) remaining before 15-minute lockout).`,
      });
    }

    // Password correct — Reset lockout counters
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // Generate JWT valid for 7 days
    const token = jwt.sign(
      {
        id: user._id,
        role: 'customer',
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      token,
      user: user.toSafeUser(),
      message: 'Login successful.',
    });
  } catch (err) {
    console.error('Customer login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// ==============================================================
// POST /api/customer/auth/login-otp/send
// body: { email }
// ==============================================================
exports.sendLoginOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const normEmail = email.toLowerCase().trim();

    // Check if the user is registered under a different role
    const existingUser = await User.findOne({ email: normEmail });
    if (existingUser && existingUser.role !== 'customer') {
      const isWorker = existingUser.role === 'worker' || existingUser.role === 'handyman';
      return res.status(403).json({
        success: false,
        roleMismatch: true,
        registeredRole: existingUser.role,
        message: isWorker
          ? 'This email is registered as a Service Professional. Please log in via the Technician Portal.'
          : 'This email is registered as an Administrator. Please log in via the Admin Portal.',
      });
    }

    // Lockout check if existing customer
    if (existingUser && existingUser.lockUntil && existingUser.lockUntil > new Date()) {
      const remainingMinutes = Math.ceil((existingUser.lockUntil.getTime() - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        locked: true,
        remainingMinutes,
        message: `Account is locked for ${remainingMinutes} minute(s). Please try again later.`,
      });
    }

    // Cooldown check (60 seconds)
    const existingOtp = await Otp.findOne({ email: normEmail, purpose: 'customer-login' });
    if (existingOtp) {
      const diffMs = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (diffMs < 60000) {
        const waitSec = Math.ceil((60000 - diffMs) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${waitSec} second(s) before requesting another login OTP.`,
        });
      }
    }

    // Generate 6-digit OTP and bcrypt hash
    const otp = crypto.randomInt(100000, 999999).toString();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);

    await Otp.findOneAndUpdate(
      { email: normEmail, purpose: 'customer-login' },
      {
        otpHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        createdAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Send email and verify successful dispatch
    const sent = await sendOtpEmail(normEmail, otp);
    if (!sent) {
      console.error(`Customer login OTP email dispatch failed for ${normEmail}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP verification email. Please check your email address or try again shortly.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'A 6-digit login verification code has been sent to your email address.',
    });
  } catch (err) {
    console.error('Send login OTP error:', err);
    return res.status(500).json({ success: false, message: 'Server error sending login OTP.' });
  }
};

// ==============================================================
// POST /api/customer/auth/login-otp/verify
// body: { email, otp }
// ==============================================================
exports.verifyLoginOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const normEmail = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();

    const otpDoc = await Otp.findOne({ email: normEmail, purpose: 'customer-login' });
    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: 'Login OTP has expired or was not requested. Please request a new code.',
      });
    }

    if (new Date() > new Date(otpDoc.expiresAt)) {
      await Otp.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ success: false, message: 'Login OTP has expired. Please request a new code.' });
    }

    if (otpDoc.attempts >= 5) {
      await Otp.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({
        success: false,
        message: 'Too many failed OTP attempts. Code invalidated. Please request a new code.',
      });
    }

    const isMatch = await bcrypt.compare(cleanOtp, otpDoc.otpHash);
    if (!isMatch) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      const remaining = 5 - otpDoc.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP code. ${remaining} attempt(s) remaining.`,
      });
    }

    // Success: consume OTP record
    await Otp.deleteOne({ _id: otpDoc._id });

    let user = await User.findOne({ email: normEmail, role: 'customer' });
    if (!user) {
      // If customer doesn't exist yet, auto-create customer document for seamless login
      const defaultName = normEmail.split('@')[0];
      user = await User.create({
        name: defaultName,
        fullName: defaultName,
        email: normEmail,
        isEmailVerified: true,
        profileCompleted: false,
        authProviders: ['email_otp'],
        role: 'customer',
        verificationStatus: 'Verified',
        isOnline: true,
        isAvailable: true,
      });
    }

    // Reset lockout
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        role: 'customer',
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      token,
      user: user.toSafeUser(),
      message: 'Logged in successfully with OTP.',
    });
  } catch (err) {
    console.error('Verify login OTP error:', err);
    return res.status(500).json({ success: false, message: 'Server error verifying login OTP.' });
  }
};

// ==============================================================
// POST /api/customer/auth/forgot-password/send-otp
// body: { email }
// ==============================================================
exports.sendForgotPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const normEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normEmail });

    if (existingUser && existingUser.role !== 'customer') {
      const isWorker = existingUser.role === 'worker' || existingUser.role === 'handyman';
      return res.status(403).json({
        success: false,
        roleMismatch: true,
        registeredRole: existingUser.role,
        message: isWorker
          ? 'This email is registered as a Service Professional. Please use the Worker forgot password portal.'
          : 'This email is registered as an Administrator. Password reset must be requested through administrator channels.',
      });
    }

    const genericResponse = {
      success: true,
      message: 'If an account is associated with this email, a password reset code has been sent.',
    };

    if (!existingUser) {
      return res.status(200).json(genericResponse);
    }

    // Cooldown check (60 seconds)
    const existingOtp = await Otp.findOne({ email: normEmail, purpose: 'customer-reset' });
    if (existingOtp) {
      const diffMs = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (diffMs < 60000) {
        const waitSec = Math.ceil((60000 - diffMs) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${waitSec} second(s) before requesting another reset code.`,
        });
      }
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);

    await Otp.findOneAndUpdate(
      { email: normEmail, purpose: 'customer-reset' },
      {
        otpHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        createdAt: new Date(),
      },
      { upsert: true, new: true }
    );

    const sent = await sendPasswordResetOtpEmail(normEmail, otp);
    if (!sent) {
      console.error('Customer forgot password email dispatch error for:', normEmail);
    }

    return res.status(200).json(genericResponse);
  } catch (err) {
    console.error('Send forgot password OTP error:', err);
    return res.status(500).json({ success: false, message: 'Server error processing reset request.' });
  }
};

// ==============================================================
// POST /api/customer/auth/forgot-password/verify-otp
// body: { email, otp }
// ==============================================================
exports.verifyForgotPasswordOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP code are required.' });
    }

    const normEmail = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();

    const otpDoc = await Otp.findOne({ email: normEmail, purpose: 'customer-reset' });
    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: 'Reset code expired or not found. Please request a new code.',
      });
    }

    if (new Date() > new Date(otpDoc.expiresAt)) {
      await Otp.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ success: false, message: 'Reset code expired. Please request a new code.' });
    }

    if (otpDoc.attempts >= 5) {
      await Otp.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Code invalidated. Please request a new code.',
      });
    }

    const isMatch = await bcrypt.compare(cleanOtp, otpDoc.otpHash);
    if (!isMatch) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      const remaining = 5 - otpDoc.attempts;
      return res.status(400).json({
        success: false,
        message: `Incorrect verification code. ${remaining} attempt(s) remaining.`,
      });
    }

    // Success: consume OTP record
    await Otp.deleteOne({ _id: otpDoc._id });

    // Issue 10-minute resetToken
    const resetToken = jwt.sign(
      { email: normEmail, purpose: 'customer-reset' },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    return res.status(200).json({
      success: true,
      resetToken,
      message: 'Code verified successfully. Please enter your new password.',
    });
  } catch (err) {
    console.error('Verify forgot password OTP error:', err);
    return res.status(500).json({ success: false, message: 'Server error verifying reset code.' });
  }
};

// ==============================================================
// POST /api/customer/auth/forgot-password/reset
// body: { resetToken, newPassword }
// ==============================================================
exports.resetPassword = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const bodyToken = req.body.resetToken;
    const token = bodyToken || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!token) {
      return res.status(401).json({ success: false, message: 'Password reset token is required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Reset token has expired or is invalid.' });
    }

    if (decoded.purpose !== 'customer-reset' || !decoded.email) {
      return res.status(401).json({ success: false, message: 'Invalid reset token purpose.' });
    }

    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least 1 letter and 1 number.' });
    }

    const user = await User.findOne({ email: decoded.email, role: 'customer' }).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Customer account not found.' });
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    if (!user.authProviders.includes('password')) {
      user.authProviders.push('password');
    }
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ success: false, message: 'Server error resetting password.' });
  }
};

// ==============================================================
// GET /api/customer/auth/me or GET /api/users/me
// Returns ONLY the logged-in customer's own safe profile
// ==============================================================
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.status(200).json({
      success: true,
      user: user.toSafeUser(),
    });
  } catch (err) {
    console.error('getMe error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching user profile.' });
  }
};
