const bcrypt = require('bcryptjs');
const OtpRequest = require('../models/OtpRequest');
const { sendSmsOtp } = require('./smsService');

const formatPhone = (phone) => {
  if (!phone) return phone;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith('91')) return `+${cleaned}`;
  return phone;
};

/**
 * Normalize purpose to standard values
 */
const normalizePurpose = (purpose) => {
  if (!purpose) return 'login';
  if (purpose === 'registration') return 'register';
  if (purpose === 'password-reset') return 'reset_password';
  return purpose;
};

/**
 * Generate and send a 6-digit OTP code via Fast2SMS
 * @param {string} phone 
 * @param {'register' | 'login' | 'reset_password' | 'registration' | 'password-reset'} purpose 
 */
const generateOtp = async (phone, purpose = 'login') => {
  const formattedPhone = formatPhone(phone);
  if (!formattedPhone) {
    throw new Error('Valid phone number is required');
  }

  const normalizedPurpose = normalizePurpose(purpose);

  // 1. Rate Limiting Cooldown: 60 seconds between resends
  const existingOtp = await OtpRequest.findOne({
    $or: [{ phoneNumber: formattedPhone }, { phone: formattedPhone }],
    purpose: normalizedPurpose,
  }).sort({ createdAt: -1 });

  if (existingOtp) {
    const elapsedSeconds = (Date.now() - new Date(existingOtp.createdAt).getTime()) / 1000;
    if (elapsedSeconds < 60) {
      const waitTime = Math.ceil(60 - elapsedSeconds);
      throw new Error(`Please wait ${waitTime} seconds before requesting a new OTP.`);
    }
  }

  // 2. Overwrite / Delete previous OTPs for same phone + purpose
  await OtpRequest.deleteMany({
    $or: [{ phoneNumber: formattedPhone }, { phone: formattedPhone }],
    purpose: normalizedPurpose,
  });

  // 3. Generate 6-digit OTP
  const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();

  // 4. Hash OTP strictly with bcrypt
  const salt = await bcrypt.genSalt(10);
  const hashedOtp = await bcrypt.hash(rawOtp, salt);

  // 5. Expiration: 5 minutes from now (TTL index will auto-remove)
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // 6. Save persistent record in MongoDB
  await OtpRequest.create({
    phoneNumber: formattedPhone,
    hashedOtp,
    purpose: normalizedPurpose,
    expiresAt,
    attemptCount: 0,
    verified: false,
  });

  const maskedPhone = formattedPhone.length >= 10
    ? `${formattedPhone.slice(0, 5)}***${formattedPhone.slice(-4)}`
    : formattedPhone;
  console.log(`📱 SMS Gateway Log: OTP generated for ${maskedPhone} (expires in 5 minutes)`);
  if (process.env.NODE_ENV !== 'production' || process.env.OTP_MOCK_MODE === 'true') {
    console.log(`🔑 [DEV MODE] OTP Code for ${formattedPhone}: ${rawOtp}`);
  }

  // 7. Send SMS via Fast2SMS (skip if in mock mode)
  let smsResult = { success: true, provider: 'Mock' };
  if (process.env.OTP_MOCK_MODE !== 'true') {
    smsResult = await sendSmsOtp(formattedPhone, rawOtp);
  }

  return {
    success: true,
    message: `OTP code sent successfully to ${formattedPhone}`,
    phone: formattedPhone,
    smsStatus: smsResult,
  };
};

/**
 * Verify entered OTP code strictly against persistent bcrypt hash
 * @param {string} phone 
 * @param {'register' | 'login' | 'reset_password'} purpose 
 * @param {string} enteredOtp 
 */
const verifyOtp = async (phone, purpose, enteredOtp) => {
  const formattedPhone = formatPhone(phone);

  if (!formattedPhone || !enteredOtp) {
    throw new Error('Phone number and OTP code are required');
  }

  const normalizedPurpose = normalizePurpose(purpose);
  const cleanCode = enteredOtp.toString().trim();

  // 1. Find latest unexpired OTP record in MongoDB
  let record = await OtpRequest.findOne({
    $or: [{ phoneNumber: formattedPhone }, { phone: formattedPhone }],
    purpose: normalizedPurpose,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!record) {
    record = await OtpRequest.findOne({
      $or: [{ phoneNumber: formattedPhone }, { phone: formattedPhone }],
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });
  }

  if (!record) {
    throw new Error('Invalid or expired OTP code');
  }

  // 2. Check maximum allowed attempts (5 tries)
  const currentAttempts = record.attemptCount ?? record.attempts ?? 0;
  if (currentAttempts >= 5) {
    throw new Error('Too many failed attempts. Please request a new OTP.');
  }

  // 3. Strictly compare entered OTP against stored bcrypt hash (no shortcuts, no bypasses)
  const storedHash = record.hashedOtp || record.otpHash;
  const isMatch = await bcrypt.compare(cleanCode, storedHash);

  if (!isMatch) {
    record.attemptCount = currentAttempts + 1;
    await record.save();
    if (record.attemptCount >= 5) {
      throw new Error('Too many failed attempts. Please request a new OTP.');
    }
    throw new Error('Invalid OTP code. Please check and try again.');
  }

  // 4. Mark verified
  record.verified = true;
  await record.save();

  return { success: true, record };
};

/**
 * Check if a valid `verified: true` OTP record exists for phone + purpose
 */
const checkVerifiedOtp = async (phone, purpose) => {
  const formattedPhone = formatPhone(phone);
  const normalizedPurpose = normalizePurpose(purpose);
  const record = await OtpRequest.findOne({
    $or: [{ phoneNumber: formattedPhone }, { phone: formattedPhone }],
    purpose: normalizedPurpose,
    verified: true,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  return !!record;
};

/**
 * Invalidate / delete verified OTP record after registration or password reset
 */
const consumeVerifiedOtp = async (phone, purpose) => {
  const formattedPhone = formatPhone(phone);
  const normalizedPurpose = normalizePurpose(purpose);
  await OtpRequest.deleteMany({
    $or: [{ phoneNumber: formattedPhone }, { phone: formattedPhone }],
    purpose: normalizedPurpose,
  });
};

module.exports = {
  formatPhone,
  generateOtp,
  verifyOtp,
  checkVerifiedOtp,
  consumeVerifiedOtp,
};

