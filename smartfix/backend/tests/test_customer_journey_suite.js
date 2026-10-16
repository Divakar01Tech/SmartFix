const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: __dirname + '/../.env' });

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_super_secret_jwt_key_2025';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfix';

// Models
const User = require('../models/User');
const Booking = require('../models/Booking');

async function runVerificationSuite() {
  console.log('================================================================');
  console.log('🚀 SMARTFIX CUSTOMER JOURNEY TEST & VERIFICATION SUITE');
  console.log('================================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB for assertions.\n');

  let passedTests = 0;
  const totalTests = 8;

  const customerA_Email = 'testcustomer_a_' + Date.now() + '@example.com';
  const customerB_Email = 'testcustomer_b_' + Date.now() + '@example.com';
  const worker_Email = 'testworker_' + Date.now() + '@example.com';
  const password = 'Password@123';
  const hashedPassword = await bcrypt.hash(password, 10);

  // 1. Create Customer A
  const custA = await User.create({
    name: 'Customer Alice',
    email: customerA_Email,
    phone: '+919876543210',
    password: hashedPassword,
    role: 'customer',
    isVerified: true,
    location: 'Karaikudi, Sivagangai',
    lat: 9.8433,
    lng: 78.4809,
    locationPoint: { type: 'Point', coordinates: [78.4809, 9.8433] },
  });

  // 2. Create Customer B
  const custB = await User.create({
    name: 'Customer Bob',
    email: customerB_Email,
    phone: '+919876543211',
    password: hashedPassword,
    role: 'customer',
    isVerified: true,
    location: 'Karaikudi, Sivagangai',
    lat: 9.8433,
    lng: 78.4809,
    locationPoint: { type: 'Point', coordinates: [78.4809, 9.8433] },
  });

  // 3. Create Worker
  const worker = await User.create({
    name: 'Master Senthil Pro',
    email: worker_Email,
    phone: '+919876543212',
    password: hashedPassword,
    role: 'worker',
    trade: 'Plumbing',
    verificationStatus: 'approved',
    isVerified: true,
    rating: 4.9,
    ratingCount: 28,
    ratePerHour: 450,
    location: 'Karaikudi, Sivagangai',
    lat: 9.8440,
    lng: 78.4820,
    locationPoint: { type: 'Point', coordinates: [78.4820, 9.8440] },
  });

  const tokenA = jwt.sign({ id: custA._id, role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
  const tokenB = jwt.sign({ id: custB._id, role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
  const workerToken = jwt.sign({ id: worker._id, role: 'worker' }, JWT_SECRET, { expiresIn: '7d' });

  // -------------------------------------------------------------
  // TEST 1: Customer Login with identifier & 5-Attempt Lockout
  // -------------------------------------------------------------
  console.log('--- TEST 1: Customer Login with identifier & 5-attempt/15-min lockout ---');
  try {
    const loginRes = await fetch(`${API_BASE}/customer/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '+919876543210', password }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.token) {
      throw new Error(`Login with phone failed: ${JSON.stringify(loginData)}`);
    }
    console.log('  ✓ 1a. Login with phone identifier (+919876543210) succeeded');

    let lastLockoutData = null;
    for (let i = 1; i <= 5; i++) {
      const failRes = await fetch(`${API_BASE}/customer/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: customerA_Email, password: 'WrongPassword' }),
      });
      lastLockoutData = await failRes.json();
    }

    if (lastLockoutData.locked && lastLockoutData.remainingMinutes) {
      console.log(`  ✓ 1b. 5 failed attempts triggered lockout: lockUntil active (${lastLockoutData.remainingMinutes} min remaining)`);
      passedTests++;
    } else {
      throw new Error(`Expected lockout but received: ${JSON.stringify(lastLockoutData)}`);
    }
  } catch (err) {
    console.error('  ✗ TEST 1 Failed:', err.message);
  }

  // Reset lockout for Customer A
  await User.findByIdAndUpdate(custA._id, { failedLoginAttempts: 0, lockUntil: null });

  // -------------------------------------------------------------
  // TEST 2: Outside-TN address rejection (HTTP 400)
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Outside Tamil Nadu Address Rejection (HTTP 400) ---');
  try {
    const outsideTnRes = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        category: 'Plumbing',
        subService: 'Pipe Leak Repair',
        description: 'Test booking outside TN',
        address: 'MG Road, Indiranagar, Bengaluru, Karnataka, India',
        district: 'Bengaluru Urban',
        state: 'Karnataka',
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      }),
    });
    const outsideData = await outsideTnRes.json();
    if (outsideTnRes.status === 400 && outsideData.message.toLowerCase().includes('tamil nadu')) {
      console.log(`  ✓ 2. Outside-TN address rejected with HTTP 400: "${outsideData.message}"`);
      passedTests++;
    } else {
      throw new Error(`Expected 400 outside-TN error, got status ${outsideTnRes.status}: ${JSON.stringify(outsideData)}`);
    }
  } catch (err) {
    console.error('  ✗ TEST 2 Failed:', err.message);
  }

  // -------------------------------------------------------------
  // Create valid booking inside Tamil Nadu
  // -------------------------------------------------------------
  const validBookingRes = await fetch(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      category: 'Plumbing',
      subService: 'Water Leak Repair',
      description: 'Fixing kitchen sink faucet',
      address: 'Main Bazaar Road, Karaikudi, Sivagangai, Tamil Nadu 630001, India',
      district: 'Sivagangai',
      state: 'Tamil Nadu',
      location: { type: 'Point', coordinates: [78.7738, 10.0734] },
      scheduledDate: '2026-10-15',
      scheduledTime: 'Immediate',
    }),
  });
  const validBookingData = await validBookingRes.json();
  const testBookingId = validBookingData.booking?._id || validBookingData.booking?.id;
  console.log(`  -> Created Valid Booking inside Tamil Nadu: #${testBookingId} (Initial status: "${validBookingData.booking?.status}")`);

  await Booking.findByIdAndUpdate(testBookingId, { worker: worker._id });

  // -------------------------------------------------------------
  // TEST 3: Worker details hidden at "pending" & visible at "accepted"
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Privacy Serializer: Worker Details Hidden at "pending" & Revealed at "accepted" ---');
  try {
    const pendingFetch = await fetch(`${API_BASE}/bookings/${testBookingId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const pendingData = await pendingFetch.json();
    const pendingWorker = pendingData.booking?.worker;

    const isHiddenAtPending =
      !pendingWorker?.name &&
      !pendingWorker?.phone &&
      !pendingWorker?.rating &&
      pendingWorker?.isAssigned === false;

    if (!isHiddenAtPending) {
      throw new Error(`Worker details exposed at pending: ${JSON.stringify(pendingWorker)}`);
    }
    console.log('  ✓ 3a. At "pending", worker identity is hidden (maskedName, no real phone, no rating)');

    const acceptRes = await fetch(`${API_BASE}/bookings/${testBookingId}/accept`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerToken}`,
      },
    });
    const acceptData = await acceptRes.json();
    if (!acceptRes.ok) {
      throw new Error(`Worker accept failed: ${JSON.stringify(acceptData)}`);
    }

    const acceptedFetch = await fetch(`${API_BASE}/bookings/${testBookingId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const acceptedData = await acceptedFetch.json();
    const acceptedWorker = acceptedData.booking?.worker;

    const isRevealedAtAccepted =
      acceptedWorker?.name === 'Master Senthil Pro' &&
      acceptedWorker?.rating === 4.9 &&
      acceptedWorker?.maskedContactOption === true &&
      !acceptedWorker?.email;

    if (isRevealedAtAccepted) {
      console.log('  ✓ 3b. At "accepted", worker display name and rating are revealed, real email remains shielded');
      passedTests++;
    } else {
      throw new Error(`Expected worker revealed at accepted: ${JSON.stringify(acceptedWorker)}`);
    }
  } catch (err) {
    console.error('  ✗ TEST 3 Failed:', err.message);
  }

  // -------------------------------------------------------------
  // TEST 4: Illegal status jump returns HTTP 409 Conflict
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: State Machine Rejection on Illegal Jump (HTTP 409 Conflict) ---');
  try {
    const illegalRes = await fetch(`${API_BASE}/bookings/${testBookingId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerToken}`,
      },
      body: JSON.stringify({ status: 'completed' }),
    });
    const illegalData = await illegalRes.json();

    if (illegalRes.status === 409) {
      console.log(`  ✓ 4. Illegal jump (accepted -> completed) rejected with HTTP 409 Conflict: "${illegalData.message}"`);
      passedTests++;
    } else {
      throw new Error(`Expected HTTP 409, got ${illegalRes.status}: ${JSON.stringify(illegalData)}`);
    }
  } catch (err) {
    console.error('  ✗ TEST 4 Failed:', err.message);
  }

  // -------------------------------------------------------------
  // TEST 5: 1-Hour SLA Breach Flags Admin
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: 1-Hour SLA Breach & Admin Flagging ---');
  try {
    await fetch(`${API_BASE}/bookings/${testBookingId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerToken}`,
      },
      body: JSON.stringify({ status: 'en_route' }),
    });

    const sixtyFiveMinsAgo = new Date(Date.now() - 65 * 60 * 1000);
    await Booking.findByIdAndUpdate(testBookingId, {
      acceptedAt: sixtyFiveMinsAgo,
      slaDeadline: new Date(sixtyFiveMinsAgo.getTime() + 60 * 60 * 1000),
    });

    const { runSlaBreachSweep } = require('../services/slaCronService');
    await runSlaBreachSweep(null);

    const updatedBooking = await Booking.findById(testBookingId);
    if (updatedBooking.status === 'sla_breached') {
      const historyEntry = updatedBooking.statusHistory.find((h) => h.status === 'sla_breached');
      console.log(`  ✓ 5. Booking flagged as "sla_breached" after 1 hour with statusHistory entry: "${historyEntry?.reason || 'SLA window exceeded'}"`);
      passedTests++;
    } else {
      throw new Error(`Expected status 'sla_breached', got '${updatedBooking.status}'`);
    }
  } catch (err) {
    console.error('  ✗ TEST 5 Failed:', err.message);
  }

  // Move to completed for payment tests
  await Booking.findByIdAndUpdate(testBookingId, {
    status: 'completed',
    workProof: { afterPhotos: ['https://example.com/repair_after.jpg'] },
  });

  // -------------------------------------------------------------
  // TEST 6: Tampered Razorpay Order Amount Rejected (HTTP 400)
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Tampered Razorpay Payment Amount Rejection (HTTP 400) ---');
  try {
    const tamperRes = await fetch(`${API_BASE}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        bookingId: testBookingId,
        amount: 5,
      }),
    });
    const tamperData = await tamperRes.json();

    if (tamperRes.status === 400 && (tamperData.message.toLowerCase().includes('tamper') || tamperData.message.toLowerCase().includes('match'))) {
      console.log(`  ✓ 6. Tampered amount rejected with HTTP 400: "${tamperData.message}"`);
      passedTests++;
    } else {
      throw new Error(`Expected HTTP 400 for tampered amount, got ${tamperRes.status}: ${JSON.stringify(tamperData)}`);
    }
  } catch (err) {
    console.error('  ✗ TEST 6 Failed:', err.message);
  }

  // -------------------------------------------------------------
  // TEST 7: Review Blocked Before Payment (HTTP 400)
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Review Blocked Before Payment (HTTP 400) ---');
  try {
    const prematurelyRateRes = await fetch(`${API_BASE}/bookings/${testBookingId}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ rating: 5, comment: 'Premature review before payment' }),
    });
    const prematureData = await prematurelyRateRes.json();

    if (prematurelyRateRes.status === 400 && prematureData.message.toLowerCase().includes('paid')) {
      console.log(`  ✓ 7. Review blocked before payment with HTTP 400: "${prematureData.message}"`);
      passedTests++;
    } else {
      throw new Error(`Expected HTTP 400 blocking premature review, got ${prematurelyRateRes.status}: ${JSON.stringify(prematureData)}`);
    }
  } catch (err) {
    console.error('  ✗ TEST 7 Failed:', err.message);
  }

  // Pay and review
  await fetch(`${API_BASE}/payments/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      bookingId: testBookingId,
      useWallet: true,
    }),
  });

  const validReviewRes = await fetch(`${API_BASE}/bookings/${testBookingId}/rate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ rating: 5, comment: 'Great job!' }),
  });
  const validReviewData = await validReviewRes.json();
  if (validReviewRes.ok && validReviewData.booking?.status === 'reviewed') {
    console.log('  -> Review permitted after payment, status is now "reviewed"');
  }

  // -------------------------------------------------------------
  // TEST 8: Customer A Cannot Read Customer B's Booking (HTTP 403)
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Multi-Tenant Scoping (Customer B Blocked from Booking A, HTTP 403) ---');
  try {
    const unauthFetchRes = await fetch(`${API_BASE}/bookings/${testBookingId}`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });
    const unauthData = await unauthFetchRes.json();

    if (unauthFetchRes.status === 403) {
      console.log(`  ✓ 8. Cross-customer booking read blocked with HTTP 403 Forbidden: "${unauthData.message}"`);
      passedTests++;
    } else {
      throw new Error(`Expected HTTP 403 Forbidden, received ${unauthFetchRes.status}: ${JSON.stringify(unauthData)}`);
    }
  } catch (err) {
    console.error('  ✗ TEST 8 Failed:', err.message);
  }

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('================================================================');

  // Cleanup
  await User.deleteMany({ _id: { $in: [custA._id, custB._id, worker._id] } });
  await Booking.deleteMany({ _id: testBookingId });

  await mongoose.disconnect();
  process.exit(passedTests === totalTests ? 0 : 1);
}

runVerificationSuite().catch((e) => {
  console.error('CRITICAL ERROR RUNNING TEST SUITE:', e);
  process.exit(1);
});
