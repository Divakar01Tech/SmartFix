const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

module.exports = {
  sendOtpEmail,
};
