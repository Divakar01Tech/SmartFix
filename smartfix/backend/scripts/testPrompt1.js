const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Wallet = require('../models/Wallet');
const FraudFlag = require('../models/FraudFlag');
const FraudSettings = require('../models/FraudSettings');
const { evaluate } = require('../services/fraudService');
const { isAiFeatureEnabled } = require('../services/aiService');

async function runPrompt1Test() {
  console.log('--- RUNNING PROMPT 1 (FRAUD DETECTION) TEST ---');
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfix';
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');

  // Cleanup test entities
  await User.deleteMany({ email: /testfraud_\w+@smartfix\.local/ });
  await FraudFlag.deleteMany({ type: { $in: ['cancel_farming', 'self_booking'] } });

  // 1. Create a test customer and worker with the same device ID
  const testDeviceId = 'dev_test_shared_hardware_123';
  const customer = await User.create({
    name: 'Fraud Test Customer',
    email: `testfraud_cust_${Date.now()}@smartfix.local`,
    role: 'customer',
    deviceIds: [testDeviceId],
    lastKnownIps: ['192.168.1.100'],
  });

  const worker = await User.create({
    name: 'Fraud Test Worker',
    email: `testfraud_wrk_${Date.now()}@smartfix.local`,
    role: 'worker',
    trade: 'Electrical Repairs',
    deviceIds: [testDeviceId],
    lastKnownIps: ['192.168.1.100'],
  });

  console.log('✓ Created test customer and worker sharing deviceId:', testDeviceId);

  // 2. Create a test booking between them
  const booking = await Booking.create({
    customer: customer._id,
    worker: worker._id,
    trade: 'Electrical',
    status: 'Completed',
    price: 450,
    address: 'Sivagangai Test Street',
    date: '2026-11-23',
    time: 'Immediate',
  });

  // Create customer wallet with bonus credit
  await Wallet.create({
    user: customer._id,
    role: 'customer',
    balance: 50,
    transactions: [
      {
        type: 'credit',
        amount: 50,
        description: 'Welcome Bonus Reward',
        category: 'bonus',
        status: 'available',
      },
    ],
  });

  // 3. Evaluate fraud signals
  console.log('Evaluating fraud signals on shared device booking...');
  const result = await evaluate({ bookingId: booking._id, userId: customer._id });
  console.log('Fraud Evaluation Result:', result);

  if (result && result.flagged && result.score >= 60) {
    console.log(`✓ Test Passed: Score ${result.score} triggered fraud flag with signals:`, result.signals.map(s => s.code));
  } else {
    console.warn('Evaluation result did not flag as expected:', result);
  }

  // 4. Check wallet status held
  const updatedWallet = await Wallet.findOne({ user: customer._id });
  const pendingTx = updatedWallet.transactions.find(t => t.status === 'pending_review');
  console.log('Wallet bonus transaction status:', pendingTx ? 'pending_review (Correctly held)' : 'available');

  // Clean up test documents
  await User.deleteMany({ _id: { $in: [customer._id, worker._id] } });
  await Booking.findByIdAndDelete(booking._id);
  await Wallet.deleteOne({ user: customer._id });
  await FraudFlag.deleteMany({ subjectUserId: customer._id });

  await mongoose.disconnect();
  console.log('--- PROMPT 1 TESTS COMPLETE ---');
}

runPrompt1Test().catch((err) => {
  console.error('Prompt 1 Test Failed:', err);
  process.exit(1);
});
