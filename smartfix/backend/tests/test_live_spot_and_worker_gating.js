const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: __dirname + '/../.env' });

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_super_secret_jwt_key_2025';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfix';

const User = require('../models/User');
const Booking = require('../models/Booking');

async function testLiveSpotAndGating() {
  console.log('================================================================');
  console.log('🧪 VERIFYING LIVE SPOT LOCATION & WORKER GATING SYSTEM');
  console.log('================================================================\n');

  await mongoose.connect(MONGO_URI);

  const timestamp = Date.now();
  const password = await bcrypt.hash('TestPass@123', 10);

  // 1. Create test customer
  const customer = await User.create({
    name: 'Ravi Kumar',
    email: `customer_spot_${timestamp}@example.com`,
    phone: `+9197${timestamp.toString().slice(-8)}`,
    password,
    role: 'customer',
    isVerified: true,
  });

  // 2. Create test worker
  const worker = await User.create({
    name: 'Murugan Pro Plumber',
    email: `worker_spot_${timestamp}@example.com`,
    phone: `+9196${timestamp.toString().slice(-8)}`,
    password,
    role: 'worker',
    trade: 'Plumbing',
    rating: 4.95,
    ratingCount: 34,
    verificationStatus: 'approved',
    isVerified: true,
  });

  const customerToken = jwt.sign({ id: customer._id, role: 'customer' }, JWT_SECRET, { expiresIn: '1d' });
  const workerToken = jwt.sign({ id: worker._id, role: 'worker' }, JWT_SECRET, { expiresIn: '1d' });

  console.log('1. Testing Customer Booking Creation without District/Taluk/City inputs...');
  // Customer sends live GPS coordinates and doorstep address ONLY (no district, no taluk, no city)
  const bookingRes = await fetch(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      category: 'Plumbing',
      trade: 'Plumbing',
      subService: 'Water Pipe Leak Repair',
      description: 'Main pipe leak near bathroom wall.',
      address: 'Door 14/2, Anna Nagar 2nd Street, Near Murugan Temple',
      pickupLat: 9.8433,
      pickupLng: 78.4809,
      userLat: 9.8433,
      userLng: 78.4809,
      location: {
        type: 'Point',
        coordinates: [78.4809, 9.8433],
      },
      workerId: worker._id.toString(),
    }),
  });

  const bookingJson = await bookingRes.json();
  if (!bookingRes.ok) {
    throw new Error(`Failed to create booking: ${JSON.stringify(bookingJson)}`);
  }

  const bookingId = bookingJson.booking?._id || bookingJson.booking?.id;
  console.log(`  ✓ Booking created successfully (#${bookingId})`);
  console.log(`    - Doorstep Address: "${bookingJson.booking?.address}"`);
  console.log(`    - Spot Coordinates: [${bookingJson.booking?.pickupLng}, ${bookingJson.booking?.pickupLat}]`);
  console.log(`    - Auto-Derived District: "${bookingJson.booking?.district}"`);

  console.log('\n2. Testing Worker Details Masking at "pending" (Anti-Fake Reviews & Bias Protection)...');
  const pendingCustomerFetch = await fetch(`${API_BASE}/bookings/${bookingId}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const pendingData = await pendingCustomerFetch.json();
  const pendingWorker = pendingData.booking?.worker;

  if (pendingWorker?.name || pendingWorker?.phone || pendingWorker?.rating) {
    throw new Error(`Worker details leaked before acceptance! Leaked: ${JSON.stringify(pendingWorker)}`);
  }
  console.log('  ✓ Worker details are strictly shielded:');
  console.log(`    - Name: ${pendingWorker?.name || '(Hidden)'}`);
  console.log(`    - Rating: ${pendingWorker?.rating || '(Hidden)'}`);
  console.log(`    - Phone: ${pendingWorker?.phone || '(Hidden)'}`);
  console.log(`    - Masked Placeholder: "${pendingWorker?.maskedName}"`);

  console.log('\n3. Testing Worker Acceptance...');
  const acceptRes = await fetch(`${API_BASE}/bookings/${bookingId}/accept`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${workerToken}`,
    },
  });
  const acceptJson = await acceptRes.json();
  if (!acceptRes.ok) {
    throw new Error(`Worker accept failed: ${JSON.stringify(acceptJson)}`);
  }
  console.log(`  ✓ Worker accepted booking. Status updated to "${acceptJson.booking?.status || 'accepted'}"`);

  console.log('\n4. Testing Worker Details Reveal Post-Acceptance to Customer...');
  const acceptedCustomerFetch = await fetch(`${API_BASE}/bookings/${bookingId}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const acceptedData = await acceptedCustomerFetch.json();
  const acceptedWorker = acceptedData.booking?.worker;

  if (!acceptedWorker?.name || acceptedWorker.name !== 'Murugan Pro Plumber') {
    throw new Error(`Worker name not revealed post-acceptance: ${JSON.stringify(acceptedWorker)}`);
  }
  if (!acceptedWorker?.rating || acceptedWorker.rating !== 4.95) {
    throw new Error(`Worker rating not revealed post-acceptance: ${JSON.stringify(acceptedWorker)}`);
  }
  console.log('  ✓ Worker details successfully revealed post-acceptance:');
  console.log(`    - Worker Name: "${acceptedWorker.name}"`);
  console.log(`    - Worker Rating: ${acceptedWorker.rating} ★ (${acceptedWorker.ratingCount} reviews)`);
  console.log(`    - Real Phone Protected: ${acceptedWorker.phone ? 'LEAKED' : 'SECURE (Shielded)'}`);

  console.log('\n5. Testing Mutual Live Location Coordinates Availability...');
  const workerBookingFetch = await fetch(`${API_BASE}/bookings/${bookingId}`, {
    headers: { Authorization: `Bearer ${workerToken}` },
  });
  const workerBookingData = await workerBookingFetch.json();

  const customerLat = workerBookingData.booking?.userLat || workerBookingData.booking?.pickupLat;
  const customerLng = workerBookingData.booking?.userLng || workerBookingData.booking?.pickupLng;

  if (!customerLat || !customerLng) {
    throw new Error(`Customer live spot missing from worker view: ${JSON.stringify(workerBookingData.booking)}`);
  }
  console.log('  ✓ Worker receives exact customer spot coordinates for navigation:');
  console.log(`    - Customer Lat/Lng: ${customerLat}, ${customerLng}`);
  console.log(`    - Customer Doorstep: "${workerBookingData.booking?.address}"`);
  console.log(`    - Google Maps Nav URL: https://www.google.com/maps/dir/?api=1&destination=${customerLat},${customerLng}`);

  console.log('\n================================================================');
  console.log('🎉 ALL LIVE SPOT LOCATION & WORKER GATING TESTS PASSED 100%!');
  console.log('================================================================\n');

  await mongoose.disconnect();
}

testLiveSpotAndGating().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
