const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const Earning = require('../models/Earning');
const WebhookEvent = require('../models/WebhookEvent');
const { finalizePayment } = require('../controllers/paymentController');
const { verifyRazorpaySignature, verifyWebhookSignature } = require('../utils/razorpay');
const { sweepExpiredPaymentOrders } = require('../services/paymentReconciliationCron');

async function runTests() {
  console.log('🧪 Starting SmartFix Razorpay Payment Integration Test Suite...\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartfix_dev';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB for testing');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Checkout Signature Verification (crypto.timingSafeEqual)
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Testing Checkout Signature Verification ---');
    process.env.RAZORPAY_KEY_SECRET = 'test_secret_key_12345';
    const orderId = 'order_test_98765';
    const paymentId = 'pay_test_54321';
    const validCheckoutSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    assert(
      verifyRazorpaySignature(orderId, paymentId, validCheckoutSig) === true,
      'Valid checkout HMAC-SHA256 signature is accepted'
    );
    assert(
      verifyRazorpaySignature(orderId, paymentId, 'tampered_invalid_signature_hex') === false,
      'Tampered checkout signature is rejected'
    );

    // ------------------------------------------------------------------------
    // TEST 2: Webhook Signature Verification (Raw Body HMAC-SHA256)
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Testing Webhook Signature Verification ---');
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_67890';
    const rawWebhookPayload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: paymentId, order_id: orderId, amount: 45000 } } },
    });
    const validWebhookSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawWebhookPayload)
      .digest('hex');

    assert(
      verifyWebhookSignature(rawWebhookPayload, validWebhookSig) === true,
      'Valid raw webhook payload HMAC signature is accepted'
    );
    assert(
      verifyWebhookSignature(rawWebhookPayload + ' tampered', validWebhookSig) === false,
      'Tampered raw webhook payload is rejected'
    );

    // ------------------------------------------------------------------------
    // TEST 3: Wallet Reservation, Release, and Commit
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Testing Wallet Reservation Mechanics ---');
    const testCustUser = await User.create({
      name: 'Test Customer',
      email: `cust_${Date.now()}@smartfix.test`,
      phone: `+9198${Date.now().toString().slice(-8)}`,
      password: 'password123',
      role: 'customer',
    });

    const custWallet = await Wallet.create({
      user: testCustUser._id,
      role: 'customer',
      balance: 500, // ₹500
      reservedBalance: 0,
    });

    assert(custWallet.getSpendableBalance() === 500, 'Initial spendable balance is ₹500');

    // Reserve ₹200 for checkout
    await custWallet.reserve(200, new mongoose.Types.ObjectId());
    assert(custWallet.reservedBalance === 200, 'Reserved balance is now ₹200');
    assert(custWallet.getSpendableBalance() === 300, 'Spendable balance reduced to ₹300 while balance stays ₹500');

    // Release ₹50
    await custWallet.releaseReservation(50, new mongoose.Types.ObjectId());
    assert(custWallet.reservedBalance === 150, 'Reserved balance released down to ₹150');
    assert(custWallet.getSpendableBalance() === 350, 'Spendable balance increased to ₹350');

    // Commit ₹150 on payment success
    await custWallet.commitReservation(150, 'Booking checkout payment', new mongoose.Types.ObjectId());
    assert(custWallet.balance === 350, 'Balance deducted to ₹350 upon commit');
    assert(custWallet.reservedBalance === 0, 'Reserved balance cleared to 0 upon commit');
    assert(custWallet.transactions.length === 1, 'Debit transaction recorded in ledger');

    // ------------------------------------------------------------------------
    // TEST 4: Idempotent finalizePayment() with Integer Paise
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Testing Idempotent finalizePayment() & Ledger Accounting ---');
    const testWorkerUser = await User.create({
      name: 'Test Technician',
      email: `worker_${Date.now()}@smartfix.test`,
      phone: `+9197${Date.now().toString().slice(-8)}`,
      password: 'password123',
      role: 'worker',
      trade: 'Electrical Repairs',
    });

    const testBooking = await Booking.create({
      customer: testCustUser._id,
      worker: testWorkerUser._id,
      trade: 'Electrical Repairs',
      address: '123 Main St, Sivagangai, Tamil Nadu',
      status: 'completed',
      paymentStatus: 'Unpaid',
      price: 450,
      finalAmountPaise: 45000, // ₹450 = 45000 paise
    });

    const testOrderId = `order_test_${Date.now()}`;
    const testPayment = await Payment.create({
      booking: testBooking._id,
      customer: testCustUser._id,
      provider: testWorkerUser._id,
      worker: testWorkerUser._id,
      razorpayOrderId: testOrderId,
      amountTotalPaise: 45000,
      walletUsedPaise: 10000, // ₹100 wallet used
      amountPayablePaise: 35000, // ₹350 charged via Razorpay
      commissionPercentSnapshot: 10,
      bonusPercentSnapshot: 5,
      amountTotal: 450,
      walletUsed: 100,
      amountPaid: 350,
      status: 'created',
    });

    const res1 = await finalizePayment(testOrderId, 'pay_real_12345', { paymentMethod: 'Razorpay' });
    assert(res1.alreadyProcessed === false, 'First payment finalization executes successfully');

    const updatedPayment = await Payment.findById(testPayment._id);
    assert(updatedPayment.status === 'paid', 'Payment status marked as paid');
    assert(updatedPayment.commissionPaise === 4500, 'Commission is exactly 10% of total (4500 paise = ₹45)');
    assert(updatedPayment.workerPayoutPaise === 40500, 'Worker payout is 40500 paise (₹405)');
    assert(
      updatedPayment.bonusPaise === 1750,
      'Bonus cashback is 5% of ONLY the Razorpay-paid portion (35000 * 5% = 1750 paise = ₹17.50)'
    );

    // Check Earning ledger
    const earningEntry = await Earning.findOne({ paymentId: testPayment._id });
    assert(earningEntry !== null, 'Worker earning entry recorded in Earning ledger');
    assert(earningEntry.status === 'pending_payout', 'Worker earning initial status is pending_payout');
    assert(earningEntry.netPaise === 40500, 'Worker net paise recorded accurately');

    // Test Idempotency (Second call with same orderId)
    const res2 = await finalizePayment(testOrderId, 'pay_real_12345', { paymentMethod: 'Razorpay' });
    assert(res2.alreadyProcessed === true, 'Second payment finalization is an idempotent NO-OP');

    const totalEarningsCount = await Earning.countDocuments({ paymentId: testPayment._id });
    assert(totalEarningsCount === 1, 'No duplicate earnings ledger created on duplicate finalization');

    // ------------------------------------------------------------------------
    // TEST 5: WebhookEvent Deduplication
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Testing WebhookEvent Deduplication ---');
    const sampleEventId = `evt_dedup_${Date.now()}`;
    await WebhookEvent.create({
      eventId: sampleEventId,
      eventType: 'payment.captured',
      status: 'processed',
    });

    let duplicateCaught = false;
    try {
      await WebhookEvent.create({
        eventId: sampleEventId,
        eventType: 'payment.captured',
        status: 'processed',
      });
    } catch (dupErr) {
      duplicateCaught = dupErr.code === 11000;
    }
    assert(duplicateCaught === true, 'Duplicate webhook eventId is blocked by unique index');

    // ------------------------------------------------------------------------
    // TEST 6: Payment Expiration Sweep
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Testing Payment Expiration Sweep ---');
    const expiredPayment = await Payment.create({
      booking: testBooking._id,
      customer: testCustUser._id,
      razorpayOrderId: `order_expired_${Date.now()}`,
      amountTotalPaise: 30000,
      walletUsedPaise: 5000,
      amountPayablePaise: 25000,
      amountTotal: 300,
      walletUsed: 50,
      amountPaid: 250,
      status: 'created',
      orderExpiresAt: new Date(Date.now() - 60000), // Expired 1 min ago
    });

    // Hold ₹50 reservation
    await custWallet.reserve(50, testBooking._id);
    const beforeSweepReserved = custWallet.reservedBalance;

    await sweepExpiredPaymentOrders();

    const checkedExpiredPayment = await Payment.findById(expiredPayment._id);
    assert(checkedExpiredPayment.status === 'failed', 'Expired payment status updated to failed by sweep');

    const refreshedCustWallet = await Wallet.findById(custWallet._id);
    assert(
      refreshedCustWallet.reservedBalance < beforeSweepReserved,
      'Customer reserved wallet funds released by expiration sweep'
    );

    // Clean up test records
    await Booking.deleteMany({ _id: testBooking._id });
    await Payment.deleteMany({ booking: testBooking._id });
    await Earning.deleteMany({ bookingId: testBooking._id });
    await WebhookEvent.deleteMany({ eventId: sampleEventId });
    await Wallet.deleteMany({ user: { $in: [testCustUser._id, testWorkerUser._id] } });
    await User.deleteMany({ _id: { $in: [testCustUser._id, testWorkerUser._id] } });

    console.log(`\n========================================`);
    console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
