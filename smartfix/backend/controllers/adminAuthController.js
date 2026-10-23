const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Otp = require('../models/Otp');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { sendAdminOtpEmail } = require('../utils/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_secret_key_2026';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'muthudivakar01022006@gmail.com').toLowerCase().trim();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// Stateless admin authentication controller - all state persisted in MongoDB User record

/**
 * Step 1: POST /api/admin/auth/login
 * Body: { email, password }
 */
exports.adminLogin = async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Fetch or find admin user from DB to check stateless lockout
    let adminRecord = await User.findOne({ email: ADMIN_EMAIL }).select('+password');

    // Check active 30-min lockout stored in DB
    if (adminRecord && adminRecord.lockUntil && adminRecord.lockUntil > new Date()) {
      const remainingMs = adminRecord.lockUntil.getTime() - Date.now();
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
      return res.status(423).json({
        success: false,
        locked: true,
        remainingMinutes,
        message: `Admin access is temporarily locked due to multiple failed attempts. Try again in ${remainingMinutes} minute(s).`,
      });
    }

    // Verify against ADMIN_EMAIL & ADMIN_PASSWORD_HASH from environment
    let isEmailMatch = normalizedEmail === ADMIN_EMAIL;
    let isPasswordMatch = false;

    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || ADMIN_PASSWORD_HASH;
    if (adminPasswordHash && password) {
      isPasswordMatch = await bcrypt.compare(password, adminPasswordHash);
    }

    if (!isPasswordMatch && isEmailMatch && adminRecord && adminRecord.password) {
      isPasswordMatch = await bcrypt.compare(password, adminRecord.password);
    }

    if (!isEmailMatch || !isPasswordMatch) {
      if (adminRecord) {
        adminRecord.failedLoginAttempts = (adminRecord.failedLoginAttempts || 0) + 1;
        if (adminRecord.failedLoginAttempts >= 5) {
          adminRecord.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min lock
          adminRecord.failedLoginAttempts = 0;
          await adminRecord.save();

          await AuditLog.create({
            action: 'admin_login_locked',
            ip,
            details: { attemptedEmail: normalizedEmail, reason: 'Exceeded 5 failed attempts' },
          }).catch(() => null);

          return res.status(423).json({
            success: false,
            locked: true,
            remainingMinutes: 30,
            message: 'Admin account locked for 30 minutes after 5 consecutive failed attempts.',
          });
        }
        await adminRecord.save();
      }

      // Audit Log for every attempt
      await AuditLog.create({
        action: 'admin_login_failed',
        ip,
        details: {
          attemptedEmail: normalizedEmail,
          attemptsCount: adminRecord?.failedLoginAttempts || 1,
          reason: 'Invalid credentials',
        },
      }).catch(() => null);

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please verify your administrator email and password.',
      });
    }

    // Credentials verified! Reset failed attempts in DB
    if (adminRecord) {
      adminRecord.failedLoginAttempts = 0;
      adminRecord.lockUntil = null;
      await adminRecord.save();
    }

    // Generate crypto-secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    // Save in Otp collection (purpose 'admin-login', 10 min expiry + 2 min buffer = 12m)
    await Otp.deleteMany({ email: ADMIN_EMAIL, purpose: 'admin-login' });
    await Otp.create({
      email: ADMIN_EMAIL,
      purpose: 'admin-login',
      otpHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + 12 * 60 * 1000),
    });

    // Ensure email credentials exist on the host
    const emailUser = (process.env.EMAIL_USER || process.env.GMAIL_USER || '').trim();
    const emailPass = (process.env.EMAIL_PASS || process.env.GMAIL_PASS || '').trim();

    // Dispatch real-time 2FA email to admin email address
    let emailDispatched = false;
    if (emailUser && emailPass) {
      emailDispatched = await sendAdminOtpEmail(ADMIN_EMAIL, otp);
      if (!emailDispatched) {
        console.error(`❌ Admin OTP email delivery failed to ${ADMIN_EMAIL}`);
        return res.status(502).json({
          success: false,
          message: `Failed to deliver verification code to ${ADMIN_EMAIL}. Please verify your server email credentials (EMAIL_PASS in backend/.env).`,
        });
      }
    } else {
      console.warn('⚠️ Server email credentials (EMAIL_USER or EMAIL_PASS) are not configured.');
      return res.status(503).json({
        success: false,
        message: 'Server email credentials (EMAIL_USER or EMAIL_PASS) are not configured in backend/.env.',
      });
    }

    // Issue 15-minute challenge token
    const adminOtpToken = jwt.sign(
      { email: ADMIN_EMAIL, purpose: 'admin-otp-challenge' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    await AuditLog.create({
      action: 'admin_login_otp_dispatched',
      ip,
      details: { email: ADMIN_EMAIL, emailDispatched: true },
    }).catch(() => null);

    const responsePayload = {
      success: true,
      step: 'otp_required',
      message: 'Authentication code dispatched to your registered administrator email.',
      adminOtpToken,
      expiresInSeconds: 600,
      emailMasked: ADMIN_EMAIL.replace(/(^.{2})(.*)(@.*$)/, '$1***$3'),
    };

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error('Admin Login Step 1 Error:', err);
    return res.status(500).json({ success: false, message: 'Server error during administrator sign-in.' });
  }
};

/**
 * Step 2: POST /api/admin/auth/verify-otp
 * Body: { otp, adminOtpToken }
 */
exports.adminVerifyOtp = async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  try {
    const { otp, adminOtpToken: bodyToken } = req.body;
    const authHeader = req.headers.authorization;
    const token = bodyToken || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!token) {
      return res.status(401).json({ success: false, message: 'Admin challenge token is required.' });
    }

    if (!otp) {
      return res.status(400).json({ success: false, message: 'Verification code is required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Challenge session expired. Please sign in again.' });
    }

    if (decoded.purpose !== 'admin-otp-challenge' || decoded.email !== ADMIN_EMAIL) {
      return res.status(401).json({ success: false, message: 'Invalid admin challenge token.' });
    }

    const cleanOtp = otp.toString().trim();
    const otpDoc = await Otp.findOne({ email: ADMIN_EMAIL, purpose: 'admin-login' });

    if (!otpDoc) {
      return res.status(400).json({ success: false, message: 'Verification code expired or not found. Please log in again.' });
    }

    if (new Date() > new Date(otpDoc.expiresAt)) {
      await Otp.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ success: false, message: 'Verification code has expired. Please sign in again.' });
    }

    if (otpDoc.attempts >= 5) {
      await Otp.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ success: false, message: 'Too many failed verification attempts. Please request a new code.' });
    }

    const isMatch = await bcrypt.compare(cleanOtp, otpDoc.otpHash);
    if (!isMatch) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      const remaining = 5 - otpDoc.attempts;
      return res.status(400).json({
        success: false,
        message: `Incorrect code. ${remaining} attempt(s) remaining.`,
      });
    }

    // Success: consume OTP doc
    await Otp.deleteOne({ _id: otpDoc._id });

    // Ensure Admin User document exists in MongoDB
    let adminUser = await User.findOne({ email: ADMIN_EMAIL });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'System Administrator',
        fullName: 'System Administrator',
        email: ADMIN_EMAIL,
        role: 'admin',
        isEmailVerified: true,
        profileCompleted: true,
        authProviders: ['password'],
        phone: '+917604975206',
        password: process.env.ADMIN_PASSWORD_HASH || ADMIN_PASSWORD_HASH || (await bcrypt.hash('DIVAKAR@123', 12)),
      });
    } else {
      if (adminUser.role !== 'admin') {
        adminUser.role = 'admin';
      }
      const adminPassHash = process.env.ADMIN_PASSWORD_HASH || ADMIN_PASSWORD_HASH;
      if (!adminUser.password && adminPassHash) {
        adminUser.password = adminPassHash;
      }
      await adminUser.save();
    }

    // Issue 2-hour Admin JWT (strictly no refresh token)
    const adminJwt = jwt.sign(
      {
        id: adminUser._id,
        role: 'admin',
        email: ADMIN_EMAIL,
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    await AuditLog.create({
      action: 'admin_login_success',
      adminId: adminUser._id,
      ip,
      details: { email: ADMIN_EMAIL },
    }).catch(() => null);

    return res.status(200).json({
      success: true,
      message: 'Admin session authenticated successfully.',
      token: adminJwt,
      user: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: 'admin',
      },
    });
  } catch (err) {
    console.error('Admin Verify OTP Error:', err);
    return res.status(500).json({ success: false, message: 'Server error during OTP verification.' });
  }
};

/**
 * Diagnostic: GET /api/admin/auth/smtp-check
 * Safe inspection of SMTP configuration and connectivity
 */
exports.checkSmtpStatus = async (req, res) => {
  try {
    const user = (process.env.EMAIL_USER || process.env.GMAIL_USER || '').trim();
    const rawPass = (process.env.EMAIL_PASS || process.env.GMAIL_PASS || '').trim();
    const hasPass = Boolean(rawPass);
    const passLength = rawPass ? rawPass.length : 0;
    const adminEmail = (process.env.ADMIN_EMAIL || 'muthudivakar01022006@gmail.com').toLowerCase().trim();

    if (!user || !hasPass) {
      return res.status(200).json({
        configured: false,
        userPresent: Boolean(user),
        passPresent: hasPass,
        passLength,
        userMasked: user ? user.replace(/(^.{2})(.*)(@.*$)/, '$1***$3') : null,
        adminEmailMasked: adminEmail.replace(/(^.{2})(.*)(@.*$)/, '$1***$3'),
        message: 'EMAIL_USER or EMAIL_PASS environment variables are missing on this server instance. Please set them in your deployment environment settings.',
      });
    }

    const { getTransporter, getFallbackTransporter } = require('../utils/mailer');

    let port465Success = false;
    let port465Error = null;
    try {
      await getTransporter().verify();
      port465Success = true;
    } catch (err) {
      port465Error = err.message;
    }

    let port587Success = false;
    let port587Error = null;
    if (!port465Success) {
      try {
        await getFallbackTransporter().verify();
        port587Success = true;
      } catch (err) {
        port587Error = err.message;
      }
    }

    const working = port465Success || port587Success;
    return res.status(200).json({
      configured: true,
      smtpConnected: working,
      workingPort: port465Success ? 465 : (port587Success ? 587 : null),
      port465: { success: port465Success, error: port465Error },
      port587: { success: port587Success, error: port587Error },
      userMasked: user.replace(/(^.{2})(.*)(@.*$)/, '$1***$3'),
      adminEmailMasked: adminEmail.replace(/(^.{2})(.*)(@.*$)/, '$1***$3'),
      message: working
        ? `SMTP credentials and network verified successfully via Port ${port465Success ? 465 : 587}!`
        : `SMTP connection failed on both Port 465 and Port 587. Check Google App Password permissions.`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

