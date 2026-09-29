/**
 * SmartFix — Twilio Verify Service
 *
 * Single-responsibility wrapper for Twilio Verify API v2.
 * Used for phone OTP verification during customer/worker signup and login.
 *
 * Architecture:
 *   sendVerificationCode(phone)    → Twilio sends OTP SMS to user
 *   checkVerificationCode(phone, code) → Twilio validates the code
 *
 * Twilio credentials are NEVER exposed to the frontend.
 * All calls go through this backend service only.
 */

const { client, verifyServiceSid, formatPhoneE164, isTwilioVerifyConfigured } = require('../config/twilio');

/**
 * Send a 6-digit OTP to the given phone number via Twilio Verify.
 *
 * @param {string} phone  — E.164 format (+91XXXXXXXXXX)
 * @returns {{ success: boolean, status: string }}
 * @throws {Error} with a safe, user-friendly message (no Twilio internals)
 */
const sendVerificationCode = async (phone) => {
  const formattedPhone = formatPhoneE164(phone);

  if (!formattedPhone) {
    throw new Error('A valid phone number is required.');
  }

  if (!isTwilioVerifyConfigured()) {
    // Twilio Verify not configured — caller must fall back to DB OTP
    throw new Error('TWILIO_NOT_CONFIGURED');
  }

  try {
    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verifications.create({
        to: formattedPhone,
        channel: 'sms',
      });

    return {
      success: true,
      status: verification.status, // 'pending'
    };
  } catch (err) {
    // Map Twilio error codes to safe user-facing messages
    const safeMessage = mapTwilioError(err);
    console.error(`⚠️ Twilio Verify send error [${err.code}]: ${err.message}`);
    throw new Error(safeMessage);
  }
};

/**
 * Verify the OTP code the user entered against Twilio Verify.
 *
 * @param {string} phone  — E.164 format (+91XXXXXXXXXX)
 * @param {string} code   — 6-digit OTP entered by user
 * @returns {{ success: boolean, approved: boolean }}
 * @throws {Error} with a safe, user-friendly message
 */
const checkVerificationCode = async (phone, code) => {
  const formattedPhone = formatPhoneE164(phone);

  if (!formattedPhone || !code) {
    throw new Error('Phone number and OTP code are required.');
  }

  if (!isTwilioVerifyConfigured()) {
    throw new Error('TWILIO_NOT_CONFIGURED');
  }


  try {
    const verificationCheck = await client.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({
        to: formattedPhone,
        code: code.toString().trim(),
      });

    const approved = verificationCheck.status === 'approved';
    return {
      success: approved,
      approved,
      mocked: false,
    };
  } catch (err) {
    const safeMessage = mapTwilioError(err);
    console.error(`⚠️ Twilio Verify check error [${err.code}]: ${err.message}`);
    throw new Error(safeMessage);
  }
};

/**
 * Map Twilio error codes to safe, user-friendly messages.
 * Never expose raw Twilio error details to the client.
 *
 * @param {Error & { code?: number }} err
 * @returns {string}
 */
const mapTwilioError = (err) => {
  const code = err.code;

  // Twilio Verify error codes: https://www.twilio.com/docs/api/errors
  const errorMap = {
    20003: 'Authentication failed. Please contact support.',
    20404: 'Verification service not found. Please contact support.',
    60200: 'Invalid phone number format. Please enter a valid Indian mobile number.',
    60202: 'OTP attempt limit exceeded. Please request a new code.',
    60203: 'Too many OTP requests for this number. Please wait before requesting again.',
    60212: 'Invalid or expired OTP code. Please check and try again.',
    60223: 'This phone number is not eligible for this service (trial account restriction).',
    21211: 'Invalid phone number. Please enter a valid 10-digit Indian mobile number.',
    21614: 'This number cannot receive SMS messages.',
  };

  if (code && errorMap[code]) {
    return errorMap[code];
  }

  // Generic safe fallback — never expose raw Twilio message
  return 'OTP service temporarily unavailable. Please try again in a moment.';
};

module.exports = {
  sendVerificationCode,
  checkVerificationCode,
};
