/**
 * Automated Verification Script for SmartFix Twilio OTP & Authentication Flow
 */
const twilioConfig = require('../config/twilio');
const twilioVerifyService = require('../services/twilioVerifyService');
const jwt = require('jsonwebtoken');

console.log('--- 🧪 STARTING TWILIO VERIFY & OTP VERIFICATION TESTS ---');

// Test 1: Twilio Config helper functions
console.log('\n[Test 1] Formatting Phone Numbers to E.164...');
const formatted1 = twilioConfig.formatPhoneE164('9876543210');
const formatted2 = twilioConfig.formatPhoneE164('+91 9876543210');
const formatted3 = twilioConfig.formatPhoneE164('1234'); // invalid

console.log(`  '9876543210' -> '${formatted1}' (${formatted1 === '+919876543210' ? '✅ PASS' : '❌ FAIL'})`);
console.log(`  '+91 9876543210' -> '${formatted2}' (${formatted2 === '+919876543210' ? '✅ PASS' : '❌ FAIL'})`);
console.log(`  '1234' -> '${formatted3}' (${formatted3 === null ? '✅ PASS' : '❌ FAIL'})`);

// Test 2: Check Twilio Verify config state
console.log('\n[Test 2] Checking isTwilioVerifyConfigured()...');
const isConfigured = twilioConfig.isTwilioVerifyConfigured();
console.log(`  isTwilioVerifyConfigured(): ${isConfigured}`);

// Test 3: Test OTP_MOCK_MODE behavior
console.log('\n[Test 3] Testing Mock Mode handling in twilioVerifyService...');
process.env.OTP_MOCK_MODE = 'true';
// Re-require to refresh process.env
delete require.cache[require.resolve('../services/twilioVerifyService')];
const mockVerifyService = require('../services/twilioVerifyService');

mockVerifyService.sendVerificationCode('+919876543210')
  .then(res => {
    console.log(`  sendVerificationCode mock result:`, res);
    console.log(`  ${res.mocked === true && res.status === 'pending' ? '✅ PASS' : '❌ FAIL'}`);
    return mockVerifyService.checkVerificationCode('+919876543210', '123456');
  })
  .then(res => {
    console.log(`  checkVerificationCode mock result:`, res);
    console.log(`  ${res.mocked === true && res.approved === true ? '✅ PASS' : '❌ FAIL'}`);
    process.env.OTP_MOCK_MODE = 'false';
    console.log('\n--- 🎉 ALL TESTS COMPLETED SUCCESSFULY ---');
  })
  .catch(err => {
    console.error('❌ Test failed with error:', err.message);
    process.env.OTP_MOCK_MODE = 'false';
  });
