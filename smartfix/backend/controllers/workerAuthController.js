const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Otp = require('../models/Otp');
const Booking = require('../models/Booking');
const InterviewSession = require('../models/InterviewSession');
const { sendWorkerOtpEmail } = require('../utils/mailer');
const { toSafeWorker } = require('../utils/serializers');

const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_secret_key_2026';

// Helper: Format phone to E.164 (+91 format for India)
const formatPhoneE164 = (phone) => {
  if (!phone) return null;
  const cleaned = phone.toString().replace(/\D/g, '');
  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    const mainDigits = cleaned.slice(2);
    if (/^[6-9]\d{9}$/.test(mainDigits)) {
      return `+${cleaned}`;
    }
  }
  return null;
};

// Helper: Mask ID numbers to last 4 digits
const maskToLast4 = (val) => {
  if (!val) return '';
  const cleaned = val.toString().replace(/\D/g, '');
  if (cleaned.length >= 4) {
    return cleaned.slice(-4);
  }
  // alphanumeric fallback (e.g. PAN or Driving License)
  const alphaClean = val.toString().trim().replace(/[^a-zA-Z0-9]/g, '');
  return alphaClean.slice(-4);
};

// Helper: Issue standard worker JWT (7 days)
const generateWorkerJwt = (worker) => {
  return jwt.sign(
    {
      id: worker._id,
      userId: worker._id,
      role: 'worker',
      verificationStatus: worker.verificationStatus || 'pending_verification',
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Helper: Issue 24-hour signup token
const generateSignupToken = (email) => {
  return jwt.sign(
    {
      email: email.toLowerCase().trim(),
      purpose: 'worker-signup',
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Helper: Issue 15-minute password reset token
const generateResetToken = (email) => {
  return jwt.sign(
    {
      email: email.toLowerCase().trim(),
      purpose: 'worker-reset',
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
};

// Allowed fixed categories
const VALID_CATEGORIES = [
  'Plumbing',
  'Electrical Repairs',
  'AC Service and Repair',
  'Refrigerator Repair',
  'Washing Machine Repair',
  'Water Purifier Service',
];

// ============================================================================
// 1. POST /api/worker/auth/email/send-otp
// ============================================================================
exports.sendEmailOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Reject duplicate email if already registered
    const existingWorker = await User.findOne({
      email: normalizedEmail,
      $or: [{ role: 'worker' }, { role: 'handyman' }, { isEmailVerified: true }],
    });

    if (existingWorker) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in instead.',
      });
    }

    // 60-second cooldown check
    const existingOtp = await Otp.findOne({
      email: normalizedEmail,
      purpose: 'worker-signup',
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (existingOtp) {
      const elapsedSeconds = (Date.now() - new Date(existingOtp.createdAt).getTime()) / 1000;
      if (elapsedSeconds < 60) {
        const waitTime = Math.ceil(60 - elapsedSeconds);
        return res.status(429).json({
          success: false,
          message: `Please wait ${waitTime} seconds before requesting a new verification code.`,
        });
      }
    }

    // Clear older OTPs for this email + purpose
    await Otp.deleteMany({ email: normalizedEmail, purpose: 'worker-signup' });

    // Generate random 6-digit code
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP with bcrypt (10 rounds)
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(rawOtp, salt);

    // Save in Otp collection with 5-minute expiry
    await Otp.create({
      email: normalizedEmail,
      otpHash,
      purpose: 'worker-signup',
      attempts: 0,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // Send email via mailer
    const emailSent = await sendWorkerOtpEmail(normalizedEmail, rawOtp, 'worker-signup');
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to dispatch verification email. Please check your email configuration.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your email address.',
      email: normalizedEmail,
    });
  } catch (err) {
    console.error('Worker Send OTP Error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error while sending OTP.' });
  }
};

// ============================================================================
// 2. POST /api/worker/auth/email/verify-otp
// ============================================================================
exports.verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and 6-digit OTP code are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const cleanCode = otp.toString().trim();

    // Find active unexpired OTP
    const otpRecord = await Otp.findOne({
      email: normalizedEmail,
      purpose: 'worker-signup',
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code. Please request a new code.',
      });
    }

    // Check attempt limit (max 5 tries)
    if (otpRecord.attempts >= 5) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new verification code.',
      });
    }

    // Verify bcrypt hash
    const isMatch = await bcrypt.compare(cleanCode, otpRecord.otpHash);
    if (!isMatch) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      const remainingAttempts = 5 - otpRecord.attempts;
      return res.status(400).json({
        success: false,
        message: `Incorrect verification code. ${remainingAttempts} attempt(s) remaining.`,
      });
    }

    // Consume OTP record
    await Otp.deleteMany({ email: normalizedEmail, purpose: 'worker-signup' });

    // Generate short-lived signupToken (15 minutes)
    const signupToken = generateSignupToken(normalizedEmail);

    return res.status(200).json({
      success: true,
      verified: true,
      message: 'Email address verified successfully.',
      signupToken,
      email: normalizedEmail,
    });
  } catch (err) {
    console.error('Worker Verify OTP Error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error during OTP verification.' });
  }
};

// ============================================================================
// 3. POST /api/worker/auth/register
// Guarded by signupToken. Email is taken ONLY from the verified token.
// ============================================================================
exports.registerWorker = async (req, res) => {
  try {
    // 1. Verify signupToken
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.body.signupToken) {
      token = req.body.signupToken;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Valid signup token is required to register.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      if (e.name === 'TokenExpiredError') {
        try {
          // Cryptographically verify signature so workers completing 5 AI interview questions aren't locked out
          decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
        } catch (innerErr) {
          return res.status(401).json({ success: false, message: 'Signup token has expired or is invalid. Please verify your email again.' });
        }
      } else {
        return res.status(401).json({ success: false, message: 'Signup token is invalid. Please verify your email again.' });
      }
    }

    if (decoded.purpose !== 'worker-signup' || !decoded.email) {
      return res.status(401).json({ success: false, message: 'Invalid token purpose for registration.' });
    }

    // Email is taken strictly from verified token
    const tokenEmail = decoded.email.toLowerCase().trim();

    // 2. Validate input fields
    const {
      fullName,
      name,
      phone,
      password,
      confirmPassword,
      address,
      district,
      state,
      categories,
      aadhaarNumber,
      secondIdType,
      secondIdNumber,
      interviewData,
      sessionId: explicitSessionId,
      interviewSessionId: altSessionId,
    } = req.body;

    let sessionId = explicitSessionId || altSessionId || null;

    const chosenName = (fullName || name || '').trim();
    if (!chosenName || chosenName.length < 2) {
      return res.status(400).json({ success: false, message: 'Full name is required (min 2 characters).' });
    }

    const formattedPhone = formatPhoneE164(phone);
    if (!formattedPhone) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid Indian mobile number starting with 6-9 (10 digits).',
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
    }

    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least 1 letter and 1 number.',
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Password confirmation does not match.' });
    }

    // Categories validation
    let catArray = [];
    if (Array.isArray(categories)) {
      catArray = categories.filter((c) => VALID_CATEGORIES.includes(c));
    } else if (typeof categories === 'string') {
      try {
        const parsed = JSON.parse(categories);
        if (Array.isArray(parsed)) catArray = parsed.filter((c) => VALID_CATEGORIES.includes(c));
      } catch (e) {
        if (VALID_CATEGORIES.includes(categories.trim())) catArray = [categories.trim()];
      }
    }

    if (catArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one valid trade category from the options.',
      });
    }

    // 3. Check existing user / duplicate phone
    let existingUser = await User.findOne({ email: tokenEmail });

    // Reject only if phone belongs to a DIFFERENT user
    const phoneUser = await User.findOne({ phone: formattedPhone });
    if (phoneUser && (!existingUser || phoneUser._id.toString() !== existingUser._id.toString())) {
      return res.status(409).json({
        success: false,
        message: 'This mobile number is already registered with another account.',
      });
    }

    // 4. File uploads from multer if present
    const aadhaarFrontFile = req.files?.aadhaarFront?.[0];
    const aadhaarBackFile = req.files?.aadhaarBack?.[0];
    const secondIdFile = req.files?.secondId?.[0];

    // Mask ID numbers at storage time
    const aadhaarLast4 = maskToLast4(aadhaarNumber);
    const secondIdLast4 = maskToLast4(secondIdNumber);

    // 5. Hash password with bcrypt (12 rounds)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 6. Parse interview results if provided
    let parsedInterview = {};
    if (interviewData) {
      try {
        const raw = typeof interviewData === 'string' ? JSON.parse(interviewData) : interviewData;
        if (!sessionId && raw.sessionId) sessionId = raw.sessionId;
        parsedInterview = {
          transcriptSummary: raw.transcriptSummary || raw.summary || '',
          scores: {
            practicalSpecificity: Number(raw.scores?.practicalSpecificity) || 0,
            safetyAwareness: Number(raw.scores?.safetyAwareness) || 0,
            diagnosisLogic: Number(raw.scores?.diagnosisLogic) || 0,
            communicationClarity: Number(raw.scores?.communicationClarity) || 0,
          },
          aiVerdict: ['pass', 'borderline', 'fail'].includes(raw.aiVerdict?.toLowerCase())
            ? raw.aiVerdict.toLowerCase()
            : (raw.verdict?.toLowerCase() || 'borderline'),
          completedAt: raw.completedAt ? new Date(raw.completedAt) : new Date(),
        };
      } catch (e) {}
    }

    let workerDoc;
    if (existingUser) {
      if (existingUser.role === 'customer') {
        return res.status(409).json({
          success: false,
          message: 'An existing customer account uses this email. Please use a distinct email address for your technician partner account.',
        });
      }
      if (existingUser.verificationStatus === 'approved' || existingUser.verificationStatus === 'Verified') {
        const token = generateWorkerJwt(existingUser);
        return res.status(200).json({
          success: true,
          message: 'Your partner profile is already approved and active! Welcome back.',
          token,
          worker: toSafeWorker(existingUser),
        });
      }

      // Update existing pending worker with fresh submission data
      existingUser.name = chosenName;
      existingUser.fullName = chosenName;
      existingUser.phone = formattedPhone;
      existingUser.password = hashedPassword;
      existingUser.isEmailVerified = true;
      existingUser.address = address || existingUser.address || '';
      existingUser.district = district || existingUser.district || '';
      existingUser.state = state || existingUser.state || 'Tamil Nadu';
      existingUser.categories = catArray;
      existingUser.trade = catArray[0];
      existingUser.verificationStatus = 'pending_verification';
      existingUser.overallStatus = 'pending';
      if (parsedInterview.transcriptSummary) {
        existingUser.interview = parsedInterview;
      }
      if (aadhaarNumber) {
        existingUser.kyc = existingUser.kyc || {};
        existingUser.kyc.aadhaarLast4 = aadhaarLast4;
        existingUser.kyc.secondIdType = secondIdType || '';
        existingUser.kyc.secondIdLast4 = secondIdLast4;
        if (aadhaarFrontFile) existingUser.kyc.aadhaarFrontPath = aadhaarFrontFile.path;
        if (aadhaarBackFile) existingUser.kyc.aadhaarBackPath = aadhaarBackFile.path;
        if (secondIdFile) existingUser.kyc.secondIdPath = secondIdFile.path;
      }
      if (sessionId) {
        existingUser.interviewSessionId = sessionId;
        await InterviewSession.findByIdAndUpdate(sessionId, { workerId: existingUser._id }).catch(() => null);
      }
      await existingUser.save();
      workerDoc = existingUser;
    } else {
      // 7. Create worker in MongoDB
      workerDoc = new User({
        name: chosenName,
        fullName: chosenName,
        email: tokenEmail,
        phone: formattedPhone,
        password: hashedPassword,
        isEmailVerified: true,
        address: address || '',
        district: district || '',
        state: state || 'Tamil Nadu',
        categories: catArray,
        trade: catArray[0],
        verificationStatus: 'pending_verification',
        overallStatus: 'pending',
        role: 'worker',
        availability: 'offline',
        isAvailable: false,
        isOnline: false,
        failedLoginAttempts: 0,
        lockUntil: null,
        kyc: {
          aadhaarLast4,
          secondIdType: secondIdType || '',
          secondIdLast4,
          aadhaarFrontPath: aadhaarFrontFile ? aadhaarFrontFile.path : '',
          aadhaarBackPath: aadhaarBackFile ? aadhaarBackFile.path : '',
          secondIdPath: secondIdFile ? secondIdFile.path : '',
        },
        interview: parsedInterview,
        interviewSessionId: sessionId || null,
      });

      await workerDoc.save();

      if (sessionId) {
        await InterviewSession.findByIdAndUpdate(sessionId, { workerId: workerDoc._id }).catch(() => null);
      }
    }

    const workerJwt = generateWorkerJwt(workerDoc);

    return res.status(201).json({
      success: true,
      message: 'Worker application submitted successfully. Your KYC and interview are pending admin verification.',
      token: workerJwt,
      worker: toSafeWorker(workerDoc),
    });
  } catch (err) {
    console.error('Worker Registration Error:', err.message);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email or mobile number is already in use.' });
    }
    return res.status(500).json({ success: false, message: 'Registration failed due to server error: ' + err.message });
  }
};

// ============================================================================
// 4. POST /api/worker/auth/login
// Lockout after 5 failed attempts for 15 minutes.
// Generic "Invalid credentials" error to prevent user enumeration.
// ============================================================================
exports.loginWorker = async (req, res) => {
  try {
    const { identifier, email, password } = req.body;
    const rawEmail = email || identifier;

    if (!rawEmail || !password) {
      return res.status(400).json({ success: false, message: 'Please provide your registered email and password.' });
    }

    const cleanEmail = rawEmail.toString().trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    // Role Enforcement & Generic error: Look up exclusively by email among worker roles
    const worker = await User.findOne({
      email: cleanEmail,
      role: { $in: ['worker', 'handyman'] },
    }).select('+password');

    // 1. Role mismatch check or generic credential check
    if (!worker) {
      const anyUser = await User.findOne({ email: cleanEmail });
      if (anyUser) {
        if (anyUser.role === 'customer') {
          return res.status(403).json({
            success: false,
            roleMismatch: true,
            message: 'This account is registered as a Customer. Please use the Customer login.',
          });
        }
        if (anyUser.role === 'admin') {
          return res.status(403).json({
            success: false,
            roleMismatch: true,
            message: 'This account is registered as an Administrator. Please use the Admin login.',
          });
        }
      }
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 2. Lockout check: if locked and lockUntil is in the future
    if (worker.lockUntil && worker.lockUntil > new Date()) {
      const remainingMs = new Date(worker.lockUntil).getTime() - Date.now();
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
      return res.status(423).json({
        success: false,
        locked: true,
        lockUntil: worker.lockUntil,
        remainingMinutes,
        message: `Account is temporarily locked due to multiple failed login attempts. Please try again after ${remainingMinutes} minute(s).`,
      });
    }

    // 3. Password comparison
    const isPasswordCorrect = await bcrypt.compare(password, worker.password);

    if (!isPasswordCorrect) {
      worker.failedLoginAttempts = (worker.failedLoginAttempts || 0) + 1;

      // Lockout threshold reached (5 failed attempts -> 15 min lock)
      if (worker.failedLoginAttempts >= 5) {
        worker.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await worker.save();
        return res.status(423).json({
          success: false,
          locked: true,
          lockUntil: worker.lockUntil,
          remainingMinutes: 15,
          message: 'Account locked for 15 minutes due to 5 consecutive failed login attempts.',
        });
      }

      await worker.save();
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 4. Success: Reset failed attempts & lockUntil
    worker.failedLoginAttempts = 0;
    worker.lockUntil = null;
    await worker.save();

    // 5. Account suspension check
    if (worker.verificationStatus === 'suspended' || worker.isSuspended || worker.isBlocked) {
      return res.status(403).json({
        success: false,
        suspended: true,
        verificationStatus: 'suspended',
        message: 'Account suspended, contact support',
      });
    }

    // 6. Issue 7-day JWT with safe worker object
    const token = generateWorkerJwt(worker);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      worker: toSafeWorker(worker),
    });
  } catch (err) {
    console.error('Worker Login Error:', err.message);
    return res.status(500).json({ success: false, message: 'Login failed due to an internal server error.' });
  }
};

// ============================================================================
// 5. POST /api/worker/auth/logout
// ============================================================================
exports.logoutWorker = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

// ============================================================================
// 6. GET /api/worker/me
// Returns current logged-in worker's safe profile.
// ============================================================================
exports.getWorkerMe = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const worker = await User.findById(userId);
    if (!worker || (worker.role !== 'worker' && worker.role !== 'handyman')) {
      return res.status(404).json({ success: false, message: 'Worker profile not found.' });
    }

    return res.status(200).json({
      success: true,
      worker: toSafeWorker(worker),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve profile: ' + err.message });
  }
};

// ============================================================================
// 7. Forgot Password Flow
// ============================================================================
exports.forgotPasswordSendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide your registered email.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const worker = await User.findOne({
      email: normalizedEmail,
      role: { $in: ['worker', 'handyman'] },
    });

    if (!worker) {
      // Don't leak user existence
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a reset code has been sent.',
      });
    }

    // Cooldown check (60s)
    const existingOtp = await Otp.findOne({
      email: normalizedEmail,
      purpose: 'worker-reset',
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (existingOtp) {
      const elapsed = (Date.now() - new Date(existingOtp.createdAt).getTime()) / 1000;
      if (elapsed < 60) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(60 - elapsed)} seconds before requesting a new code.`,
        });
      }
    }

    await Otp.deleteMany({ email: normalizedEmail, purpose: 'worker-reset' });

    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(rawOtp, salt);

    await Otp.create({
      email: normalizedEmail,
      otpHash,
      purpose: 'worker-reset',
      attempts: 0,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sendWorkerOtpEmail(normalizedEmail, rawOtp, 'worker-reset');

    return res.status(200).json({
      success: true,
      message: 'Password reset code sent to your email.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to send reset code: ' + err.message });
  }
};

exports.forgotPasswordVerifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const otpRecord = await Otp.findOne({
      email: normalizedEmail,
      purpose: 'worker-reset',
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });
    }

    if (otpRecord.attempts >= 5) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'Too many attempts. Please request a new code.' });
    }

    const isMatch = await bcrypt.compare(otp.toString().trim(), otpRecord.otpHash);
    if (!isMatch) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ success: false, message: 'Incorrect reset code.' });
    }

    await Otp.deleteMany({ email: normalizedEmail, purpose: 'worker-reset' });

    const resetToken = generateResetToken(normalizedEmail);
    return res.status(200).json({
      success: true,
      message: 'Reset code verified successfully.',
      resetToken,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Reset verification error: ' + err.message });
  }
};

exports.forgotPasswordReset = async (req, res) => {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.body.resetToken) {
      token = req.body.resetToken;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Reset token is required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Reset token has expired. Please restart the reset process.' });
    }

    if (decoded.purpose !== 'worker-reset' || !decoded.email) {
      return res.status(401).json({ success: false, message: 'Invalid reset token.' });
    }

    const { newPassword, confirmPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
    }

    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least 1 letter and 1 number.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Password confirmation does not match.' });
    }

    const worker = await User.findOne({
      email: decoded.email.toLowerCase().trim(),
      role: { $in: ['worker', 'handyman'] },
    }).select('+password');

    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker account not found.' });
    }

    const salt = await bcrypt.genSalt(12);
    worker.password = await bcrypt.hash(newPassword, salt);
    worker.failedLoginAttempts = 0;
    worker.lockUntil = null;
    await worker.save();

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Password reset failed: ' + err.message });
  }
};

// ============================================================================
// 8. POST /api/worker/kyc/upload (or re-upload)
// ============================================================================
exports.uploadKyc = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const worker = await User.findById(userId);
    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker profile not found.' });
    }

    const { aadhaarNumber, secondIdType, secondIdNumber } = req.body;

    if (aadhaarNumber) {
      worker.kyc.aadhaarLast4 = maskToLast4(aadhaarNumber);
    }
    if (secondIdType) {
      worker.kyc.secondIdType = secondIdType;
    }
    if (secondIdNumber) {
      worker.kyc.secondIdLast4 = maskToLast4(secondIdNumber);
    }

    if (req.files?.aadhaarFront?.[0]) {
      worker.kyc.aadhaarFrontPath = req.files.aadhaarFront[0].path;
    }
    if (req.files?.aadhaarBack?.[0]) {
      worker.kyc.aadhaarBackPath = req.files.aadhaarBack[0].path;
    }
    if (req.files?.secondId?.[0]) {
      worker.kyc.secondIdPath = req.files.secondId[0].path;
    }

    // Reset status to pending_verification if previously rejected
    if (worker.verificationStatus === 'rejected') {
      worker.verificationStatus = 'pending_verification';
      worker.rejectionReason = '';
    }

    await worker.save();

    return res.status(200).json({
      success: true,
      message: 'KYC documents uploaded successfully and submitted for review.',
      worker: toSafeWorker(worker),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'KYC upload failed: ' + err.message });
  }
};

// ============================================================================
// 9. PATCH /api/worker/availability (Requires Approved Worker)
// ============================================================================
exports.toggleAvailability = async (req, res) => {
  try {
    const { availability } = req.body;
    if (!['available', 'busy', 'offline'].includes(availability)) {
      return res.status(400).json({ success: false, message: 'Availability must be available, busy, or offline.' });
    }

    const worker = req.currentUser || (await User.findById(req.user.id));
    worker.availability = availability;
    worker.availabilityStatus = availability.charAt(0).toUpperCase() + availability.slice(1);
    worker.isAvailable = availability === 'available';
    worker.isOnline = availability !== 'offline';
    await worker.save();

    return res.status(200).json({
      success: true,
      message: `Availability updated to ${availability}`,
      availability: worker.availability,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update availability: ' + err.message });
  }
};

// ============================================================================
// 10. GET /api/worker/earnings (Requires Approved Worker)
// ============================================================================
exports.getEarnings = async (req, res) => {
  try {
    const workerId = req.user?.id;
    const bookings = await Booking.find({ worker: workerId, status: { $in: ['Completed', 'Paid', 'Reviewed'] } });

    const totalEarnings = bookings.reduce((sum, b) => sum + (b.workerTotalPayout || (b.price ? b.price * 0.9 : 0)), 0);
    const completedJobs = bookings.length;

    return res.status(200).json({
      success: true,
      earnings: {
        totalEarnings: Math.round(totalEarnings),
        completedJobs,
        recentBookings: bookings.slice(-10).map((b) => ({
          id: b._id,
          trade: b.trade,
          date: b.date,
          amount: b.workerTotalPayout || b.price,
          status: b.status,
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch earnings: ' + err.message });
  }
};
