const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendSmsOtp } = require('../services/smsService');
const otpService = require('../services/otpService');
const otpController = require('./otpController');
const mongoose = require('mongoose');
const { validateHandymanTaluk } = require('../services/geocodingService');
const { validateSubServicesForTrade } = require('../config/serviceCategories');

const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_secret_key';
const ADMIN_PHONE = '+917604975206';

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });
};

const formatPhone = (phone) => {
  if (!phone) return phone;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith('91')) return `+${cleaned}`;
  return phone;
};

// @route  POST /api/auth/register
// @desc   Register a new customer or handyman with KYC verification
exports.register = async (req, res) => {
  try {
    const {
      name, phone, email, password, role, trade, subServices, location, ratePerHour,
      aadhaarNumber, aadhaarDocUrl, idProofType, idProofNumber, idProofDocUrl,
      preferredLanguage, theme
    } = req.body;

    if (!name || (!phone && !email) || !password || !role) {
      return res.status(400).json({ message: 'Name, phone or email, password and role are required' });
    }

    const formattedPhone = phone ? formatPhone(phone) : null;
    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    // Security Rule: Restrict Admin registration
    if (role === 'admin') {
      if (formattedPhone !== ADMIN_PHONE) {
        return res.status(403).json({ message: 'Public Admin registration is disabled. Unauthorized phone number.' });
      }
    }

    // KYC & Location Rules for Handyman
    if (role === 'handyman') {
      // District Taluk Validation (Tamil Nadu only)
      const talukCheck = validateHandymanTaluk(location);
      if (!talukCheck.valid) {
        return res.status(400).json({ message: talukCheck.message });
      }

      // Trade & SubServices Validation
      const subCheck = validateSubServicesForTrade(trade, subServices);
      if (!subCheck.valid) {
        return res.status(400).json({ message: subCheck.error });
      }
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'Database not connected. Please try again in a moment.',
      });
    }

    const queryCond = [];
    if (formattedPhone) queryCond.push({ phone: formattedPhone });
    if (normalizedEmail) queryCond.push({ email: normalizedEmail });
    
    const existingUser = await User.findOne({ $or: queryCond });
    if (existingUser) {
      return res.status(400).json({ message: '🚫 An account with this phone number or email already exists!' });
    }

    // ── Phone Verification Gate ──────────────────────────────────────────────
    // Primary check: validate the short-lived phoneVerifyToken issued by /api/otp/verify
    // This token proves Twilio (or DB OTP) confirmed the phone — we NEVER trust a
    // client-supplied phoneVerified: true flag from the request body.
    let phoneVerified = false;
    let emailVerified = false;

    if (req.body.phoneVerifyToken) {
      try {
        const decoded = jwt.verify(req.body.phoneVerifyToken, JWT_SECRET);
        if (
          decoded.type === 'phone_verify' &&
          decoded.purpose === 'register' &&
          (decoded.phone === formattedPhone || decoded.phone === normalizedEmail)
        ) {
          if (decoded.phone === formattedPhone) phoneVerified = true;
          if (decoded.phone === normalizedEmail) emailVerified = true;
        } else {
          return res.status(400).json({ message: 'Verification token is invalid or does not match.' });
        }
      } catch (_tokenErr) {
        return res.status(400).json({ message: 'Verification has expired. Please verify again.' });
      }
    }

    // Fallback: DB OTP record
    if (!phoneVerified && !emailVerified) {
      const isVerifiedReg = await otpService.checkVerifiedOtp(formattedPhone, 'register', normalizedEmail);
      const isVerifiedLogin = await otpService.checkVerifiedOtp(formattedPhone, 'login', normalizedEmail);
      if (!isVerifiedReg && !isVerifiedLogin) {
        return res.status(400).json({
          message: 'Verification required before creating account. Please verify via OTP.',
        });
      }
      if (formattedPhone) phoneVerified = true;
      if (normalizedEmail) emailVerified = true;
    }


    const isHandyman = role === 'handyman';
    const user = await User.create({
      name,
      phone: formattedPhone,
      email: normalizedEmail,
      password,
      role,
      trade: isHandyman ? trade : undefined,
      subServices: isHandyman ? (subServices || []) : undefined,
      location: location || 'Tamil Nadu, Tamil Nadu',
      ratePerHour: isHandyman ? (ratePerHour || 350) : undefined,
      aadhaarNumber: isHandyman ? aadhaarNumber.trim() : undefined,
      aadhaarDocUrl: isHandyman ? (aadhaarDocUrl || '') : undefined,
      idProofType: isHandyman ? (idProofType || 'driving_license') : undefined,
      idProofNumber: isHandyman ? (idProofNumber || '') : undefined,
      idProofDocUrl: isHandyman ? (idProofDocUrl || '') : undefined,
      preferredLanguage: preferredLanguage || 'en',
      theme: theme || 'light',
      verificationStatus: isHandyman ? 'Pending' : 'Verified',
      isAvailable: isHandyman ? false : true,
      isOnline: isHandyman ? false : true,
      phoneVerified: phoneVerified,
      liveLocation: (req.body.lat && req.body.lng) ? { type: 'Point', coordinates: [req.body.lng, req.body.lat] } : undefined,
    });

    await otpService.consumeVerifiedOtp(formattedPhone, 'register', normalizedEmail);

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        trade: user.trade,
        subServices: user.subServices,
        location: user.location,
        lat: user.liveLocation?.coordinates?.[1] || null,
        lng: user.liveLocation?.coordinates?.[0] || null,
        ratePerHour: user.ratePerHour,
        workerId: user.workerId,
        verificationStatus: user.verificationStatus,
        preferredLanguage: user.preferredLanguage,
        theme: user.theme,
      },
    });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Registration failed' });
  }
};

// @route  POST /api/auth/login
// @desc   Login with phone number + password
exports.login = async (req, res) => {
  try {
    const { phone, email, password, role } = req.body;

    if ((!phone && !email) || !password) {
      return res.status(400).json({ message: 'Phone/Email and password are required' });
    }

    const formattedPhone = phone ? formatPhone(phone) : null;
    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    // Security Rule: Admin login restriction to 7604975206
    if (role === 'admin' && formattedPhone !== ADMIN_PHONE) {
      return res.status(403).json({ message: 'Access denied. Only the single authorized admin phone number (7604975206) can log in as Admin.' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'Database connection offline.',
      });
    }

    const queryCond = [];
    if (formattedPhone) queryCond.push({ phone: formattedPhone });
    if (normalizedEmail) queryCond.push({ email: normalizedEmail });
    
    const user = await User.findOne({ $or: queryCond }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'No account found with this phone number or email' });
    }

    if (role && user.role !== role) {
      return res.status(401).json({ message: `This number is registered as ${user.role}, not ${role}` });
    }

    // Double check admin role phone match
    if (user.role === 'admin' && formattedPhone !== ADMIN_PHONE) {
      return res.status(403).json({ message: 'Access denied for this phone number.' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: '🚫 Your account has been suspended by Admin. Please contact support.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        trade: user.trade,
        subServices: user.subServices,
        location: user.location,
        lat: user.liveLocation?.coordinates?.[1] || null,
        lng: user.liveLocation?.coordinates?.[0] || null,
        ratePerHour: user.ratePerHour,
        workerId: user.workerId,
        verificationStatus: user.verificationStatus,
        rejectionReason: user.rejectionReason,
        preferredLanguage: user.preferredLanguage || 'en',
        theme: user.theme || 'light',
      },
    });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Login failed' });
  }
};

// @route  POST /api/auth/send-otp
exports.sendOtp = async (req, res) => {
  if (!req.body.purpose) {
    req.body.purpose = 'login';
  }
  return otpController.sendOtp(req, res);
};

// @route  POST /api/auth/verify-otp
exports.verifyOtp = async (req, res) => {
  if (!req.body.purpose) {
    req.body.purpose = 'login';
  }
  return otpController.verifyOtp(req, res);
};

// @route  GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user', error: err.message });
  }
};

// @route  POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { phone, email, otp, newPassword } = req.body;
    if ((!phone && !email) || !newPassword) {
      return res.status(400).json({ message: 'Phone/Email and new password are required' });
    }

    const formattedPhone = phone ? formatPhone(phone) : null;
    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    // Step 3 Requirement: Re-validate that a verified: true OTP record exists for purpose='reset_password'
    let isVerified = await otpService.checkVerifiedOtp(formattedPhone, 'reset_password', normalizedEmail);

    // Fallback: If not pre-verified but OTP is provided directly in request
    if (!isVerified && otp) {
      try {
        await otpService.verifyOtp(formattedPhone, 'reset_password', otp, normalizedEmail);
        isVerified = true;
      } catch (err) {
        return res.status(401).json({ message: err.message || 'Invalid or expired OTP code' });
      }
    }

    if (!isVerified) {
      return res.status(400).json({ message: 'Phone verification required before resetting password. Please verify OTP first.' });
    }

    const queryCond = [];
    if (formattedPhone) queryCond.push({ phone: formattedPhone });
    if (normalizedEmail) queryCond.push({ email: normalizedEmail });
    
    const user = await User.findOne({ $or: queryCond });
    if (!user) {
      return res.status(404).json({ message: 'No account found registered with this phone number or email' });
    }

    user.password = newPassword;
    await user.save();

    await otpService.consumeVerifiedOtp(formattedPhone, 'reset_password', normalizedEmail);

    const token = generateToken(user._id);

    res.status(200).json({
      message: 'Password reset successfully!',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to reset password' });
  }
};

// @route  PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const {
      name, phone, location, trade, subServices, ratePerHour, isAvailable, newPassword,
      aadhaarNumber, aadhaarDocUrl, idProofType, idProofNumber, idProofDocUrl,
      upiId, upiPhone, bankAccountName, bankAccountNumber, bankIfscCode, bankName,
      preferredLanguage, theme, bioEn, bioTa
    } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (phone) user.phone = formatPhone(phone);
    if (location !== undefined) user.location = location;
    if (preferredLanguage) user.preferredLanguage = preferredLanguage;
    if (theme) user.theme = theme;

    if (user.role === 'handyman') {
      if (trade) user.trade = trade;
      if (subServices) user.subServices = subServices;
      if (ratePerHour !== undefined) user.ratePerHour = Number(ratePerHour);
      if (isAvailable !== undefined) user.isAvailable = Boolean(isAvailable);
      if (aadhaarNumber) {
        if (!/^\d{12}$/.test(aadhaarNumber.trim())) {
          return res.status(400).json({ message: 'Aadhaar number must be exactly 12 digits' });
        }
        user.aadhaarNumber = aadhaarNumber.trim();
      }
      if (aadhaarDocUrl !== undefined) user.aadhaarDocUrl = aadhaarDocUrl;
      if (idProofType) user.idProofType = idProofType;
      if (idProofNumber !== undefined) user.idProofNumber = idProofNumber;
      if (idProofDocUrl !== undefined) user.idProofDocUrl = idProofDocUrl;

      // AI Bio fields
      if (bioEn !== undefined) {
        user.bioEn = bioEn;
        user.bioManuallyEdited = true;
      }
      if (bioTa !== undefined) {
        user.bioTa = bioTa;
        user.bioManuallyEdited = true;
      }

      // Payout Fields
      if (upiId !== undefined) user.upiId = upiId;
      if (upiPhone !== undefined) user.upiPhone = upiPhone;
      if (bankAccountName !== undefined) user.bankAccountName = bankAccountName;
      if (bankAccountNumber !== undefined) user.bankAccountNumber = bankAccountNumber;
      if (bankIfscCode !== undefined) user.bankIfscCode = bankIfscCode;
      if (bankName !== undefined) user.bankName = bankName;
    }

    if (newPassword && newPassword.trim().length >= 6) {
      user.password = newPassword.trim();
    }

    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully!',
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        trade: user.trade,
        subServices: user.subServices,
        location: user.location,
        ratePerHour: user.ratePerHour,
        isAvailable: user.isAvailable,
        verificationStatus: user.verificationStatus,
        workerId: user.workerId,
        aadhaarNumber: user.aadhaarNumber,
        aadhaarDocUrl: user.aadhaarDocUrl,
        idProofType: user.idProofType,
        idProofNumber: user.idProofNumber,
        idProofDocUrl: user.idProofDocUrl,
        bioEn: user.bioEn,
        bioTa: user.bioTa,
        bioManuallyEdited: user.bioManuallyEdited,
        upiId: user.upiId,
        upiPhone: user.upiPhone,
        bankAccountName: user.bankAccountName,
        bankAccountNumber: user.bankAccountNumber,
        bankIfscCode: user.bankIfscCode,
        bankName: user.bankName,
        preferredLanguage: user.preferredLanguage,
        theme: user.theme,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
};

// @route  POST /api/auth/experience-video
// @desc   Upload experience proof video URL + optional caption (max 3 videos per worker)
exports.uploadExperienceVideo = async (req, res) => {
  try {
    const { videoUrl, caption } = req.body;
    if (!videoUrl || !videoUrl.trim()) {
      return res.status(400).json({ message: 'Video URL or file path is required.' });
    }

    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'handyman') {
      return res.status(403).json({ message: 'Only registered handymen can upload experience videos.' });
    }

    if (!user.experience) {
      user.experience = { status: 'pending', videos: [] };
    }

    if (user.experience.videos && user.experience.videos.length >= 3) {
      return res.status(400).json({ message: 'Maximum 3 experience proof videos allowed per worker profile.' });
    }

    user.experience.videos.push({
      url: videoUrl.trim(),
      caption: caption ? caption.trim() : '',
      uploadedAt: new Date(),
    });

    await user.save();

    res.status(200).json({
      message: 'Experience video uploaded successfully!',
      experience: user.experience,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to upload experience video.' });
  }
};

// @route  DELETE /api/auth/delete-account
// @desc   Delete user/worker/customer account permanently (NOT allowed for Admin)
exports.deleteAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Admin accounts cannot be deleted from settings.' });
    }

    await User.findByIdAndDelete(req.user.id);

    res.status(200).json({ message: 'Your account has been deleted permanently.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete account', error: err.message });
  }
};

const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50);
    res.status(200).json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

exports.markNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, isRead: false }, { isRead: true });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark read' });
  }
};

