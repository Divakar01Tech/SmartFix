const dotenv = require('dotenv');
dotenv.config();

const twilioService = require('../services/twilioService');
const { formatPhoneE164, isTwilioVerifyConfigured } = require('../config/twilio');

async function testUserPhone() {
  const rawPhone = '7604975206';
  const formatted = formatPhoneE164(rawPhone);

  console.log(`📱 User Verified Twilio Phone: ${rawPhone}`);
  console.log(`📌 Formatted E.164: ${formatted}`);
  console.log(`🔑 Is Twilio Verify Configured? ${isTwilioVerifyConfigured() ? 'YES' : 'NO (Replace VAxxx in backend/.env with your real Service SID)'}`);

  try {
    const res = await twilioService.sendVerifyOtp(formatted);
    console.log('✅ Send OTP Response:', res);
  } catch (err) {
    console.error('❌ Error sending OTP via Twilio:', err.message);
  }
}

testUserPhone();
