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
        expiresAt: new Date(Date.now() + 5 * 60000), // 5 minutes
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Send email asynchronously without blocking the response
    sendOtpEmail(email, otp).catch(err => console.error('Background email failed:', err));

    res.status(200).json({ message: 'OTP sent successfully to your email.' });
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

    res.status(200).json({ signupToken, message: 'Email verified successfully' });
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
    const { phone, password, address, district, state } = req.body;

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

    // Check if email or phone already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone: formattedPhone }] });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email or phone number already exists' });
    }

    // Hash password with salt rounds 12
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user (default role: customer)
    const user = await User.create({
      name: email.split('@')[0],
      email,
      phone: formattedPhone,
      password: hashedPassword,
      address,
      district,
      state,
      isEmailVerified: true,
      role: 'customer',
      verificationStatus: 'Verified',
      isAvailable: true,
      isOnline: true,
      phoneVerified: true // Set to true implicitly as per prompt
    });

    const authToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token: authToken,
      user: user.toSafeUser()
    });
  } catch (error) {
    console.error('emailRegister error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
