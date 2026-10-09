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
 * Generate and send a 6-digit OTP code via Fast2SMS or Email
 * @param {string} phone 
 * @param {'register' | 'login' | 'reset_password' | 'registration' | 'password-reset'} purpose 
 * @param {string} email
 */
const generateOtp = async (phone, purpose = 'login', email = null) => {
  const formattedPhone = formatPhone(phone);
  const normalizedEmail = email ? email.toLowerCase().trim() : null;
  
  if (!formattedPhone && !normalizedEmail) {
    throw new Error('Valid phone number or email is required');
  }

  const normalizedPurpose = normalizePurpose(purpose);
  
  // Create search query based on what's provided
  const queryCond = [];
  if (formattedPhone) queryCond.push({ phoneNumber: formattedPhone }, { phone: formattedPhone });
  if (normalizedEmail) queryCond.push({ email: normalizedEmail });

  // 1. Rate Limiting Cooldown: 60 seconds between resends
  const existingOtp = await OtpRequest.findOne({
    $or: queryCond,
    purpose: normalizedPurpose,
  }).sort({ createdAt: -1 });

  if (existingOtp) {
    const elapsedSeconds = (Date.now() - new Date(existingOtp.createdAt).getTime()) / 1000;
    if (elapsedSeconds < 60) {
      const waitTime = Math.ceil(60 - elapsedSeconds);
      throw new Error(`Please wait ${waitTime} seconds before requesting a new OTP.`);
    }
  }

  // 2. Overwrite / Delete previous OTPs for same identifier + purpose
  await OtpRequest.deleteMany({
    $or: queryCond,
    purpose: normalizedPurpose,
  });

  // 3. Generate 6-digit OTP
  let rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
  // In mock mode, we just don't send the SMS but we still generate a random OTP.

  // 4. Hash OTP strictly with bcrypt
  const salt = await bcrypt.genSalt(10);
  const hashedOtp = await bcrypt.hash(rawOtp, salt);

  // 5. Expiration: 5 minutes from now (TTL index will auto-remove)
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // 6. Save persistent record in MongoDB
  await OtpRequest.create({
    phoneNumber: formattedPhone,
    email: normalizedEmail,
    hashedOtp,
    purpose: normalizedPurpose,
    expiresAt,
    attemptCount: 0,
    verified: false,
  });

  if (normalizedEmail) {
    console.log(`📧 Email OTP generated for ${normalizedEmail} (expires in 5 minutes)`);
    if (process.env.NODE_ENV !== 'production' || process.env.OTP_MOCK_MODE === 'true') {
      console.log(`🔑 [DEV MODE] Email OTP Code for ${normalizedEmail}: ${rawOtp}`);
    }
    
    let emailResult = { success: true, provider: 'Mock' };
    if (process.env.OTP_MOCK_MODE !== 'true') {
      const { sendEmailOTP } = require('./emailService');
      const success = await sendEmailOTP(normalizedEmail, rawOtp);
      emailResult = { success, provider: 'Nodemailer' };
    }
    return {
      success: true,
      message: `OTP code sent successfully to ${normalizedEmail}`,
      email: normalizedEmail,
      emailStatus: emailResult,
    };
  }

  const maskedPhone = formattedPhone.length >= 10
    ? `${formattedPhone.slice(0, 5)}***${formattedPhone.slice(-4)}`
    : formattedPhone;
  console.log(`📱 SMS Gateway Log: OTP generated for ${maskedPhone} (expires in 5 minutes)`);
  if (process.env.NODE_ENV !== 'production' || process.env.OTP_MOCK_MODE === 'true') {
    console.log(`🔑 [DEV MODE] OTP Code for ${formattedPhone}: ${rawOtp}`);
  }

  // 7. Send OTP via Twilio WhatsApp API (skip if in mock mode)
  let whatsappResult = { success: true, provider: 'Mock' };
  if (process.env.OTP_MOCK_MODE !== 'true') {
    const { sendWhatsApp } = require('./twilioService');
    const message = `Your SmartFix verification code is: *${rawOtp}*. It is valid for 5 minutes.`;
    whatsappResult = await sendWhatsApp(formattedPhone, message);
    
    // Optionally fallback to SMS if WhatsApp fails
    if (!whatsappResult.success) {
      console.warn('⚠️ WhatsApp OTP failed, falling back to SMS...');
      let smsResult = await sendSmsOtp(formattedPhone, rawOtp);
      whatsappResult = { ...whatsappResult, smsFallback: smsResult };
    }
  }

  return {
    success: true,
    message: `WhatsApp OTP sent successfully to ${formattedPhone}`,
    phone: formattedPhone,
    whatsappStatus: whatsappResult,
  };
};

/**
 * Verify entered OTP code strictly against persistent bcrypt hash
 * @param {string} phone 
 * @param {'register' | 'login' | 'reset_password'} purpose 
 * @param {string} enteredOtp 
 * @param {string} email
 */
const verifyOtp = async (phone, purpose, enteredOtp, email = null) => {
  const formattedPhone = formatPhone(phone);
  const normalizedEmail = email ? email.toLowerCase().trim() : null;

  if ((!formattedPhone && !normalizedEmail) || !enteredOtp) {
    throw new Error('Phone number/Email and OTP code are required');
  }

  const normalizedPurpose = normalizePurpose(purpose);
  const cleanCode = enteredOtp.toString().trim();
  
  const queryCond = [];
  if (formattedPhone) queryCond.push({ phoneNumber: formattedPhone }, { phone: formattedPhone });
  if (normalizedEmail) queryCond.push({ email: normalizedEmail });

  // 1. Find latest unexpired OTP record in MongoDB
  let record = await OtpRequest.findOne({
    $or: queryCond,
    purpose: normalizedPurpose,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!record) {
    record = await OtpRequest.findOne({
      $or: queryCond,
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
 * Check if a valid `verified: true` OTP record exists for phone/email + purpose
 */
const checkVerifiedOtp = async (phone, purpose, email = null) => {
  const formattedPhone = formatPhone(phone);
  const normalizedEmail = email ? email.toLowerCase().trim() : null;
  const normalizedPurpose = normalizePurpose(purpose);
  
  const queryCond = [];
  if (formattedPhone) queryCond.push({ phoneNumber: formattedPhone }, { phone: formattedPhone });
  if (normalizedEmail) queryCond.push({ email: normalizedEmail });

  const record = await OtpRequest.findOne({
    $or: queryCond,
    purpose: normalizedPurpose,
    verified: true,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  return !!record;
};

/**
 * Invalidate / delete verified OTP record after registration or password reset
 */
const consumeVerifiedOtp = async (phone, purpose, email = null) => {
  const formattedPhone = formatPhone(phone);
  const normalizedEmail = email ? email.toLowerCase().trim() : null;
  const normalizedPurpose = normalizePurpose(purpose);
  
  const queryCond = [];
  if (formattedPhone) queryCond.push({ phoneNumber: formattedPhone }, { phone: formattedPhone });
  if (normalizedEmail) queryCond.push({ email: normalizedEmail });

  await OtpRequest.deleteMany({
    $or: queryCond,
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

