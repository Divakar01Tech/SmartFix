const nodemailer = require('nodemailer');

const getTransporter = () => {
  return nodemailer.createTransport({
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const sendOtpEmail = async (toEmail, otp) => {
  try {
    const mailOptions = {
      from: process.env.MAIL_FROM || '"SmartFix" <noreply@smartfix.com>',
      to: toEmail,
      subject: 'SmartFix - Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #2563eb; text-align: center; margin-bottom: 30px;">SmartFix Verification</h2>
          <p style="font-size: 16px; color: #334155;">Hello,</p>
          <p style="font-size: 16px; color: #334155;">Please use the following OTP to verify your email address. This code is valid for <strong>5 minutes</strong>.</p>
          
          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <h1 style="margin: 0; font-size: 32px; letter-spacing: 4px; color: #0f172a;">${otp}</h1>
          </div>
          
          <p style="font-size: 14px; color: #64748b; text-align: center;">Do not share this OTP with anyone.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
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
      from: process.env.MAIL_FROM || '"SmartFix Partner Portal" <noreply@smartfix.com>',
      to: toEmail,
      subject,
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
            <span style="font-size: 12px; color: #94a3b8; display: block; margin-top: 8px;">⏱️ Valid for 5 minutes only</span>
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
    return false;
  }
};

const sendWorkerApprovalEmail = async (toEmail, workerName) => {
  try {
    const mailOptions = {
      from: process.env.MAIL_FROM || '"SmartFix Partner Portal" <noreply@smartfix.com>',
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
    return false;
  }
};

const sendWorkerRejectionEmail = async (toEmail, workerName, rejectionReason) => {
  try {
    const mailOptions = {
      from: process.env.MAIL_FROM || '"SmartFix Partner Portal" <noreply@smartfix.com>',
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
    return false;
  }
};

module.exports = {
  sendOtpEmail,
  sendWorkerOtpEmail,
  sendWorkerApprovalEmail,
  sendWorkerRejectionEmail,
};

