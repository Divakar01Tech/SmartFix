process.env.NODE_ENV = 'test';
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../server');
const User = require('../models/User');
const Otp = require('../models/Otp');
const AuditLog = require('../models/AuditLog');

const PORT = 5055;
const BASE_URL = `http://localhost:${PORT}/api`;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'muthudivakar01022006@gmail.com').toLowerCase().trim();

let serverInstance;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runAdminFlowTest() {
  try {
    console.log('========================================================');
    console.log('🧪 SMARTFIX COMPLETE ADMIN LOGIN FLOW VERIFICATION TEST');
    console.log('========================================================');

    // Start isolated test server
    serverInstance = app.listen(PORT, () => {
      console.log(`🚀 Admin test server running on port ${PORT}`);
    });

    // Ensure connected to Mongo
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfix');
    }

    // Reset failed count and lock status
    await User.updateOne({ email: ADMIN_EMAIL }, { failedLoginAttempts: 0, lockUntil: null });

    // 1. Invalid Password Attempt
    console.log('\n--- 1. Testing Invalid Password Rejection ---');
    const wrongRes = await fetch(`${BASE_URL}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: 'WrongPassword999' }),
    });
    const wrongData = await wrongRes.json();
    assert(wrongRes.status === 401, 'Invalid password returns 401 status');
    assert(wrongData.success === false, 'Response indicates failure');

    const adminDoc = await User.findOne({ email: ADMIN_EMAIL });
    assert(adminDoc.failedLoginAttempts === 1, 'Failed attempt count incremented in MongoDB');

    // 2. Valid Step 1 Sign-in
    console.log('\n--- 2. Testing Step 1 Valid Credentials ---');
    const step1Res = await fetch(`${BASE_URL}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: 'admin123' }),
    });
    const step1Data = await step1Res.json();
    assert(step1Res.status === 200, 'Step 1 sign-in with admin123 returns 200 status');
    assert(step1Data.step === 'otp_required', 'Response step is "otp_required"');
    assert(!!step1Data.adminOtpToken, 'Step 1 issues adminOtpToken challenge token');
    assert(step1Data.expiresInSeconds === 600, 'OTP expiration time indicates 10 minutes');

    // Verify reset of failed attempts
    const adminRefreshed = await User.findOne({ email: ADMIN_EMAIL });
    assert(adminRefreshed.failedLoginAttempts === 0, 'Failed attempts reset to 0 after valid credentials');

    // 3. Inspect OTP in Database
    console.log('\n--- 3. Verifying OTP in MongoDB ---');
    const otpDoc = await Otp.findOne({ email: ADMIN_EMAIL, purpose: 'admin-login' });
    assert(!!otpDoc, 'OTP record created in database with purpose "admin-login"');
    assert(!!otpDoc.otpHash, 'OTP is stored in database as bcrypt hash (not plain text)');

    // For test simulation, set a deterministic OTP hash
    const testOtpCode = '852963';
    otpDoc.otpHash = await bcrypt.hash(testOtpCode, 10);
    await otpDoc.save();

    // 4. Invalid OTP Attempt
    console.log('\n--- 4. Testing Invalid OTP Code Rejection ---');
    const badOtpRes = await fetch(`${BASE_URL}/admin/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${step1Data.adminOtpToken}`,
      },
      body: JSON.stringify({ otp: '000000', adminOtpToken: step1Data.adminOtpToken }),
    });
    assert(badOtpRes.status === 400, 'Invalid OTP code returns 400 Bad Request');

    // 5. Valid Step 2 OTP Verification
    console.log('\n--- 5. Testing Step 2 Valid OTP Verification ---');
    const step2Res = await fetch(`${BASE_URL}/admin/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${step1Data.adminOtpToken}`,
      },
      body: JSON.stringify({ otp: testOtpCode, adminOtpToken: step1Data.adminOtpToken }),
    });
    const step2Data = await step2Res.json();
    assert(step2Res.status === 200, 'Step 2 OTP verification returns 200 OK');
    assert(!!step2Data.token, 'Admin JWT token issued');
    assert(step2Data.user?.role === 'admin', 'Returned user role is strictly "admin"');

    // Check decoded JWT
    const decoded = jwt.decode(step2Data.token);
    assert(decoded.role === 'admin', 'JWT payload contains role "admin"');
    assert(decoded.email === ADMIN_EMAIL, `JWT payload contains email ${ADMIN_EMAIL}`);

    // Check that OTP doc was consumed
    const consumedOtp = await Otp.findOne({ email: ADMIN_EMAIL, purpose: 'admin-login' });
    assert(!consumedOtp, 'Single-use OTP document consumed (deleted) from database');

    // Check password persistence (NOT overwritten)
    const postLoginAdmin = await User.findOne({ email: ADMIN_EMAIL }).select('+password');
    const stillMatches = await bcrypt.compare('admin123', postLoginAdmin.password);
    assert(stillMatches === true, 'Admin password in MongoDB remains intact and valid for next login');

    // 6. Accessing Protected Admin Endpoints
    console.log('\n--- 6. Testing Protected Admin Endpoint Authorization ---');
    const adminAnalyticsRes = await fetch(`${BASE_URL}/admin/analytics`, {
      headers: { Authorization: `Bearer ${step2Data.token}` },
    });
    assert(adminAnalyticsRes.status === 200, 'Admin JWT grants access to /api/admin/analytics');

    // 7. Rejecting Unauthorized Calls to Admin Endpoints
    console.log('\n--- 7. Testing Unauthorized & Cross-Role Rejection ---');
    const noTokenRes = await fetch(`${BASE_URL}/admin/analytics`);
    assert(noTokenRes.status === 401, 'Accessing admin endpoint with no token returns 401');

    // Customer token
    const customerToken = jwt.sign({ id: new mongoose.Types.ObjectId(), role: 'customer' }, process.env.JWT_SECRET || 'smartfix_secret_key_2026');
    const custRes = await fetch(`${BASE_URL}/admin/analytics`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(custRes.status === 403, 'Customer token rejected with 403 Forbidden on admin endpoint');

    // Worker token
    const workerToken = jwt.sign({ id: new mongoose.Types.ObjectId(), role: 'worker' }, process.env.JWT_SECRET || 'smartfix_secret_key_2026');
    const workerRes = await fetch(`${BASE_URL}/admin/analytics`, {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    assert(workerRes.status === 403, 'Worker token rejected with 403 Forbidden on admin endpoint');

    console.log('\n========================================================');
    console.log('🎉 ALL ADMIN LOGIN FLOW TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================\n');

  } catch (err) {
    console.error('\n❌ Admin Flow Verification Failed:', err);
    process.exitCode = 1;
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
  }
}

runAdminFlowTest();
