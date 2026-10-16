const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './smartfix/backend/.env' });

const BASE_URL = 'http://localhost:5000/api';

async function runCustomerSignupTest() {
  console.log('🧪 Starting Customer Registration Flow Verification Suite...\n');

  const testEmail = `cust_${Date.now()}@testsmartfix.com`;
  const testPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testPassword = 'Password@2026';
  const testName = 'Karthik Sivagangai Customer';

  // 1. Connect to DB to check OTPs
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfix');
  console.log('✅ Connected to MongoDB.');

  // Step 1: Send Email OTP
  console.log(`\n1️⃣ Testing /api/auth/email/send-otp for: ${testEmail}`);
  const sendRes = await fetch(`${BASE_URL}/auth/email/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail }),
  });
  const sendData = await sendRes.json();
  console.log('   Send OTP Response status:', sendRes.status, sendData);
  if (!sendRes.ok) throw new Error(`Send OTP failed: ${JSON.stringify(sendData)}`);

  // Step 2: Retrieve OTP doc from DB
  const otpDoc = await mongoose.connection.collection('otps').findOne({ email: testEmail, purpose: 'signup' });
  if (!otpDoc) throw new Error('OTP document not found in DB!');
  console.log('   Found OTP in DB: purpose =', otpDoc.purpose, ', attempts =', otpDoc.attempts);

  // Find the exact 6-digit plain OTP by testing 100000..999999 or generating one known OTP
  let matchedOtp = null;
  // Let's create a known OTP in DB so we can verify the API cleanly
  const knownOtp = '551212';
  const salt = await bcrypt.genSalt(10);
  const knownHash = await bcrypt.hash(knownOtp, salt);
  await mongoose.connection.collection('otps').updateOne(
    { _id: otpDoc._id },
    { $set: { otpHash: knownHash, attempts: 0 } }
  );
  console.log('   Set known OTP code:', knownOtp);

  // Step 3: Test partial / invalid OTP
  console.log('\n2️⃣ Testing partial / invalid OTP verification');
  const badRes = await fetch(`${BASE_URL}/auth/email/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, otp: '111111' }),
  });
  const badData = await badRes.json();
  console.log('   Invalid OTP response status:', badRes.status, badData.message);
  if (badRes.status !== 400) throw new Error('Expected 400 for bad OTP');

  // Step 4: Verify with valid OTP
  console.log('\n3️⃣ Testing valid OTP verification');
  const verifyRes = await fetch(`${BASE_URL}/auth/email/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, otp: knownOtp }),
  });
  const verifyData = await verifyRes.json();
  console.log('   Verify OTP response status:', verifyRes.status, 'signupToken present:', !!verifyData.signupToken);
  if (!verifyRes.ok || !verifyData.signupToken) throw new Error('OTP verification failed');

  const signupToken = verifyData.signupToken;

  // Step 5: Complete Registration
  console.log('\n4️⃣ Testing /api/auth/email/register with signupToken');
  const registerRes = await fetch(`${BASE_URL}/auth/email/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${signupToken}`,
    },
    body: JSON.stringify({
      name: testName,
      phone: testPhone,
      password: testPassword,
      address: '12 Raja Street, Sivagangai Town',
      district: 'Sivagangai',
      state: 'Tamil Nadu',
      role: 'customer',
    }),
  });
  const registerData = await registerRes.json();
  console.log('   Register response status:', registerRes.status);
  console.log('   Created user:', {
    name: registerData.user?.name,
    email: registerData.user?.email,
    phone: registerData.user?.phone,
    role: registerData.user?.role,
    profileCompleted: registerData.user?.profileCompleted,
    isEmailVerified: registerData.user?.isEmailVerified,
  });

  if (!registerRes.ok || !registerData.token) {
    throw new Error(`Registration failed: ${JSON.stringify(registerData)}`);
  }

  if (registerData.user.name !== testName) {
    throw new Error(`Name mismatch! Expected ${testName}, got ${registerData.user.name}`);
  }

  // Step 6: Test Login with the newly registered Customer
  console.log('\n5️⃣ Testing Customer Login with newly created credentials');
  const loginRes = await fetch(`${BASE_URL}/customer/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testEmail,
      password: testPassword,
    }),
  });
  const loginData = await loginRes.json();
  console.log('   Login response status:', loginRes.status, 'success:', loginData.success);
  if (!loginRes.ok || !loginData.token) {
    throw new Error(`Login failed with new credentials: ${JSON.stringify(loginData)}`);
  }

  // Cleanup test user
  await mongoose.connection.collection('users').deleteOne({ email: testEmail });
  console.log('\n🧹 Cleaned up test user.');
  await mongoose.disconnect();
  console.log('🎉 ALL CUSTOMER SIGNUP TESTS PASSED SUCCESSFULLY!\n');
}

runCustomerSignupTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
