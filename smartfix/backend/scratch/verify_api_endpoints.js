const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });

const OtpRequest = require('../models/OtpRequest');

async function testEndpoints() {
  console.log('Testing HTTP Endpoints on http://localhost:5000...');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfix';
  await mongoose.connect(mongoUri, { family: 4 });

  const testPhone = '+919988776655';
  await OtpRequest.deleteMany({ phoneNumber: testPhone });

  // 1. Send OTP via HTTP
  const sendRes = await fetch('http://localhost:5000/api/otp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: testPhone, purpose: 'register' }),
  });
  const sendData = await sendRes.json();
  console.log('HTTP /api/otp/send response:', sendData);

  if (sendData.demoOtp) {
    throw new Error('❌ FAILURE: demoOtp leaked in API response!');
  }
  console.log('✅ demoOtp is NOT leaked in API response.');

  // Check DB for created document
  const doc = await OtpRequest.findOne({ phoneNumber: testPhone, purpose: 'register' });
  if (!doc) {
    throw new Error('❌ FAILURE: Document not found in OtpRequest collection!');
  }
  console.log('✅ OtpRequest document found in MongoDB collection.');

  // 2. Try Backdoor "123456" via HTTP
  const verifyBackdoorRes = await fetch('http://localhost:5000/api/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: testPhone, purpose: 'register', otp: '123456' }),
  });
  const verifyBackdoorData = await verifyBackdoorRes.json();
  console.log('HTTP /api/otp/verify backdoor test response:', verifyBackdoorRes.status, verifyBackdoorData);

  if (verifyBackdoorRes.status === 200 || verifyBackdoorData.success === true) {
    throw new Error('❌ FAILURE: Backdoor "123456" was accepted over HTTP API!');
  }
  console.log('✅ Backdoor "123456" was REJECTED with HTTP', verifyBackdoorRes.status);

  // Cleanup
  await OtpRequest.deleteMany({ phoneNumber: testPhone });
  await mongoose.disconnect();
  console.log('🎉 HTTP API verification completed successfully.');
  process.exit(0);
}

testEndpoints().catch(err => {
  console.error('HTTP test error:', err);
  process.exit(1);
});
