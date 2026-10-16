const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config({ path: __dirname + '/../.env' });

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_super_secret_jwt_key_2025';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfix';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test_secret_for_suite';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret_suite';

// Ensure test environment secrets for signature calculations
process.env.RAZORPAY_KEY_SECRET = RAZORPAY_KEY_SECRET;
process.env.RAZORPAY_WEBHOOK_SECRET = RAZORPAY_WEBHOOK_SECRET;

// Models
const User = require('../models/User');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Wallet = require('../models/Wallet');
const { WalletTransaction } = require('../models/Wallet');
const Settings = require('../models/Settings');

function generateSignature(orderId, paymentId, secret) {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

function generateWebhookSignature(bodyStr, secret) {
  return crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
}

async function runPaymentAcceptanceSuite() {
  console.log('================================================================');
  console.log('💳 SMARTFIX RAZORPAY & WALLET ACCEPTANCE TEST SUITE');
  console.log('================================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB for acceptance assertions.\n');

  // Ensure default platform rates: 10% commission, 5% bonus
  await Settings.deleteMany({});
  await Settings.create({
    commissionPercent: 10,
    customerBonusPercent: 5,
  });

  const timestamp = Date.now();
  const password = await bcrypt.hash('Password@123', 10);

  // 1. Create Customer Alice (Owner)
  const custAlice = await User.create({
    name: 'Alice Customer',
    email: `alice_${timestamp}@test.com`,
    phone: `+9198${String(timestamp).slice(-8)}`,
    password,
    role: 'customer',
    isVerified: true,
  });
  const tokenAlice = jwt.sign({ id: custAlice._id, role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });

  // 2. Create Customer Bob (Attacker / Different Customer)
  const custBob = await User.create({
    name: 'Bob Customer',
    email: `bob_${timestamp}@test.com`,
    phone: `+9197${String(timestamp).slice(-8)}`,
    password,
    role: 'customer',
    isVerified: true,
  });
  const tokenBob = jwt.sign({ id: custBob._id, role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });

  // 3. Create Worker Charlie
  const workerCharlie = await User.create({
    name: 'Charlie Electrician',
    email: `charlie_${timestamp}@test.com`,
    phone: `+9196${String(timestamp).slice(-8)}`,
    password,
    role: 'worker',
    trade: 'Electrical Repairs',
    isVerified: true,
    verificationStatus: 'approved',
    earnings: 0,
    totalEarnings: 0,
  });

  let testsPassed = 0;
  const totalTests = 7;

  try {
    // ========================================================================
    // TEST 1: Customer cannot pay non-Completed booking (Pending / Accepted)
    // ========================================================================
    console.log('TEST 1: Customer cannot pay a non-Completed booking (Pending/Accepted)');
    const bPending = await Booking.create({
      customer: custAlice._id,
      worker: workerCharlie._id,
      trade: 'Electrician',
      price: 500,
      status: 'Accepted',
      paymentStatus: 'Unpaid',
      address: 'Karaikudi, Sivagangai',
    });

    const resT1 = await fetch(`${API_BASE}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`,
      },
      body: JSON.stringify({ bookingId: bPending._id.toString() }),
    });

    const dataT1 = await resT1.json();
    if (resT1.status === 400 && dataT1.message?.includes('Completed')) {
      console.log('  ✅ Correctly rejected non-completed booking with HTTP 400');
      testsPassed++;
    } else {
      console.error(`  ❌ Failed: expected 400, got ${resT1.status}`, dataT1);
    }

    // ========================================================================
    // TEST 2: Customer cannot pay someone else's booking
    // ========================================================================
    console.log('\nTEST 2: Customer cannot pay someone else\'s booking (Ownership guard)');
    const bCompleted = await Booking.create({
      customer: custAlice._id,
      worker: workerCharlie._id,
      trade: 'Electrician',
      price: 600,
      status: 'Completed',
      paymentStatus: 'Unpaid',
      address: 'Karaikudi, Sivagangai',
    });

    const resT2 = await fetch(`${API_BASE}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenBob}`, // Bob attempts to pay Alice's booking
      },
      body: JSON.stringify({ bookingId: bCompleted._id.toString() }),
    });

    const dataT2 = await resT2.json();
    if (resT2.status === 403 && dataT2.message?.includes('own bookings')) {
      console.log('  ✅ Correctly rejected unauthorized customer with HTTP 403');
      testsPassed++;
    } else {
      console.error(`  ❌ Failed: expected 403, got ${resT2.status}`, dataT2);
    }

    // ========================================================================
    // TEST 3: Tampering with amount in request does not change charged amount
    // ========================================================================
    console.log('\nTEST 3: Tampered amount in request is rejected (Server-authoritative pricing)');
    const resT3 = await fetch(`${API_BASE}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`,
      },
      body: JSON.stringify({
        bookingId: bCompleted._id.toString(),
        amount: 1, // Malicious tampered amount (attempting to pay ₹1 instead of ₹600)
      }),
    });

    const dataT3 = await resT3.json();
    if (resT3.status === 400 && dataT3.message?.includes('Tampered payment amount rejected')) {
      console.log('  ✅ Anti-tampering check triggered: client amount tampering rejected with HTTP 400');
      testsPassed++;
    } else {
      console.error(`  ❌ Failed: expected 400, got ${resT3.status}`, dataT3);
    }

    // ========================================================================
    // TEST 4: Wallet-only payment (100% coverage) completes directly without Razorpay
    // ========================================================================
    console.log('\nTEST 4: Wallet-only payment (100% coverage) completes without opening Razorpay');
    const bWallet = await Booking.create({
      customer: custAlice._id,
      worker: workerCharlie._id,
      trade: 'Electrician',
      price: 350,
      status: 'Completed',
      paymentStatus: 'Unpaid',
      address: 'Karaikudi, Sivagangai',
    });

    // Credit Alice's wallet with ₹500
    let aliceWallet = await Wallet.findOne({ user: custAlice._id });
    if (!aliceWallet) {
      aliceWallet = await Wallet.create({ user: custAlice._id, role: 'customer', balance: 0 });
    }
    await aliceWallet.credit(500, 'Test balance top-up');

    const resT4 = await fetch(`${API_BASE}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`,
      },
      body: JSON.stringify({
        bookingId: bWallet._id.toString(),
        useWallet: true,
      }),
    });

    const dataT4 = await resT4.json();
    const updatedBWallet = await Booking.findById(bWallet._id);
    const updatedAliceWallet = await Wallet.findOne({ user: custAlice._id });
    const updatedCharlie = await User.findById(workerCharlie._id);

    // ₹350 price, 10% commission = ₹35, worker payout = ₹315
    if (
      resT4.status === 200 &&
      dataT4.paidWithWallet === true &&
      updatedBWallet.status.toLowerCase() === 'paid' &&
      updatedAliceWallet.balance === 150 && // 500 - 350 = 150
      updatedCharlie.earnings >= 315
    ) {
      console.log('  ✅ 100% Wallet payment completed directly:');
      console.log(`     - Booking Status: ${updatedBWallet.status}`);
      console.log(`     - Alice Wallet: ₹${aliceWallet.balance} -> ₹${updatedAliceWallet.balance}`);
      console.log(`     - Charlie Earnings: +₹315 (₹${updatedCharlie.earnings})`);
      testsPassed++;
    } else {
      console.error('  ❌ Failed wallet payment test:', dataT4);
    }

    // ========================================================================
    // TEST 5: Normal Razorpay Order creation & HMAC Verify
    // ========================================================================
    console.log('\nTEST 5: Razorpay create-order & HMAC signature verification (Timing Safe)');
    const bRazorpay = await Booking.create({
      customer: custAlice._id,
      worker: workerCharlie._id,
      trade: 'Plumber',
      price: 500,
      status: 'Completed',
      paymentStatus: 'Unpaid',
      address: 'Sivagangai Town',
    });

    // Alice has ₹150 in wallet, uses it -> Razorpay charges ₹500 - ₹150 = ₹350 (35000 paise)
    const resT5Order = await fetch(`${API_BASE}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`,
      },
      body: JSON.stringify({
        bookingId: bRazorpay._id.toString(),
        useWallet: true,
      }),
    });

    const dataT5Order = await resT5Order.json();
    const orderId = dataT5Order.orderId;
    const paymentId = `pay_test_${timestamp}`;
    const validSignature = generateSignature(orderId, paymentId, RAZORPAY_KEY_SECRET);

    const resT5Verify = await fetch(`${API_BASE}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`,
      },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSignature,
        bookingId: bRazorpay._id.toString(),
        useWallet: true,
      }),
    });

    const dataT5Verify = await resT5Verify.json();
    const updatedBRzp = await Booking.findById(bRazorpay._id);
    const postVerifyCharlie = await User.findById(workerCharlie._id);
    const postVerifyAliceWallet = await Wallet.findOne({ user: custAlice._id });

    // Price ₹500, commission 10% = ₹50, worker payout = ₹450
    // Amount paid via Razorpay = ₹350, customer bonus 5% of ₹350 = ₹18
    // Alice wallet: had 150 - 150 (used) + 18 (bonus) = 18
    if (
      resT5Verify.status === 200 &&
      dataT5Verify.success === true &&
      updatedBRzp.status.toLowerCase() === 'paid' &&
      postVerifyCharlie.earnings >= 315 + 450 &&
      postVerifyAliceWallet.balance === 18
    ) {
      console.log('  ✅ Signature verified & booking marked Paid:');
      console.log(`     - Razorpay Order: ${orderId}`);
      console.log(`     - Charlie Total Earnings: ₹${postVerifyCharlie.earnings}`);
      console.log(`     - Alice Bonus Credited: ₹18 (New Balance: ₹${postVerifyAliceWallet.balance})`);
      testsPassed++;
    } else {
      console.error('  ❌ Failed Razorpay verify test:', dataT5Verify);
    }

    // ========================================================================
    // TEST 6: Idempotency (Calling verify endpoint twice does NOT double-credit)
    // ========================================================================
    console.log('\nTEST 6: Idempotency check: Calling verify endpoint twice does NOT double-credit');
    const earningsBeforeSecondVerify = (await User.findById(workerCharlie._id)).earnings;
    const walletBeforeSecondVerify = (await Wallet.findOne({ user: custAlice._id })).balance;

    const resT6 = await fetch(`${API_BASE}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`,
      },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSignature,
        bookingId: bRazorpay._id.toString(),
      }),
    });

    const dataT6 = await resT6.json();
    const earningsAfterSecondVerify = (await User.findById(workerCharlie._id)).earnings;
    const walletAfterSecondVerify = (await Wallet.findOne({ user: custAlice._id })).balance;

    if (
      resT6.status === 200 &&
      dataT6.message?.includes('already verified') &&
      earningsAfterSecondVerify === earningsBeforeSecondVerify &&
      walletAfterSecondVerify === walletBeforeSecondVerify
    ) {
      console.log('  ✅ Idempotency strictly maintained: zero double-crediting!');
      console.log(`     - Earnings unchanged: ₹${earningsAfterSecondVerify}`);
      console.log(`     - Wallet balance unchanged: ₹${walletAfterSecondVerify}`);
      testsPassed++;
    } else {
      console.error('  ❌ Failed idempotency test: potential duplicate credit detected!');
    }

    // ========================================================================
    // TEST 7: Browser closed before verify: Webhook marks booking Paid
    // ========================================================================
    console.log('\nTEST 7: Webhook recovery: marks booking Paid when browser closes before verify');
    const bWebhook = await Booking.create({
      customer: custAlice._id,
      worker: workerCharlie._id,
      trade: 'Carpenter',
      price: 800,
      status: 'Completed',
      paymentStatus: 'Unpaid',
      address: 'Devakottai, Sivagangai',
    });

    const resT7Order = await fetch(`${API_BASE}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`,
      },
      body: JSON.stringify({
        bookingId: bWebhook._id.toString(),
        useWallet: false,
      }),
    });

    const dataT7Order = await resT7Order.json();
    const webhookOrderId = dataT7Order.orderId;
    const webhookPaymentId = `pay_hook_${timestamp}`;

    // Simulate customer closed tab: Razorpay sends webhook order.paid
    const webhookPayload = JSON.stringify({
      entity: 'event',
      account_id: 'acc_test123',
      event: 'order.paid',
      contains: ['payment', 'order'],
      payload: {
        payment: {
          entity: {
            id: webhookPaymentId,
            order_id: webhookOrderId,
            amount: 80000,
            status: 'captured',
          },
        },
        order: {
          entity: {
            id: webhookOrderId,
            amount: 80000,
            status: 'paid',
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    });

    const webhookSignature = generateWebhookSignature(webhookPayload, RAZORPAY_WEBHOOK_SECRET);

    const resT7Webhook = await fetch(`${API_BASE}/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': webhookSignature,
      },
      body: webhookPayload,
    });

    const dataT7Webhook = await resT7Webhook.json();
    const updatedBWebhook = await Booking.findById(bWebhook._id);

    if (
      resT7Webhook.status === 200 &&
      dataT7Webhook.status === 'ok' &&
      updatedBWebhook.status.toLowerCase() === 'paid'
    ) {
      console.log('  ✅ Webhook successfully processed raw body and marked booking Paid:');
      console.log(`     - Order: ${webhookOrderId}`);
      console.log(`     - Booking Status: ${updatedBWebhook.status}`);
      console.log(`     - Webhook Response HTTP: 200 OK`);
      testsPassed++;
    } else {
      console.error('  ❌ Failed webhook test:', dataT7Webhook);
    }
  } finally {
    // Cleanup created test records
    await User.deleteMany({ _id: { $in: [custAlice._id, custBob._id, workerCharlie._id] } });
    await Booking.deleteMany({ customer: { $in: [custAlice._id, custBob._id] } });
    await Payment.deleteMany({ customer: { $in: [custAlice._id, custBob._id] } });
    await Wallet.deleteMany({ user: { $in: [custAlice._id, custBob._id, workerCharlie._id] } });
    await mongoose.disconnect();
  }

  console.log('\n================================================================');
  console.log(`🏁 ACCEPTANCE TEST RESULTS: ${testsPassed} / ${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  if (testsPassed === totalTests) {
    console.log('🎉 ALL PAYMENT & WALLET ACCEPTANCE CRITERIA SATISFIED!\n');
    process.exit(0);
  } else {
    console.error('❌ SOME ACCEPTANCE TESTS FAILED\n');
    process.exit(1);
  }
}

runPaymentAcceptanceSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
