const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const API_PORT = 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_secret_key_2026';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 SMARTFIX AUTH ISOLATION VERIFICATION SUITE');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(desc, condition, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  try {
    // 1. Generate synthetic isolated JWTs with role in payload
    const customerId = new mongoose.Types.ObjectId();
    const workerId = new mongoose.Types.ObjectId();
    const adminId = new mongoose.Types.ObjectId();

    const customerToken = jwt.sign({ id: customerId.toString(), role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });
    const workerToken = jwt.sign({ id: workerId.toString(), role: 'worker' }, JWT_SECRET, { expiresIn: '1h' });
    const adminToken = jwt.sign({ id: adminId.toString(), role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

    console.log('\n--- 1. Cross-Role API Authorization Checks ---');

    // Test A: Customer JWT calling Admin endpoint (/api/admin/pending-captains) -> 403
    const res1 = await request({
      hostname: 'localhost',
      port: API_PORT,
      path: '/api/admin/pending-captains',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
    });
    assert(
      'Customer JWT calling Admin API returns 403 Forbidden',
      res1.status === 403,
      `Got status ${res1.status}, body: ${JSON.stringify(res1.body)}`
    );

    // Test B: Worker JWT calling Admin endpoint (/api/admin/pending-captains) -> 403
    const res2 = await request({
      hostname: 'localhost',
      port: API_PORT,
      path: '/api/admin/pending-captains',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${workerToken}`,
        'Content-Type': 'application/json',
      },
    });
    assert(
      'Worker JWT calling Admin API returns 403 Forbidden',
      res2.status === 403,
      `Got status ${res2.status}, body: ${JSON.stringify(res2.body)}`
    );

    // Test C: Worker JWT calling Customer-only endpoint (/api/customer/auth/me) -> 403
    const res3 = await request({
      hostname: 'localhost',
      port: API_PORT,
      path: '/api/customer/auth/me',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${workerToken}`,
        'Content-Type': 'application/json',
      },
    });
    assert(
      'Worker JWT calling Customer-only API returns 403 Forbidden',
      res3.status === 403,
      `Got status ${res3.status}, body: ${JSON.stringify(res3.body)}`
    );

    // Test D: Customer JWT calling Worker endpoint (/api/worker/earnings) -> 403
    const res4 = await request({
      hostname: 'localhost',
      port: API_PORT,
      path: '/api/worker/earnings',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
    });
    assert(
      'Customer JWT calling Worker API returns 403 Forbidden',
      res4.status === 403,
      `Got status ${res4.status}, body: ${JSON.stringify(res4.body)}`
    );

    // Test E: Unauthenticated request to protected endpoint -> 401
    const res5 = await request({
      hostname: 'localhost',
      port: API_PORT,
      path: '/api/customer/auth/me',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    assert(
      'Unauthenticated request to protected API returns 401 Unauthorized',
      res5.status === 401,
      `Got status ${res5.status}`
    );

    console.log('\n--- 2. Role-Mismatch Login Rejection Checks ---');

    // Test F: Worker credentials on Customer Login endpoint (/api/customer/auth/login)
    // Connect to DB directly or use known existing seed/test account
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartfix';
    await mongoose.connect(MONGODB_URI);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    // Find or create test worker
    const bcrypt = require('bcryptjs');
    const testWorkerEmail = 'test_worker_isolation@example.com';
    const testCustomerEmail = 'test_customer_isolation@example.com';
    const passwordHash = await bcrypt.hash('TestPass123!', 10);

    await User.deleteMany({ email: { $in: [testWorkerEmail, testCustomerEmail] } });

    await User.create({
      email: testWorkerEmail,
      password: passwordHash,
      role: 'worker',
      name: 'Isolation Worker',
      phone: '9876543211',
      isVerified: true,
      verificationStatus: 'approved',
    });

    await User.create({
      email: testCustomerEmail,
      password: passwordHash,
      role: 'customer',
      name: 'Isolation Customer',
      phone: '9876543212',
    });

    // Attempt Customer login with Worker account
    const resLoginWorkerAtCust = await request(
      {
        hostname: 'localhost',
        port: API_PORT,
        path: '/api/customer/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { identifier: testWorkerEmail, password: 'TestPass123!' }
    );

    assert(
      'Worker logging in at /customer/login gets 400 or 403 with clear Service Provider message',
      (resLoginWorkerAtCust.status === 400 || resLoginWorkerAtCust.status === 403) &&
        resLoginWorkerAtCust.body?.message?.includes('Service Provider'),
      `Status: ${resLoginWorkerAtCust.status}, Message: "${resLoginWorkerAtCust.body?.message}"`
    );

    // Attempt Worker login with Customer account
    const resLoginCustAtWorker = await request(
      {
        hostname: 'localhost',
        port: API_PORT,
        path: '/api/worker/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { email: testCustomerEmail, password: 'TestPass123!' }
    );

    assert(
      'Customer logging in at /worker/login gets 400 or 403 with clear Customer message',
      (resLoginCustAtWorker.status === 400 || resLoginCustAtWorker.status === 403) &&
        resLoginCustAtWorker.body?.message?.includes('Customer'),
      `Status: ${resLoginCustAtWorker.status}, Message: "${resLoginCustAtWorker.body?.message}"`
    );

    // Attempt Customer login with Customer account -> Success
    const resCustLogin = await request(
      {
        hostname: 'localhost',
        port: API_PORT,
        path: '/api/customer/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { identifier: testCustomerEmail, password: 'TestPass123!' }
    );

    assert(
      'Customer login succeeds and returns JWT with role "customer"',
      resCustLogin.status === 200 && resCustLogin.body?.token,
      `Status: ${resCustLogin.status}`
    );

    if (resCustLogin.body?.token) {
      const decodedCust = jwt.decode(resCustLogin.body.token);
      assert(
        'Customer JWT payload contains { id, role: "customer" }',
        decodedCust && decodedCust.role === 'customer',
        `Payload: ${JSON.stringify(decodedCust)}`
      );

      // Verify GET /api/auth/me returns caller's customer profile
      const resMe = await request({
        hostname: 'localhost',
        port: API_PORT,
        path: '/api/auth/me',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${resCustLogin.body.token}`,
          'Content-Type': 'application/json',
        },
      });
      assert(
        'GET /api/auth/me returns caller customer user and role',
        resMe.status === 200 && resMe.body?.user?.email === testCustomerEmail && resMe.body?.user?.role === 'customer',
        `User: ${JSON.stringify(resMe.body?.user)}`
      );
    }

    // Clean up test records
    await User.deleteMany({ email: { $in: [testWorkerEmail, testCustomerEmail] } });
    await mongoose.disconnect();

  } catch (err) {
    console.error('Test Suite encountered unhandled error:', err);
    failed++;
  }

  console.log('====================================================');
  console.log(`RESULTS: Passed: ${passed}, Failed: ${failed}`);
  console.log('====================================================');
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
