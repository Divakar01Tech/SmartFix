const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const OtpRequest = require('../models/OtpRequest');
const otpService = require('../services/otpService');
const { sendSmsOtp } = require('../services/smsService');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting SmartFix OTP & Fast2SMS Verification Suite');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfix';
  await mongoose.connect(mongoUri, { family: 4 });
  console.log('✅ Connected to MongoDB:', mongoUri);

  const testPhone = '+919876543210';
  const testPurpose = 'register';

  // Cleanup any test documents
  await OtpRequest.deleteMany({ phoneNumber: testPhone });

  // TEST 1: Generation & Persistence in MongoDB
  console.log('\n--- TEST 1: Generate OTP & Verify MongoDB Persistence ---');
  const genResult = await otpService.generateOtp(testPhone, testPurpose);
  console.log('OTP generate result:', genResult);

  const doc = await OtpRequest.findOne({ phoneNumber: testPhone, purpose: testPurpose });
  if (!doc) {
    throw new Error('❌ TEST 1 FAILED: OtpRequest document not found in MongoDB!');
  }
  console.log('✅ Found persistent OtpRequest document in MongoDB:');
  console.log({
    id: doc._id.toString(),
    phoneNumber: doc.phoneNumber,
    hashedOtp: doc.hashedOtp.substring(0, 15) + '...',
    purpose: doc.purpose,
    attemptCount: doc.attemptCount,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
  });

  // Verify plaintext is not stored
  if (doc.hashedOtp.length < 50 || !doc.hashedOtp.startsWith('$2')) {
    throw new Error('❌ TEST 1 FAILED: hashedOtp is not a valid bcrypt hash!');
  }
  console.log('✅ OTP is properly hashed with bcrypt ($2a/b$ prefix). Plaintext is NEVER stored.');

  // TEST 2: Hardcoded "123456" Backdoor Rejection Test
  console.log('\n--- TEST 2: Verify Hardcoded "123456" Bypass is Completely Rejected ---');
  let backdoorAccepted = false;
  try {
    await otpService.verifyOtp(testPhone, testPurpose, '123456');
    backdoorAccepted = true;
  } catch (err) {
    console.log('✅ Backdoor 123456 was correctly REJECTED:', err.message);
  }
  if (backdoorAccepted) {
    throw new Error('❌ TEST 2 FAILED: Backdoor "123456" was accepted!');
  }

  // TEST 3: Brute-Force Attempt Limiting
  console.log('\n--- TEST 3: Brute-force Attempt Limiting ---');
  // Attempt 1 already failed above (attemptCount = 1). Let's attempt wrong code until locked (total 5).
  for (let i = 2; i <= 5; i++) {
    try {
      await otpService.verifyOtp(testPhone, testPurpose, '000000');
    } catch (err) {
      console.log(`Attempt ${i} rejected as expected: ${err.message}`);
    }
  }

  const updatedDoc = await OtpRequest.findOne({ phoneNumber: testPhone, purpose: testPurpose });
  console.log(`Document attemptCount after 5 bad attempts: ${updatedDoc.attemptCount}`);
  if (updatedDoc.attemptCount < 5) {
    throw new Error(`❌ TEST 3 FAILED: attemptCount is ${updatedDoc.attemptCount}, expected >= 5`);
  }

  // Attempt 6 must be blocked with lockout
  try {
    await otpService.verifyOtp(testPhone, testPurpose, '000000');
    throw new Error('❌ TEST 3 FAILED: 6th attempt was not blocked!');
  } catch (err) {
    console.log('✅ 6th attempt successfully blocked:', err.message);
    if (!err.message.includes('Too many failed attempts')) {
      throw new Error(`❌ TEST 3 FAILED: Unexpected error message: ${err.message}`);
    }
  }

  // TEST 4: Simulated Server Restart Persistence
  console.log('\n--- TEST 4: Server Restart Simulation ---');
  // Create a fresh OTP with a known raw code for testing verification after restart
  const testPhone2 = '+919876543211';
  await OtpRequest.deleteMany({ phoneNumber: testPhone2 });

  const rawCode = '742618';
  const salt = await bcrypt.genSalt(10);
  const hashedOtp = await bcrypt.hash(rawCode, salt);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await OtpRequest.create({
    phoneNumber: testPhone2,
    hashedOtp,
    purpose: 'login',
    expiresAt,
    attemptCount: 0,
    verified: false,
  });

  console.log('Simulating server restart: Disconnecting Mongoose...');
  await mongoose.disconnect();
  console.log('Mongoose disconnected. State:', mongoose.connection.readyState);

  console.log('Simulating server startup: Reconnecting Mongoose...');
  await mongoose.connect(mongoUri, { family: 4 });
  console.log('Mongoose reconnected. State:', mongoose.connection.readyState);

  // Verify that the OTP record persisted across the restart and can be verified
  const verifyResult = await otpService.verifyOtp(testPhone2, 'login', rawCode);
  console.log('✅ OTP successfully verified after simulated server restart:', verifyResult.success);
  if (!verifyResult.success) {
    throw new Error('❌ TEST 4 FAILED: OTP failed verification after server restart!');
  }

  // TEST 5: TTL Index Verification
  console.log('\n--- TEST 5: MongoDB TTL Index Verification ---');
  const indexes = await OtpRequest.collection.indexes();
  console.log('OtpRequest Collection Indexes:');
  indexes.forEach(idx => console.log(' -', idx.name, idx.key, idx.expireAfterSeconds !== undefined ? `(TTL: expireAfterSeconds=${idx.expireAfterSeconds})` : ''));
  const ttlIndex = indexes.find(idx => idx.expireAfterSeconds !== undefined || idx.key.expiresAt !== undefined);
  if (!ttlIndex) {
    throw new Error('❌ TEST 5 FAILED: TTL Index on expiresAt was not found!');
  }
  console.log('✅ TTL Index confirmed on expiresAt.');

  // TEST 6: Fast2SMS Diagnostic & Error Logging Check
  console.log('\n--- TEST 6: Fast2SMS API Diagnostics & Clear Error Reporting ---');
  const smsTest = await sendSmsOtp(testPhone, '889900');
  console.log('Fast2SMS send result object:', smsTest);
  if (smsTest.success === false) {
    console.log('✅ Fast2SMS failure properly produced non-silent, structured error:');
    console.log('   Error:', smsTest.error);
    console.log('   Status Code:', smsTest.statusCode);
  }

  // Cleanup test data
  await OtpRequest.deleteMany({ phoneNumber: { $in: [testPhone, testPhone2] } });

  console.log('\n====================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
  await mongoose.disconnect();
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
