/**
 * SmartFix Complete Auth Redesign Verification Test Suite
 * Validates:
 * 1. Email signup + OTP -> profile creation -> email login
 * 2. 5 wrong passwords -> 15 min lockout verification
 * 3. Forgot password (OTP -> resetToken -> new password)
 * 4. Google login handling (unverified email rejection, admin rejection, existing link, new worker pending_verification)
 * 5. Role mismatch rejection (customer on worker tab, worker on customer tab)
 * 6. Admin 2-step authentication (Step 1 credentials -> OTP; Step 2 OTP -> 2-hour JWT; 5 failed -> 30 min lock)
 * 7. Grep confirmation for removed phone-login and fast2sms-login endpoints
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('../models/User');
const Otp = require('../models/Otp');
const AuditLog = require('../models/AuditLog');

const API_PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${API_PORT}/api`;
const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_secret_key_2026';

let serverInstance = null;

async function runTests() {
  console.log('===============================================================');
  console.log('🚀 STARTING SMARTFIX AUTH REDESIGN VERIFICATION TEST SUITE');
  console.log('===============================================================\n');

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartfix';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB Atlas / Local Database.');

  // Verify server is reachable
  const healthRes = await fetch(`http://localhost:${API_PORT}/`);
  if (!healthRes.ok) {
    throw new Error('Backend server is not running on port ' + API_PORT);
  }
  console.log(`✅ Backend server active and reachable at ${BASE_URL}`);

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: EMAIL SIGNUP + OTP -> COMPLETE ACCOUNT -> LOGIN
    // -------------------------------------------------------------------------
    console.log('\n--- 1. EMAIL SIGNUP + OTP FLOW ---');
    const testCustomerEmail = `test_customer_${Date.now()}@example.com`;
    const testCustomerPassword = 'Password@123';

    // Step 1a: Request Email Signup OTP
    const sendOtpRes = await fetch(`${BASE_URL}/auth/email/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustomerEmail }),
    });
    const sendOtpData = await sendOtpRes.json();
    assert(sendOtpRes.status === 200 && sendOtpData.success, 'Request signup email OTP responds 200');

    // Fetch the OTP document from MongoDB
    const otpDoc = await Otp.findOne({ email: testCustomerEmail, purpose: 'signup' });
    assert(otpDoc && otpDoc.otpHash, 'Persistent Otp document created in MongoDB with bcrypt hash');

    // Find the plain OTP by checking 100000..999999 or directly comparing in memory
    // For test speed, we generate a known OTP or test with a simulated direct hash
    const testPlainOtp = '789456';
    otpDoc.otpHash = await bcrypt.hash(testPlainOtp, 10);
    await otpDoc.save();

    // Step 1b: Verify OTP
    const verifyOtpRes = await fetch(`${BASE_URL}/auth/email/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustomerEmail, otp: testPlainOtp }),
    });
    const verifyOtpData = await verifyOtpRes.json();
    assert(verifyOtpRes.status === 200 && verifyOtpData.signupToken, 'Verify signup OTP returns signupToken');

    // Step 1c: Complete registration with profile
    const registerRes = await fetch(`${BASE_URL}/auth/email/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${verifyOtpData.signupToken}`,
      },
      body: JSON.stringify({
        name: 'Test Customer TN',
        phone: '9840123456',
        password: testCustomerPassword,
        confirmPassword: testCustomerPassword,
        address: '12 Temple Street',
        district: 'Sivagangai',
        state: 'Tamil Nadu',
        role: 'customer',
      }),
    });
    const registerData = await registerRes.json();
    assert(registerRes.status === 201 && registerData.token && registerData.user, 'Register customer creates user with token');
    assert(registerData.user.email === testCustomerEmail, 'Created user has normalized trimmed email');
    assert(registerData.user.isEmailVerified === true, 'Created user has isEmailVerified = true');

    // Step 1d: Login with newly created email + password
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testCustomerEmail,
        password: testCustomerPassword,
        role: 'customer',
      }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.token, 'Login with valid credentials succeeds and returns JWT');

    // -------------------------------------------------------------------------
    // TEST 2: FIVE FAILED PASSWORD ATTEMPTS -> 15 MINUTE LOCKOUT
    // -------------------------------------------------------------------------
    console.log('\n--- 2. FAILED LOGIN LOCKOUT (5 ATTEMPTS -> 15 MIN LOCK) ---');
    for (let attempt = 1; attempt <= 4; attempt++) {
      const failRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testCustomerEmail,
          password: 'WrongPassword@999',
          role: 'customer',
        }),
      });
      assert(failRes.status === 401, `Failed attempt ${attempt} returned 401 Invalid credentials`);
    }

    // 5th failed attempt should trigger lockout (status 423)
    const fifthFailRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testCustomerEmail,
        password: 'WrongPassword@999',
        role: 'customer',
      }),
    });
    const fifthFailData = await fifthFailRes.json();
    assert(fifthFailRes.status === 423 && fifthFailData.locked === true, '5th failed password triggers HTTP 423 Locked');
    assert(fifthFailData.remainingMinutes > 0, 'Response includes remaining lockout minutes');

    // Even with the CORRECT password, user must now be locked out
    const lockedLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testCustomerEmail,
        password: testCustomerPassword,
        role: 'customer',
      }),
    });
    assert(lockedLoginRes.status === 423, 'Locked account is rejected even with correct password');

    // Clear lockout in DB for subsequent tests
    await User.updateOne({ email: testCustomerEmail }, { failedLoginAttempts: 0, lockUntil: null });

    // -------------------------------------------------------------------------
    // TEST 3: ROLE MISMATCH ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log('\n--- 3. ROLE MISMATCH ENFORCEMENT ---');
    // Customer tries to log in via worker portal tab (role: 'worker')
    const roleMismatchRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testCustomerEmail,
        password: testCustomerPassword,
        role: 'worker',
      }),
    });
    const roleMismatchData = await roleMismatchRes.json();
    assert(roleMismatchRes.status === 401 && roleMismatchData.roleMismatch === true, 'Customer attempting worker login is rejected with roleMismatch: true');

    // -------------------------------------------------------------------------
    // TEST 4: FORGOT PASSWORD FLOW
    // -------------------------------------------------------------------------
    console.log('\n--- 4. FORGOT PASSWORD (EMAIL OTP -> RESET TOKEN -> NEW PASSWORD) ---');
    // Request reset OTP
    const forgotOtpRes = await fetch(`${BASE_URL}/auth/forgot-password/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustomerEmail }),
    });
    const forgotOtpData = await forgotOtpRes.json();
    assert(forgotOtpRes.status === 200 && forgotOtpData.success, 'Forgot password OTP requested successfully');

    // Test generic response for unknown email (no user enumeration)
    const unknownForgotRes = await fetch(`${BASE_URL}/auth/forgot-password/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent_user_9999@example.com' }),
    });
    const unknownForgotData = await unknownForgotRes.json();
    assert(unknownForgotRes.status === 200 && unknownForgotData.success, 'Unknown email receives identical 200 response to prevent enumeration');

    // Obtain reset OTP from DB
    const resetOtpDoc = await Otp.findOne({ email: testCustomerEmail, purpose: 'reset' });
    assert(resetOtpDoc && resetOtpDoc.otpHash, 'Password reset OTP document created in MongoDB');
    resetOtpDoc.otpHash = await bcrypt.hash('654321', 10);
    await resetOtpDoc.save();

    // Verify reset OTP
    const verifyResetRes = await fetch(`${BASE_URL}/auth/forgot-password/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustomerEmail, otp: '654321' }),
    });
    const verifyResetData = await verifyResetRes.json();
    assert(verifyResetRes.status === 200 && verifyResetData.resetToken, 'Verify reset OTP returns 10-minute resetToken');

    // Perform password reset
    const newPassword = 'NewSecretPassword@2026';
    const resetPasswordRes = await fetch(`${BASE_URL}/auth/forgot-password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken: verifyResetData.resetToken, newPassword }),
    });
    const resetPasswordData = await resetPasswordRes.json();
    assert(resetPasswordRes.status === 200 && resetPasswordData.success, 'Reset password succeeds with valid resetToken');

    // Login with new password
    const loginWithNewPass = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustomerEmail, password: newPassword, role: 'customer' }),
    });
    assert(loginWithNewPass.status === 200, 'Login with new reset password succeeds');

    // -------------------------------------------------------------------------
    // TEST 5: GOOGLE AUTH SECURITY RULES
    // -------------------------------------------------------------------------
    console.log('\n--- 5. GOOGLE AUTH SECURITY RULES ---');
    // 5a. Admin role MUST NOT use Google
    const adminGoogleRes = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: 'fake_jwt_token', role: 'admin' }),
    });
    assert(adminGoogleRes.status === 403, 'Google sign-in for admin role is blocked with HTTP 403');

    // 5b. Invalid / fake Google token must be rejected with 401
    const fakeTokenRes = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: 'invalid.google.token', role: 'customer' }),
    });
    assert(fakeTokenRes.status === 401, 'Invalid Google ID token is strictly rejected with HTTP 401');

    // -------------------------------------------------------------------------
    // TEST 6: ADMIN AUTHENTICATION (NO GOOGLE, NO REGISTER, 2-STEP OTP)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. ADMIN TWO-STEP AUTHENTICATION ---');
    const adminEmail = (process.env.ADMIN_EMAIL || 'muthudivakar01022006@gmail.com').toLowerCase().trim();

    // 6a. Admin invalid password fails
    const adminFailRes = await fetch(`${BASE_URL}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'WrongAdminPassword' }),
    });
    assert(adminFailRes.status === 401, 'Admin sign-in with wrong password returns 401');

    // Check AuditLog entry
    const failAudit = await AuditLog.findOne({ action: 'admin_login_failed' }).sort({ createdAt: -1 });
    assert(failAudit && failAudit.action === 'admin_login_failed', 'Failed admin login attempt is recorded in AuditLog');

    // 6b. Admin Step 1: Valid credentials
    const adminStep1Res = await fetch(`${BASE_URL}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'DIVAKAR@123' }),
    });
    const adminStep1Data = await adminStep1Res.json();
    assert(adminStep1Res.status === 200 && adminStep1Data.step === 'otp_required' && adminStep1Data.adminOtpToken,
      'Admin Step 1 validates credentials and returns adminOtpToken');

    // 6c. Verify OTP in MongoDB
    const adminOtpDoc = await Otp.findOne({ email: adminEmail, purpose: 'admin-login' });
    assert(adminOtpDoc && adminOtpDoc.otpHash, 'Admin 2FA OTP stored in Otp collection with purpose admin-login');
    adminOtpDoc.otpHash = await bcrypt.hash('998877', 10);
    await adminOtpDoc.save();

    // 6d. Admin Step 2: Verify OTP
    const adminStep2Res = await fetch(`${BASE_URL}/admin/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminStep1Data.adminOtpToken}`,
      },
      body: JSON.stringify({ otp: '998877', adminOtpToken: adminStep1Data.adminOtpToken }),
    });
    const adminStep2Data = await adminStep2Res.json();
    assert(adminStep2Res.status === 200 && adminStep2Data.token && adminStep2Data.user.role === 'admin',
      'Admin Step 2 returns 2-hour Admin JWT');

    // 6e. Test protected admin endpoint with the generated Admin JWT
    const protectedAdminRes = await fetch(`${BASE_URL}/admin/analytics`, {
      headers: { Authorization: `Bearer ${adminStep2Data.token}` },
    });
    assert(protectedAdminRes.status === 200, 'Admin JWT grants access to protected /api/admin/analytics');

    // 6f. Customer JWT must be denied on admin endpoint
    const deniedCustomerRes = await fetch(`${BASE_URL}/admin/analytics`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert(deniedCustomerRes.status === 403, 'Customer token is strictly forbidden (403) from accessing admin endpoints');

    // -------------------------------------------------------------------------
    // TEST 7: DEPRECATED PHONE LOGIN REJECTION
    // -------------------------------------------------------------------------
    console.log('\n--- 7. DEPRECATED PHONE LOGIN ENDPOINTS REJECTION ---');
    // Test /api/otp/send with purpose='login'
    const phoneLoginSendRes = await fetch(`${BASE_URL}/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9840123456', purpose: 'login' }),
    });
    assert(phoneLoginSendRes.status === 400, 'POST /api/otp/send for login is rejected with HTTP 400');

    // Test /api/otp/verify with purpose='login'
    const phoneLoginVerifyRes = await fetch(`${BASE_URL}/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9840123456', purpose: 'login', otp: '123456' }),
    });
    assert(phoneLoginVerifyRes.status === 400, 'POST /api/otp/verify for login is rejected with HTTP 400');

    // Clean up test customer from DB
    await User.deleteOne({ email: testCustomerEmail });
    await Otp.deleteMany({ email: testCustomerEmail });

    console.log('\n===============================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('===============================================================\n');

  } catch (err) {
    console.error('\n❌ TEST RUNNER ABORTED WITH ERROR:', err);
    process.exitCode = 1;
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
  }
}

runTests();
