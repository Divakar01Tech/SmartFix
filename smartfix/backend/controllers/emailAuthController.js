const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Otp = require('../models/Otp');
const User = require('../models/User');
const { sendOtpEmail } = require('../utils/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_secret_key';

// @route  POST /api/auth/email/send-otp
exports.sendEmailOtp = async (req, res) => {
  try {
    let { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    email = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered, please login' });
    }

    // Check for resend cooldown (60 seconds)
    const existingOtp = await Otp.findOne({ email, purpose: 'signup' });
    if (existingOtp) {
      const timeDiff = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (timeDiff < 60000) {
        return res.status(429).json({ message: `Please wait ${Math.ceil((60000 - timeDiff)/1000)} seconds before requesting a new OTP` });
      }
    }

    // Generate crypto-secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);

    // Upsert Otp doc
    await Otp.findOneAndUpdate(
      { email, purpose: 'signup' },
      { 
        otpHash, 
        attempts: 0, 
        expiresAt: new Date(Date.now() + 12 * 60000), // 10 minutes (+ 2 min grace buffer)
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    console.log(`[AUTH] 📧 Signup OTP generated for ${email}: ${otp}`);

    const emailSent = await sendOtpEmail(email, otp);
    if (!emailSent) {
      return res.status(500).json({ success: false, message: 'Failed to dispatch verification email. Please try again.' });
    }

    res.status(200).json({ success: true, message: 'OTP sent successfully to your email.' });
  } catch (error) {
    console.error('sendEmailOtp error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// @route  POST /api/auth/email/verify-otp
exports.verifyEmailOtp = async (req, res) => {
  try {
    let { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }
    email = email.toLowerCase().trim();

    const otpDoc = await Otp.findOne({ email, purpose: 'signup' });
    if (!otpDoc) {
      return res.status(400).json({ message: 'OTP expired or not found. Please request a new one.' });
    }

    if (new Date() > new Date(otpDoc.expiresAt)) {
      await Otp.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
    }

    if (otpDoc.attempts >= 5) {
      await Otp.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ message: 'Too many failed attempts. OTP invalidated. Please request a new one.' });
    }

    const isMatch = await bcrypt.compare(otp.toString(), otpDoc.otpHash);
    if (!isMatch) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      const remaining = 5 - otpDoc.attempts;
      if (remaining <= 0) {
        await Otp.deleteOne({ _id: otpDoc._id });
        return res.status(400).json({ message: 'Too many failed attempts. OTP invalidated.' });
      }
      return res.status(400).json({ message: `Invalid OTP. ${remaining} attempts remaining.` });
    }

    // Success
    await Otp.deleteOne({ _id: otpDoc._id });

    // Generate short-lived signupToken
    const signupToken = jwt.sign(
      { email, purpose: 'signup' },
      JWT_SECRET,
      { expiresIn: process.env.SIGNUP_TOKEN_EXPIRES || '15m' }
    );

    res.status(200).json({ success: true, signupToken, message: 'Email verified successfully' });
  } catch (error) {
    console.error('verifyEmailOtp error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// @route  POST /api/auth/email/register
exports.emailRegister = async (req, res) => {
  try {
    // Expect signupToken in Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized. No token provided.' });
    }
    
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Session expired. Please verify your email again.' });
    }

    if (decoded.purpose !== 'signup' || !decoded.email) {
      return res.status(401).json({ message: 'Invalid token purpose' });
    }

    const email = decoded.email.toLowerCase().trim();
    const { name: reqName, phone, password, address, district, state, role: reqRole } = req.body;
    
    const role = reqRole === 'handyman' ? 'handyman' : 'customer';

    // We do NOT store confirmPassword, it should only be validated on frontend (or here). 
    // We assume frontend did it, but let's just make sure required fields exist.
    if (!phone || !password || !address || !district || !state) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long and contain both letters and numbers.' });
    }

    if (address.length < 10) {
      return res.status(400).json({ message: 'Address must be at least 10 characters long' });
    }

    // Validate and format phone
    const phoneRegex = /^[6-9]\d{9}$/;
    let rawPhone = phone.toString().replace(/\D/g, '');
    if (rawPhone.startsWith('91') && rawPhone.length === 12) {
        rawPhone = rawPhone.substring(2);
    }
    if (!phoneRegex.test(rawPhone)) {
      return res.status(400).json({ message: 'Invalid phone number format' });
    }
    const formattedPhone = `+91${rawPhone}`;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email address already exists.' });
    }

    const customerName = (reqName && reqName.trim()) || email.split('@')[0];

    // Hash password with salt rounds 12
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user (default role: customer)
    const user = await User.create({
      name: customerName,
      fullName: customerName,
      email,
      phone: formattedPhone,
      password: hashedPassword,
      address,
      district,
      state,
      isEmailVerified: true,
      profileCompleted: true,
      authProviders: ['password'],
      role: role,
      verificationStatus: role === 'handyman' ? 'Pending' : 'Verified',
      isAvailable: role === 'customer',
      isOnline: role === 'customer',
      phoneVerified: true,
      failedLoginAttempts: 0,
      lockUntil: null,
    });

    const authToken = jwt.sign(
      {
        id: user._id,
        userId: user._id,
        role: user.role,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token: authToken,
      user: user.toSafeUser(),
    });
  } catch (error) {
    console.error('emailRegister error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ============================================================================
// Forgot Password Flow (Generic response whether email exists or not)
// ============================================================================

// @route  POST /api/auth/forgot-password/send-otp
exports.forgotPasswordSendOtp = async (req, res) => {
  try {
    let { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    email = email.toLowerCase().trim();

    // Generic response regardless of whether account exists (prevents account enumeration)
    const genericSuccessResponse = {
      success: true,
      message: 'If an account is associated with this email, a verification code has been sent.',
    };

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json(genericSuccessResponse);
    }

    // 60-second cooldown check
    const existingOtp = await Otp.findOne({ email, purpose: 'reset' });
    if (existingOtp) {
      const timeDiff = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (timeDiff < 60000) {
        const waitSec = Math.ceil((60000 - timeDiff) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${waitSec} second(s) before requesting another verification code.`,
        });
      }
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);

    await Otp.findOneAndUpdate(
      { email, purpose: 'reset' },
      {
        otpHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 12 * 60000), // 10 minutes (+ 2 min grace buffer)
        createdAt: new Date(),
      },
      { upsert: true, new: true }
    );

    const { sendPasswordResetOtpEmail } = require('../utils/mailer');
    await sendPasswordResetOtpEmail(email, otp);

    return res.status(200).json(genericSuccessResponse);
  } catch (err) {
    console.error('forgotPasswordSendOtp error:', err);
    return res.status(500).json({ success: false, message: 'Server error processing request.' });
  }
};

// @route  POST /api/auth/forgot-password/verify-otp
exports.forgotPasswordVerifyOtp = async (req, res) => {
  try {
    let { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and verification code are required.' });
    }

    email = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();

    const otpDoc = await Otp.findOne({ email, purpose: 'reset' });
    if (!otpDoc) {
      return res.status(400).json({ success: false, message: 'Verification code expired or not found. Please request a new one.' });
    }

    if (new Date() > new Date(otpDoc.expiresAt)) {
      await Otp.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
    }

    if (otpDoc.attempts >= 5) {
      await Otp.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ success: false, message: 'Too many failed attempts. Code invalidated.' });
    }

    const isMatch = await bcrypt.compare(cleanOtp, otpDoc.otpHash);
    if (!isMatch) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      const remaining = 5 - otpDoc.attempts;
      return res.status(400).json({ success: false, message: `Incorrect verification code. ${remaining} attempt(s) remaining.` });
    }

    // Success: consume OTP record
    await Otp.deleteOne({ _id: otpDoc._id });

    // Generate 10-minute resetToken
    const resetToken = jwt.sign(
      { email, purpose: 'password-reset' },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    return res.status(200).json({
      success: true,
      resetToken,
      message: 'Code verified successfully. Please enter your new password.',
    });
  } catch (err) {
    console.error('forgotPasswordVerifyOtp error:', err);
    return res.status(500).json({ success: false, message: 'Server error verifying code.' });
  }
};

// @route  POST /api/auth/forgot-password/reset
exports.forgotPasswordReset = async (req, res) => {
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
      return res.status(401).json({ success: false, message: 'Password reset session expired. Please request a new code.' });
    }

    if (decoded.purpose !== 'password-reset' || !decoded.email) {
      return res.status(401).json({ success: false, message: 'Invalid password reset token.' });
    }

    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
    }

    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'New password must contain at least 1 letter and 1 number.' });
    }

    const user = await User.findOne({ email: decoded.email }).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
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
      message: 'Your password has been reset successfully. You can now log in with your new password.',
    });
  } catch (err) {
    console.error('forgotPasswordReset error:', err);
    return res.status(500).json({ success: false, message: 'Server error resetting password.' });
  }
};

