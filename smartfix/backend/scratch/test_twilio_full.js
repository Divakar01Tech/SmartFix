// SmartFix Twilio Integration Diagnostic & Test Suite
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const { sendSmsOtp } = require('../services/smsService');
const twilioService = require('../services/twilioService');

async function runTwilioTests() {
  console.log('========================================================');
  console.log('🚀 Running SmartFix Twilio Full Test Suite');
  console.log('========================================================\n');

  console.log('1. Checking Twilio Credentials Configuration:');
  console.log('   TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? '✅ Configured' : '⚠️ Missing (Will use Fallback Log mode)');
  console.log('   TWILIO_AUTH_TOKEN: ', process.env.TWILIO_AUTH_TOKEN ? '✅ Configured' : '⚠️ Missing');
  console.log('   TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER || '⚠️ Missing');
  console.log('   isTwilioConfigured():', twilioService.isTwilioConfigured());
  console.log('');

  console.log('2. Testing Phone Number Formatting (E.164 standard):');
  const rawPhones = ['9876543210', '919876543210', '+919876543210'];
  rawPhones.forEach(p => {
    console.log(`   Input: "${p}" -> Formatted: "${twilioService.formatPhoneE164(p)}"`);
  });
  console.log('');

  console.log('3. Testing SMS OTP Delivery Function (smsService):');
  const otpRes = await sendSmsOtp('9876543210', '654321', 'sms');
  console.log('   OTP Send Result:', JSON.stringify(otpRes));
  console.log('');

  console.log('4. Testing WhatsApp Message Formatting:');
  const waRes = await twilioService.sendWhatsApp('9876543210', 'SmartFix Alert: Your handyman booking has been confirmed!');
  console.log('   WhatsApp Result:', JSON.stringify(waRes));
  console.log('');

  console.log('5. Testing TwiML Voice Synthesis Response Generation:');
  const twimlOutput = twilioService.generateTwiMLResponse('Hello! A new urgent handyman booking is available in your area.');
  console.log('   Generated TwiML XML snippet:');
  console.log(twimlOutput);
  console.log('');

  console.log('6. Testing Voice Alert Outbound Dispatch:');
  const callRes = await twilioService.makeVoiceAlertCall('9876543210', 'SmartFix Alert: SLA deadline warning on booking #1024');
  console.log('   Voice Call Result:', JSON.stringify(callRes));
  console.log('');

  console.log('========================================================');
  console.log('✅ All Twilio Tests Executed Successfully!');
  console.log('========================================================');
}

runTwilioTests().catch(err => {
  console.error('❌ Twilio Test Suite Error:', err);
  process.exit(1);
});
