const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Booking = require('../models/Booking');
const User = require('../models/User');

const API_BASE = 'http://127.0.0.1:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_secret_key_2026';

async function runTest() {
  console.log('--- Testing Worker Incoming Request & Acceptance Flow ---');
  await mongoose.connect('mongodb://127.0.0.1:27017/smartfix');

  // 1. Find or create an approved worker
  let worker = await User.findOne({ role: { $in: ['worker', 'handyman'] }, verificationStatus: { $in: ['approved', 'Verified'] } });
  if (!worker) {
    worker = await User.create({
      name: 'Approved Test Worker',
      phone: '+919876500001',
      email: 'approvedworker@smartfix.test',
      password: 'password123',
      role: 'worker',
      trade: 'Plumbing',
      verificationStatus: 'approved',
      isVerified: true,
      availabilityStatus: 'Available',
      isOnline: true,
    });
  }

  // 2. Find or create a customer
  let customer = await User.findOne({ role: 'customer' });
  if (!customer) {
    customer = await User.create({
      name: 'Test Customer',
      phone: '+919876500002',
      email: 'testcustomer@smartfix.test',
      password: 'password123',
      role: 'customer',
    });
  }

  const workerToken = jwt.sign(
    { id: worker._id.toString(), role: 'worker', email: worker.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const customerToken = jwt.sign(
    { id: customer._id.toString(), role: 'customer', email: customer.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 3. Customer creates a booking assigned to this worker
  console.log('1. Customer creating booking for worker...');
  const createRes = await fetch(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      workerId: worker._id.toString(),
      trade: 'Plumbing',
      address: 'Near Sivagangai Bus Stand, Tamil Nadu',
      notes: 'Kitchen sink pipe is leaking heavily',
      price: 450,
      pickupLat: 9.8433,
      pickupLng: 78.4809,
    }),
  });

  const createData = await createRes.json();
  if (!createRes.ok) {
    throw new Error(`Booking creation failed: ${createData.message}`);
  }
  const bookingId = createData.booking._id || createData.booking.id;
  console.log(`✓ Booking created: ${bookingId}, Status: "${createData.booking.status}"`);

  // 4. Worker fetches their bookings
  console.log('2. Worker fetching their bookings (/api/bookings/my)...');
  const workerBookingsRes = await fetch(`${API_BASE}/bookings/my`, {
    headers: {
      Authorization: `Bearer ${workerToken}`,
    },
  });
  const workerBookingsData = await workerBookingsRes.json();
  if (!workerBookingsRes.ok) {
    throw new Error(`Worker getMyBookings failed: ${workerBookingsData.message}`);
  }

  const incomingJob = workerBookingsData.bookings.find(b => (b._id || b.id) === bookingId);
  if (!incomingJob) {
    throw new Error(`Worker could not find incoming job ${bookingId} in getMyBookings list!`);
  }
  console.log(`✓ Worker retrieved incoming job: "${incomingJob.trade}", Status: "${incomingJob.status}"`);
  console.log(`  Location structure: ${JSON.stringify(incomingJob.location)}`);

  // 5. Worker accepts the booking
  console.log('3. Worker accepting the booking (/api/bookings/:id/accept)...');
  const acceptRes = await fetch(`${API_BASE}/bookings/${bookingId}/accept`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${workerToken}`,
    },
  });
  const acceptData = await acceptRes.json();
  if (!acceptRes.ok) {
    throw new Error(`Worker acceptBooking failed: ${acceptData.message}`);
  }
  console.log(`✓ Worker accepted booking successfully: Status now "${acceptData.booking?.status}"`);

  // 6. Worker moves to EnRoute
  console.log('4. Worker starts journey en-route (/api/bookings/:id/status)...');
  const enRouteRes = await fetch(`${API_BASE}/bookings/${bookingId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${workerToken}`,
    },
    body: JSON.stringify({
      status: 'en_route',
    }),
  });
  const enRouteData = await enRouteRes.json();
  if (!enRouteRes.ok) {
    throw new Error(`Worker update status to en_route failed: ${enRouteData.message}`);
  }
  console.log(`✓ Booking status updated to: "${enRouteData.booking?.status}"`);

  // 7. Cleanup test booking
  await Booking.findByIdAndDelete(bookingId);
  console.log('✓ Cleanup completed.');
  await mongoose.disconnect();
  console.log('\n🎉 ALL WORKER INCOMING & ACCEPT FLOW CHECKS PASSED!');
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
