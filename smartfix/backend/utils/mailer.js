const nodemailer = require('nodemailer');

let cachedTransporter = null;

const getTransporter = () => {
  const user = (process.env.EMAIL_USER || process.env.GMAIL_USER || '').trim();
  const rawPass = process.env.EMAIL_PASS || process.env.GMAIL_PASS || '';
  const pass = rawPass.replace(/\s+/g, '');

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      family: 4, // Prevent IPv6 DNS connection delay
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: {
        user,
        pass,
      },
    });
  }
  return cachedTransporter;
};

const resetTransporter = () => {
  cachedTransporter = null;
};

const getSender = (portalName = 'SmartFix') => {
  if (process.env.MAIL_FROM) {
    return process.env.MAIL_FROM;
  }
  const user = (process.env.EMAIL_USER || process.env.GMAIL_USER || '').trim();
  if (user) {
    return `"${portalName}" <${user}>`;
  }
  return `"${portalName}" <noreply@smartfix.com>`;
};

const HIGH_PRIORITY_HEADERS = {
  'X-Priority': '1 (Highest)',
  'X-MSMail-Priority': 'High',
  'Importance': 'High',
};

const sendOtpEmail = async (toEmail, otp) => {
  try {
    const mailOptions = {
      from: getSender('SmartFix Security'),
      to: toEmail,
      subject: 'SmartFix — Your Verification Code',
      headers: HIGH_PRIORITY_HEADERS,
      priority: 'high',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 24px; font-weight: 800; color: #2563eb;">SmartFix</span>
          </div>
          <h2 style="color: #0f172a; text-align: center; margin-bottom: 12px;">Sign In Verification</h2>
          <p style="font-size: 15px; color: #334155; line-height: 1.5; text-align: center;">
            Please use the following single-use verification code to sign in to your SmartFix account.
          </p>
          <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; padding: 20px; border-radius: 10px; text-align: center; margin: 24px 0;">
            <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 6px;">One-Time Passcode</span>
            <h1 style="margin: 0; font-size: 36px; letter-spacing: 8px; color: #0f172a; font-family: monospace;">${otp}</h1>
            <span style="font-size: 12px; color: #16a34a; font-weight: 600; display: block; margin-top: 8px;">⏱️ Valid for 10 minutes</span>
          </div>
          <p style="font-size: 13px; color: #64748b; text-align: center;">Do not share this code with anyone. SmartFix staff will never ask for your code.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">If you did not initiate this request, you can safely ignore this email.</p>
        </div>
      `,
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log('Customer OTP email dispatched: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending customer OTP email:', error.message);
    resetTransporter();
    return false;
  }
};

const sendWorkerOtpEmail = async (toEmail, otp, purpose = 'worker-signup') => {
  try {
    const isSignup = purpose === 'worker-signup';
    const subject = isSignup ? 'SmartFix Partner Portal — Email Verification OTP' : 'SmartFix Partner Portal — Password Reset Code';
    const title = isSignup ? 'Worker Account Registration' : 'Password Reset Verification';
    const description = isSignup 
      ? 'Welcome to SmartFix Partner Network! Use the 6-digit code below to verify your email address and continue your registration.'
      : 'You requested to reset your SmartFix Partner password. Use the 6-digit code below to proceed.';

    const mailOptions = {
      from: getSender('SmartFix Partner Portal'),
      to: toEmail,
      subject,
      headers: HIGH_PRIORITY_HEADERS,
      priority: 'high',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 24px; font-weight: 800; color: #0284c7; letter-spacing: -0.5px;">SmartFix <span style="color: #f59e0b;">Partner</span></span>
          </div>
          <h2 style="color: #0f172a; text-align: center; margin-bottom: 12px;">${title}</h2>
          <p style="font-size: 15px; color: #334155; line-height: 1.5; text-align: center;">${description}</p>
          
          <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; padding: 20px; border-radius: 10px; text-align: center; margin: 28px 0;">
            <span style="font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">Verification Code</span>
            <h1 style="margin: 0; font-size: 36px; letter-spacing: 8px; color: #0f172a; font-family: monospace;">${otp}</h1>
            <span style="font-size: 12px; color: #16a34a; font-weight: 600; display: block; margin-top: 8px;">⏱️ Valid for 10 minutes</span>
          </div>
          
          <p style="font-size: 13px; color: #64748b; text-align: center; margin: 0;">Do NOT share this code with anyone. SmartFix staff will never ask for your code.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">SmartFix Sivagangai & Tamil Nadu Home Services Provider Network.</p>
        </div>
      `,
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log(`Worker OTP email sent to ${toEmail}: %s`, info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending worker OTP email:', error.message);
    resetTransporter();
    return false;
  }
};

const sendWorkerApprovalEmail = async (toEmail, workerName) => {
  try {
    const mailOptions = {
      from: getSender('SmartFix Partner Portal'),
      to: toEmail,
      subject: '🎉 Congratulations! Your SmartFix Partner Account is Approved',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #bbf7d0; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 24px; font-weight: 800; color: #0284c7;">SmartFix <span style="color: #16a34a;">Verified Partner</span></span>
          </div>
          <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 20px;">
            <h2 style="color: #15803d; margin: 0 0 8px 0;">Welcome Aboard, ${workerName || 'Partner'}!</h2>
            <p style="color: #166534; font-size: 15px; margin: 0;">Your KYC documents and AI skill assessment have been reviewed and approved by the SmartFix Admin Team.</p>
          </div>
          <p style="font-size: 15px; color: #334155; line-height: 1.6;">You can now log in to the <strong>SmartFix Provider Portal</strong> to:</p>
          <ul style="color: #334155; font-size: 14px; line-height: 1.8;">
            <li>Toggle your live duty status to <strong>Available</strong></li>
            <li>Receive nearby customer booking requests across Sivagangai & Tamil Nadu</li>
            <li>Navigate to jobs with live GPS tracking</li>
            <li>Track daily and weekly direct wallet payouts</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.SERVER_PUBLIC_URL || 'http://localhost:5173'}/worker/login" style="background: #16a34a; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Log In to Partner Dashboard</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">SmartFix Support Desk • Sivagangai District, Tamil Nadu</p>
        </div>
      `,
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log(`Worker approval email sent to ${toEmail}: %s`, info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending worker approval email:', error.message);
    resetTransporter();
    return false;
  }
};

const sendWorkerRejectionEmail = async (toEmail, workerName, rejectionReason) => {
  try {
    const mailOptions = {
      from: getSender('SmartFix Partner Portal'),
      to: toEmail,
      subject: 'SmartFix Partner Application Status Update',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fecaca; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 24px; font-weight: 800; color: #0284c7;">SmartFix <span style="color: #dc2626;">Partner Review</span></span>
          </div>
          <h2 style="color: #991b1b; text-align: center; margin-bottom: 12px;">Application Needs Revision</h2>
          <p style="font-size: 15px; color: #334155; line-height: 1.6;">Dear ${workerName || 'Applicant'},</p>
          <p style="font-size: 15px; color: #334155; line-height: 1.6;">Thank you for your interest in joining SmartFix. After reviewing your submitted KYC details and skill assessment, our administrator noted the following issue:</p>
          
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 4px; margin: 20px 0;">
            <strong style="color: #991b1b; display: block; margin-bottom: 4px;">Reason for Rejection / Revision Required:</strong>
            <span style="color: #7f1d1d; font-size: 14px;">${rejectionReason || 'Documents were unclear or did not meet verification criteria.'}</span>
          </div>
          <p style="font-size: 14px; color: #475569; line-height: 1.6;">Don't worry! You can easily log in to your provider portal to re-upload clear photos of your ID or retake your AI skill assessment.</p>
          
          <div style="text-align: center; margin: 28px 0;">
            <a href="${process.env.SERVER_PUBLIC_URL || 'http://localhost:5173'}/worker/login" style="background: #dc2626; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Log In & Re-submit Documents</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">SmartFix Quality & Compliance Team</p>
        </div>
      `,
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log(`Worker rejection email sent to ${toEmail}: %s`, info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending worker rejection email:', error.message);
    resetTransporter();
    return false;
  }
};

const sendAdminOtpEmail = async (toEmail, otp) => {
  try {
    const mailOptions = {
      from: getSender('SmartFix Security'),
      to: toEmail,
      subject: '🛡️ SmartFix Administrator Portal — Single-Use Sign In Code',
      headers: HIGH_PRIORITY_HEADERS,
      priority: 'high',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #334155; border-radius: 12px; background: #0f172a; color: #f8fafc;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 22px; font-weight: 800; color: #38bdf8; letter-spacing: 1px;">SMARTFIX CONTROL CONSOLE</span>
          </div>
          <h2 style="color: #f1f5f9; text-align: center; margin-bottom: 12px;">Admin 2-Factor Authentication</h2>
          <p style="font-size: 14px; color: #cbd5e1; text-align: center; line-height: 1.5;">
            An administrative login attempt was verified against system credentials. Enter the single-use 6-digit authentication code below to grant privileged session access.
          </p>
          <div style="background-color: #1e293b; border: 1px solid #475569; padding: 20px; border-radius: 8px; text-align: center; margin: 28px 0;">
            <span style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 8px;">One-Time Security Passcode</span>
            <h1 style="margin: 0; font-size: 38px; letter-spacing: 8px; color: #38bdf8; font-family: monospace;">${otp}</h1>
            <span style="font-size: 12px; color: #38bdf8; font-weight: 600; display: block; margin-top: 8px;">⏱️ Valid for 10 minutes • 5 attempts maximum</span>
          </div>
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">If you did not initiate this administrator sign-in, rotate your ADMIN_PASSWORD_HASH immediately.</p>
        </div>
      `,
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log(`Admin OTP email sent to ${toEmail}: %s`, info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending admin OTP email:', error.message);
    resetTransporter();
    return false;
  }
};

const sendPasswordResetOtpEmail = async (toEmail, otp) => {
  try {
    const mailOptions = {
      from: getSender('SmartFix Security'),
      to: toEmail,
      subject: 'SmartFix — Password Reset Verification Code',
      headers: HIGH_PRIORITY_HEADERS,
      priority: 'high',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 24px; font-weight: 800; color: #2563eb;">SmartFix</span>
          </div>
          <h2 style="color: #0f172a; text-align: center; margin-bottom: 12px;">Reset Your Password</h2>
          <p style="font-size: 15px; color: #334155; line-height: 1.5; text-align: center;">
            We received a request to reset your SmartFix account password. Use the 6-digit verification code below to proceed.
          </p>
          <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; padding: 20px; border-radius: 10px; text-align: center; margin: 24px 0;">
            <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 6px;">Reset Passcode</span>
            <h1 style="margin: 0; font-size: 36px; letter-spacing: 8px; color: #0f172a; font-family: monospace;">${otp}</h1>
            <span style="font-size: 12px; color: #16a34a; font-weight: 600; display: block; margin-top: 8px;">⏱️ Valid for 10 minutes</span>
          </div>
          <p style="font-size: 13px; color: #64748b; text-align: center;">If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      `,
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log(`Password reset OTP email sent to ${toEmail}: %s`, info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending password reset OTP email:', error.message);
    resetTransporter();
    return false;
  }
};

const sendWorkerFeedbackEmail = async (toEmail, workerName, feedbackType = 'instruction', message = '', actionTaken = 'none') => {
  try {
    const feedbackTypeLabels = {
      praise: { title: '🌟 Commendation & Recognition from Administration', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
      warning: { title: '⚠️ Official Compliance Warning', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
      disciplinary: { title: '🚨 Disciplinary Notice & Administrative Action', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
      correction: { title: '🛠️ Service Quality Correction Required', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
      instruction: { title: '📋 Direct Administrative Instruction', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
    };

    const typeConfig = feedbackTypeLabels[feedbackType] || feedbackTypeLabels.instruction;

    const actionText = actionTaken === 'suspended'
      ? '🚨 Account Status: Suspended from taking jobs until resolved.'
      : actionTaken === 'blocked'
      ? '🛑 Account Status: Account Access Blocked.'
      : actionTaken === 'reinstated'
      ? '✅ Account Status: Reinstated to Active & Available.'
      : actionTaken === 'warning_issued'
      ? '⚠️ Action Taken: Formal Written Warning Recorded in File.'
      : 'ℹ️ Action Taken: Advisory Recorded.';

    const mailOptions = {
      from: getSender('SmartFix Administration'),
      to: toEmail,
      subject: `SmartFix Service Management: ${typeConfig.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid ${typeConfig.border}; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 24px; font-weight: 800; color: #0284c7;">SmartFix <span style="color: ${typeConfig.color};">Admin Directive</span></span>
          </div>
          <h2 style="color: ${typeConfig.color}; text-align: center; margin-bottom: 12px;">${typeConfig.title}</h2>
          <p style="font-size: 15px; color: #334155; line-height: 1.6;">Dear ${workerName || 'Partner'},</p>
          <p style="font-size: 15px; color: #334155; line-height: 1.6;">The SmartFix Platform Administration has issued the following official feedback and directive regarding your service profile:</p>

          <div style="background: ${typeConfig.bg}; border-left: 4px solid ${typeConfig.color}; padding: 18px; border-radius: 6px; margin: 20px 0;">
            <strong style="color: #0f172a; display: block; margin-bottom: 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Message from Administration:</strong>
            <p style="color: #1e293b; font-size: 15px; margin: 0; line-height: 1.6; white-space: pre-wrap;">${message}</p>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 8px; margin-bottom: 24px;">
            <span style="font-size: 13px; font-weight: 600; color: #475569;">${actionText}</span>
          </div>

          <p style="font-size: 14px; color: #64748b; line-height: 1.5;">If you have any questions or need to dispute an assessment, contact the administration desk through the partner portal.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">SmartFix Partner Operations • Sivagangai District, Tamil Nadu</p>
        </div>
      `,
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log(`Worker feedback email sent to ${toEmail}: %s`, info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending worker feedback email:', error.message);
    return false;
  }
};

module.exports = {
  sendOtpEmail,
  sendWorkerOtpEmail,
  sendWorkerApprovalEmail,
  sendWorkerRejectionEmail,
  sendAdminOtpEmail,
  sendPasswordResetOtpEmail,
  sendWorkerFeedbackEmail,
};


