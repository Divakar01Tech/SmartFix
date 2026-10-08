const nodemailer = require('nodemailer');

// Configure the transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_PASS  // Your Gmail App Password
  }
});

/**
 * Send an OTP to a user's email
 * @param {string} email - The recipient email
 * @param {string} otp - The OTP code
 */
exports.sendEmailOTP = async (email, otp) => {
  try {
    const mailOptions = {
      from: `"SmartFix Tamil Nadu" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'SmartFix - Login Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #2563eb; text-align: center;">SmartFix Tamil Nadu</h2>
          <p>Hello,</p>
          <p>Your verification code for SmartFix is:</p>
          <h1 style="text-align: center; font-size: 36px; letter-spacing: 4px; color: #1e293b; background: #f1f5f9; padding: 10px; border-radius: 8px;">${otp}</h1>
          <p>This code is valid for 10 minutes. Do not share it with anyone.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <br>
          <p>Regards,</p>
          <p><strong>The SmartFix Team</strong></p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email OTP sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending email OTP:', error.message);
    return false;
  }
};

/**
 * Send a booking invoice/bill
 * @param {string} email - The recipient email
 * @param {object} invoice - Invoice details
 */
exports.sendInvoice = async (email, invoice) => {
  try {
    const mailOptions = {
      from: `"SmartFix Tamil Nadu" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Invoice for Booking #${invoice.bookingId}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #2563eb; text-align: center;">SmartFix Tamil Nadu</h2>
          <h3>Invoice Details</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Booking ID</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${invoice.bookingId}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Service</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${invoice.service}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Professional</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${invoice.workerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Total Amount</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #16a34a;">₹${invoice.amount}</td>
            </tr>
          </table>
          <p style="margin-top: 20px;">Thank you for using SmartFix!</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Invoice email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending invoice email:', error.message);
    return false;
  }
};
