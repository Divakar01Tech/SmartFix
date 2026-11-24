const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const User = require('../models/User');
const AiSettings = require('../models/AiSettings');
const { computeNameMatchScore, analyzeKycDocument } = require('../services/kycAiService');
const { invalidateAiSettingsCache } = require('../services/aiService');

async function runPrompt2Test() {
  console.log('--- Testing Prompt 2: AI KYC Document Check ---');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartfix';
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');

  // Test 1: Name match scoring algorithm
  console.log('\n[1] Testing computeNameMatchScore:');
  const exact = computeNameMatchScore('Karthik Raja', 'Karthik Raja');
  const honorific = computeNameMatchScore('Mr. Karthik Raja', 'Karthik Raja');
  const partial = computeNameMatchScore('Karthik R', 'Karthik Raja');
  const diff = computeNameMatchScore('Suresh Kumar', 'Murugan S');
  console.log(`- Exact match ("Karthik Raja" vs "Karthik Raja"): ${exact}% (Expect 100)`);
  console.log(`- With honorific ("Mr. Karthik Raja" vs "Karthik Raja"): ${honorific}% (Expect >= 90)`);
  console.log(`- Partial ("Karthik R" vs "Karthik Raja"): ${partial}%`);
  console.log(`- Different ("Suresh Kumar" vs "Murugan S"): ${diff}% (Expect < 50)`);

  if (exact !== 100 || honorific < 90 || diff >= 50) {
    throw new Error('Name match scoring failed validation checks.');
  }
  console.log('✓ Name match scoring verified!');

  // Test 2: AI Feature Disable Toggle
  console.log('\n[2] Testing AI Feature toggle on/off:');
  let settings = await AiSettings.findOne({ singletonKey: 'DEFAULT_AI_SETTINGS' });
  if (!settings) {
    settings = await AiSettings.create({ singletonKey: 'DEFAULT_AI_SETTINGS' });
  }
  settings.kycCheck = false;
  await settings.save();
  invalidateAiSettingsCache();

  // Create temporary worker
  const testEmail = `test_kyc_worker_${Date.now()}@example.com`;
  const worker = await User.create({
    name: 'Karthik Raja',
    fullName: 'Karthik Raja',
    email: testEmail,
    phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: 'Password123!',
    role: 'worker',
    trade: 'Plumbing',
    categories: ['Plumbing'],
    verificationStatus: 'pending_verification',
  });

  const disabledRes = await analyzeKycDocument(worker._id);
  console.log('Result when kycCheck is disabled:', disabledRes);
  if (!disabledRes.aiDisabled) {
    throw new Error('Expected analyzeKycDocument to return aiDisabled: true when toggle is false');
  }
  console.log('✓ Toggle gating works properly!');

  // Re-enable toggle
  settings.kycCheck = true;
  await settings.save();
  invalidateAiSettingsCache();

  // Test 3: Document check execution
  console.log('\n[3] Testing document analysis with mocked or actual file:');
  const dummyDocPath = path.join(__dirname, 'dummy_id.jpg');
  // Write a simple valid 1x1 jpeg buffer if not exists
  const dummyJpg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
  fs.writeFileSync(dummyDocPath, dummyJpg);

  worker.kyc = {
    aadhaarFrontPath: dummyDocPath,
    aadhaarLast4: '4321',
  };
  await worker.save();

  const analysisRes = await analyzeKycDocument(worker._id);
  console.log('Analysis Result:', analysisRes);

  const updatedWorker = await User.findById(worker._id);
  console.log('Updated worker kycCheck in DB:', updatedWorker.kyc?.kycCheck);

  if (!updatedWorker.kyc?.kycCheck || !updatedWorker.kyc.kycCheck.status) {
    throw new Error('Worker record was not updated with kycCheck');
  }
  console.log('✓ Worker kycCheck populated and stored successfully!');

  // Cleanup
  if (fs.existsSync(dummyDocPath)) fs.unlinkSync(dummyDocPath);
  await User.deleteOne({ _id: worker._id });
  await mongoose.disconnect();
  console.log('\nPrompt 2 Test Completed Successfully! 🎉');
}

runPrompt2Test().catch(err => {
  console.error('Prompt 2 Test Failed:', err);
  process.exit(1);
});
