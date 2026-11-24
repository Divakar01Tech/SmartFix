const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const Booking = require('../models/Booking');
const User = require('../models/User');
const PhotoHash = require('../models/PhotoHash');
const FraudFlag = require('../models/FraudFlag');
const AiSettings = require('../models/AiSettings');
const { recordAndUploadProof, verifyJobProof } = require('../services/jobProofService');
const { invalidateAiSettingsCache } = require('../services/aiService');

async function runPrompt7Test() {
  console.log('--- Testing Prompt 7: Before/After Job Verification ---');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartfix';
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');

  // Create test customer & worker
  const customer = await User.create({
    name: 'Proof Customer',
    email: `proof_cust_${Date.now()}@example.com`,
    phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: 'Password123!',
    role: 'customer',
  });

  const worker = await User.create({
    name: 'Proof Worker',
    email: `proof_worker_${Date.now()}@example.com`,
    phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: 'Password123!',
    role: 'worker',
    trade: 'Plumbing',
    verificationStatus: 'approved',
  });

  const booking1 = await Booking.create({
    customer: customer._id,
    worker: worker._id,
    trade: 'Plumbing',
    address: 'Sivagangai, Tamil Nadu',
    district: 'Sivagangai',
    price: 350,
    status: 'arrived',
  });

  // Create dummy image buffer 1 & dummy image buffer 2
  const dummyBuf1 = Buffer.from('FAKE_IMAGE_BEFORE_REPAIR_LEAKING_PIPE_123');
  const dummyBuf2 = Buffer.from('FAKE_IMAGE_AFTER_REPAIR_FIXED_PIPE_456');

  // Test 1: Uploading before photo
  console.log('\n[1] Testing initial before proof upload:');
  const upload1 = await recordAndUploadProof({
    bookingId: booking1._id,
    workerId: worker._id,
    fileBuffer: dummyBuf1,
    fileRelativePath: '/storage/proofs/test_before.jpg',
    kind: 'before',
  });
  console.log('Before Upload Result:', upload1);
  if (!upload1.success || !upload1.entry.sha256) {
    throw new Error('Before proof upload failed');
  }
  console.log('✓ Before photo recorded with SHA-256 hash!');

  // Test 2: Uploading exact same photo as "after" -> must flag identical image
  console.log('\n[2] Testing identical photo upload as "after" (anti-cheat check):');
  const upload2 = await recordAndUploadProof({
    bookingId: booking1._id,
    workerId: worker._id,
    fileBuffer: dummyBuf1, // Exact same buffer!
    fileRelativePath: '/storage/proofs/test_identical_after.jpg',
    kind: 'after',
  });
  console.log('Identical After Upload Result:', upload2);
  if (!upload2.isIdenticalOpposite) {
    throw new Error('Failed to flag identical opposite photo');
  }

  // Running verification on identical images
  const verifyIdenticalRes = await verifyJobProof(booking1._id);
  console.log('Verification on Identical Images:', verifyIdenticalRes);
  if (verifyIdenticalRes.verdict !== 'suspicious' || !verifyIdenticalRes.concerns.includes('Identical image hash detected')) {
    throw new Error('Identical image proof verification must return suspicious verdict');
  }
  console.log('✓ Identical images flagged as "suspicious" with 0 confidence!');

  // Test 3: Uploading a photo that was already used on another booking -> proof_reuse detection
  console.log('\n[3] Testing photo reuse across multiple bookings:');
  const booking2 = await Booking.create({
    customer: customer._id,
    worker: worker._id,
    trade: 'Plumbing',
    address: 'Karaikudi, Tamil Nadu',
    district: 'Sivagangai',
    price: 400,
    status: 'arrived',
  });

  const reuseUpload = await recordAndUploadProof({
    bookingId: booking2._id,
    workerId: worker._id,
    fileBuffer: dummyBuf1, // Previously uploaded in booking1
    fileRelativePath: '/storage/proofs/test_reused.jpg',
    kind: 'before',
  });
  console.log('Reused Photo Upload Result:', reuseUpload);
  if (!reuseUpload.isReused) {
    throw new Error('Failed to detect photo hash reuse across bookings');
  }

  // Check if FraudFlag or signal was logged for proof_reuse
  const flag = await FraudFlag.findOne({ subjectUserId: worker._id });
  console.log('Generated Fraud Flag for Worker:', flag ? { type: flag.type, score: flag.score, signals: flag.signals } : null);
  if (!flag || !flag.signals.some((s) => s.code === 'proof_reuse')) {
    throw new Error('Expected proof_reuse signal in FraudFlag for worker');
  }
  console.log('✓ Proof reuse across different bookings flagged with fraud signal!');

  // Test 4: Feature Toggle disabled
  console.log('\n[4] Testing AI toggle disabled for jobProofCheck:');
  let settings = await AiSettings.findOne({ singletonKey: 'DEFAULT_AI_SETTINGS' });
  if (!settings) {
    settings = await AiSettings.create({ singletonKey: 'DEFAULT_AI_SETTINGS' });
  }
  settings.jobProofCheck = false;
  await settings.save();
  invalidateAiSettingsCache();

  // Upload distinct after photo on booking2
  await recordAndUploadProof({
    bookingId: booking2._id,
    workerId: worker._id,
    fileBuffer: dummyBuf2,
    fileRelativePath: '/storage/proofs/test_after.jpg',
    kind: 'after',
  });

  const disabledVerify = await verifyJobProof(booking2._id);
  console.log('Result when jobProofCheck is disabled:', disabledVerify);
  if (disabledVerify.verdict !== 'not_run' || !disabledVerify.aiDisabled) {
    throw new Error('Expected verdict: not_run and aiDisabled: true when toggle is disabled');
  }
  console.log('✓ Disabled toggle delivered verdict: "not_run" safely!');

  // Re-enable toggle
  settings.jobProofCheck = true;
  await settings.save();
  invalidateAiSettingsCache();

  // Cleanup
  await Booking.deleteMany({ _id: { $in: [booking1._id, booking2._id] } });
  await PhotoHash.deleteMany({ workerId: worker._id });
  await FraudFlag.deleteMany({ subjectUserId: worker._id });
  await User.deleteMany({ _id: { $in: [customer._id, worker._id] } });
  await mongoose.disconnect();
  console.log('\nPrompt 7 Test Completed Successfully! 🎉');
}

runPrompt7Test().catch((err) => {
  console.error('Prompt 7 Test Failed:', err);
  process.exit(1);
});
